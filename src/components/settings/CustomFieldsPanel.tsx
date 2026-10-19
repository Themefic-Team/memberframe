import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ListPlus, Plus, Save, Trash2, X } from "lucide-react";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  FieldRow,
  FieldRows,
  IconButton,
  Select,
  TextField,
  fieldErrorId,
} from "../ui";
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  MAX_CUSTOM_FIELDS,
  MAX_FIELD_OPTIONS,
  conditionParents,
  definitionProblems,
  hasDefinitionProblems,
  keyFromLabel,
  moveDefinition,
  removeDefinition,
  type CustomFieldDefinition,
  type CustomFieldType,
  type FieldCondition,
} from "../../utils/customFields";
import { cn } from "../../utils/cn";

export interface CustomFieldsPanelProps {
  fields: CustomFieldDefinition[];
  onChangeFields: (fields: CustomFieldDefinition[]) => void;
  /**
   * Keys already in the stored document. Their key is locked, because members'
   * answers are stored under it and renaming it would orphan every one.
   */
  savedKeys: ReadonlyArray<string>;
  saving: boolean;
  onSave: () => void;
  siteConnected: boolean;
  /** True when the draft differs from the stored list. */
  dirty: boolean;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: CustomFieldType; label: string }> =
  CUSTOM_FIELD_TYPES.map((type) => ({ value: type, label: CUSTOM_FIELD_TYPE_LABELS[type] }));

/** The "Show when" select's value for "no condition". */
const ALWAYS = "";

/**
 * A condition as one select value. Keys cannot contain `=`, so splitting on
 * the first one always recovers the pair, whatever the option text holds.
 */
function encodeCondition(condition: FieldCondition | null | undefined): string {
  return condition ? `${condition.key}=${condition.value}` : ALWAYS;
}

function decodeCondition(value: string): FieldCondition | null {
  if (value === ALWAYS) return null;
  const split = value.indexOf("=");
  if (split <= 0) return null;
  return { key: value.slice(0, split), value: value.slice(split + 1) };
}

/**
 * The Fields sub-tab of Settings. Feature plan FP-09 section 2, PRD F16.
 *
 * One card per field, one open at a time. At 360px a fully expanded list of
 * eight fields is a scroll the creator cannot hold in their head, and a single
 * open card is enough to edit a field while the closed ones still show the
 * whole form's shape: label, type, and whether it is required.
 *
 * ## Why the key locks
 *
 * A member's answer is stored under the field's key. Renaming the key after
 * members have answered orphans every answer: the server drops values with no
 * definition the next time each member saves. So the key is derived from the
 * label while the field is new, editable until the first save, and read-only
 * after it. The label stays editable forever, because it is only what members
 * read.
 *
 * Prop driven and owning only presentation state, so the rules behind it live
 * in `utils/customFields.ts` where a node test can reach them. `jsdom` is still
 * not installed, blocker B5.
 */
export const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({
  fields,
  onChangeFields,
  savedKeys,
  saving,
  onSave,
  siteConnected,
  dirty,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  /** The field waiting on the delete popup. */
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const problems = useMemo(() => definitionProblems(fields), [fields]);
  const blocked = hasDefinitionProblems(problems);
  const atLimit = fields.length >= MAX_CUSTOM_FIELDS;

  const replaceAt = (index: number, next: CustomFieldDefinition) => {
    onChangeFields(fields.map((field, position) => (position === index ? next : field)));
  };

  /**
   * A label change carries the key with it while the key is still the one the
   * old label produced. Once the creator has typed a key of their own, or the
   * field has been saved, the label moves alone.
   */
  const handleLabel = (index: number, label: string) => {
    const field = fields[index];
    if (!field) return;

    const others = fields.filter((_, position) => position !== index).map((entry) => entry.key);
    const locked = savedKeys.includes(field.key);
    const followsLabel = !locked && field.key === keyFromLabel(field.label, others);

    replaceAt(index, {
      ...field,
      label,
      key: followsLabel ? keyFromLabel(label, others) : field.key,
    });
  };

  const handleType = (index: number, type: CustomFieldType) => {
    const field = fields[index];
    if (!field) return;

    replaceAt(index, {
      ...field,
      type,
      // A new dropdown starts with one empty option to fill, rather than a
      // list the creator has to know to add to.
      options: type === "select" ? (field.options.length > 0 ? field.options : [""]) : field.options,
    });
  };

  const handleAdd = () => {
    if (atLimit) return;

    const taken = fields.map((field) => field.key);
    const label = "New field";

    onChangeFields([
      ...fields,
      {
        key: keyFromLabel(label, taken),
        label,
        type: "text",
        required: false,
        options: [],
        placeholder: "",
        order: fields.length,
        showWhen: null,
      },
    ]);
    setOpenIndex(fields.length);
  };

  const handleRemove = (index: number) => {
    onChangeFields(removeDefinition(fields, index));
    setOpenIndex((current) => {
      if (current === null || current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const next = moveDefinition(fields, index, direction);
    if (next.every((field, position) => field === fields[position])) return;

    onChangeFields(next);
    setOpenIndex((current) => {
      if (current === index) return index + direction;
      if (current === index + direction) return index;
      return current;
    });
  };

  const handleOption = (index: number, optionIndex: number, value: string) => {
    const field = fields[index];
    if (!field) return;
    replaceAt(index, {
      ...field,
      options: field.options.map((option, position) => (position === optionIndex ? value : option)),
    });
  };

  const handleRemoveOption = (index: number, optionIndex: number) => {
    const field = fields[index];
    if (!field) return;

    const removed = field.options[optionIndex];
    const options = field.options.filter((_, position) => position !== optionIndex);

    // A dependent field pointing at the removed option would become unsaveable
    // with its reason buried in another card. Making it always shown keeps the
    // list saveable and the dependent field's answers intact.
    onChangeFields(
      fields.map((entry, position) => {
        if (position === index) return { ...field, options };
        if (entry.showWhen && entry.showWhen.key === field.key && entry.showWhen.value === removed) {
          return { ...entry, showWhen: null };
        }
        return entry;
      })
    );
  };

  return (
    <div className="custom-fields">
      <section className="section-group">
        <div className="section-header-row">
          <h2 className="section-title">Profile Fields</h2>
          <span className="section-subtitle">
            Ask members for more than an email. Answers show on their dashboard and in the Manage
            tab.
          </span>
        </div>

        {fields.length === 0 ? (
          <EmptyState
            icon={<ListPlus aria-hidden={true} />}
            title="No profile fields yet"
            description="Add a field such as Company or Portfolio URL. Members answer them in the Profile Form on the Member Dashboard."
            action={
              <Button variant="secondary" onClick={handleAdd} disabled={saving}>
                <Plus aria-hidden={true} />
                Add field
              </Button>
            }
          />
        ) : (
          <div className="custom-field-list">
            {fields.map((field, index) => {
              const open = openIndex === index;
              const fieldProblems = problems[index] ?? {};
              const hasProblem = Object.keys(fieldProblems).length > 0;
              const locked = savedKeys.includes(field.key);
              const parents = conditionParents(fields, index);
              const id = `custom-field-${index}`;

              const conditionOptions = [
                { value: ALWAYS, label: "Always" },
                ...parents.flatMap((parent) =>
                  parent.type === "boolean"
                    ? [
                        { value: `${parent.key}=true`, label: `${parent.label} is on` },
                        { value: `${parent.key}=false`, label: `${parent.label} is off` },
                      ]
                    : parent.options
                        .filter((option) => option.trim() !== "")
                        .map((option) => ({
                          value: `${parent.key}=${option}`,
                          label: `${parent.label} is ${option}`,
                        }))
                ),
              ];

              // A stored condition the list no longer offers is still shown, so
              // the select does not silently display "Always" over a value that
              // the save would send.
              const currentCondition = encodeCondition(field.showWhen);
              if (!conditionOptions.some((option) => option.value === currentCondition)) {
                conditionOptions.push({ value: currentCondition, label: "A removed answer" });
              }

              return (
                // Keyed by position, like openIndex and the input ids. The key
                // follows the label while a field is new, so keying by it would
                // remount the card on every keystroke and drop the input focus.
                <div
                  key={index}
                  className={cn("custom-field-card", open && "is-open", hasProblem && "is-invalid")}
                >
                  <div className="custom-field-head">
                    <button
                      type="button"
                      className="custom-field-toggle"
                      aria-expanded={open}
                      aria-controls={`${id}-body`}
                      onClick={() => setOpenIndex(open ? null : index)}
                    >
                      <span className="custom-field-name">
                        {field.label.trim() === "" ? "Untitled field" : field.label}
                      </span>
                      <span className="custom-field-meta">
                        {CUSTOM_FIELD_TYPE_LABELS[field.type]}
                        {field.required ? ", required" : ""}
                        {field.showWhen ? ", conditional" : ""}
                        {hasProblem && !open ? ", needs a fix" : ""}
                      </span>
                      <span className={cn("custom-field-chevron", open && "is-open")}>
                        <ChevronDown aria-hidden={true} />
                      </span>
                    </button>

                    <div className="custom-field-actions">
                      <IconButton
                        label={`Move ${field.label || "field"} up`}
                        onClick={() => handleMove(index, -1)}
                        disabled={saving || index === 0}
                      >
                        <ArrowUp aria-hidden={true} />
                      </IconButton>
                      <IconButton
                        label={`Move ${field.label || "field"} down`}
                        onClick={() => handleMove(index, 1)}
                        disabled={saving || index === fields.length - 1}
                      >
                        <ArrowDown aria-hidden={true} />
                      </IconButton>
                      <IconButton
                        label={`Remove ${field.label || "field"}`}
                        onClick={() => setRemovingIndex(index)}
                        disabled={saving}
                      >
                        <Trash2 aria-hidden={true} />
                      </IconButton>
                    </div>
                  </div>

                  {open ? (
                    <div className="custom-field-body" id={`${id}-body`}>
                      <FieldRows>
                        <FieldRow label="Label" htmlFor={`${id}-label`} error={fieldProblems.label}>
                          <TextField
                            id={`${id}-label`}
                            value={field.label}
                            invalid={Boolean(fieldProblems.label)}
                            aria-describedby={fieldProblems.label ? fieldErrorId(`${id}-label`) : undefined}
                            disabled={saving}
                            maxLength={120}
                            onChange={(label) => handleLabel(index, label)}
                          />
                        </FieldRow>

                        <FieldRow
                          label="Key"
                          htmlFor={`${id}-key`}
                          error={fieldProblems.key}
                          hint={
                            locked
                              ? "Locked: members' answers are stored under this key."
                              : "Answers are stored under this key. It locks once saved."
                          }
                        >
                          <TextField
                            id={`${id}-key`}
                            value={field.key}
                            invalid={Boolean(fieldProblems.key)}
                            aria-describedby={fieldProblems.key ? fieldErrorId(`${id}-key`) : undefined}
                            disabled={saving || locked}
                            maxLength={49}
                            spellCheck={false}
                            onChange={(key) => replaceAt(index, { ...field, key: key.toLowerCase() })}
                          />
                        </FieldRow>

                        <FieldRow label="Type" htmlFor={`${id}-type`}>
                          <Select
                            id={`${id}-type`}
                            value={field.type}
                            options={TYPE_OPTIONS}
                            disabled={saving}
                            onChange={(type) => handleType(index, type)}
                          />
                        </FieldRow>

                        <FieldRow
                          label="Required"
                          htmlFor={`${id}-required`}
                          hint={
                            field.type === "boolean"
                              ? "A required checkbox must be ticked, like accepting terms."
                              : "Members must answer this before they can finish signing up."
                          }
                        >
                          <Checkbox
                            id={`${id}-required`}
                            checked={field.required}
                            disabled={saving}
                            onChange={(required) => replaceAt(index, { ...field, required })}
                          />
                        </FieldRow>

                        {field.type !== "boolean" && field.type !== "select" ? (
                          <FieldRow label="Placeholder" htmlFor={`${id}-placeholder`}>
                            <TextField
                              id={`${id}-placeholder`}
                              value={field.placeholder}
                              disabled={saving}
                              maxLength={120}
                              onChange={(placeholder) => replaceAt(index, { ...field, placeholder })}
                            />
                          </FieldRow>
                        ) : null}

                        {parents.length > 0 || field.showWhen ? (
                          <FieldRow
                            label="Show when"
                            htmlFor={`${id}-condition`}
                            error={fieldProblems.showWhen}
                          >
                            <Select
                              id={`${id}-condition`}
                              value={currentCondition}
                              options={conditionOptions}
                              disabled={saving}
                              onChange={(value) =>
                                replaceAt(index, { ...field, showWhen: decodeCondition(value) })
                              }
                            />
                          </FieldRow>
                        ) : null}
                      </FieldRows>

                      {field.type === "select" ? (
                        <div className="custom-field-options" role="group" aria-label="Options">
                          <span className="custom-field-options-title">Options</span>
                          {field.options.map((option, optionIndex) => (
                            <div className="custom-field-option" key={optionIndex}>
                              <TextField
                                id={`${id}-option-${optionIndex}`}
                                value={option}
                                fill
                                disabled={saving}
                                maxLength={120}
                                aria-label={`Option ${optionIndex + 1}`}
                                onChange={(value) => handleOption(index, optionIndex, value)}
                              />
                              <IconButton
                                label={`Remove option ${optionIndex + 1}`}
                                onClick={() => handleRemoveOption(index, optionIndex)}
                                disabled={saving || field.options.length <= 1}
                              >
                                <X aria-hidden={true} />
                              </IconButton>
                            </div>
                          ))}
                          {fieldProblems.options ? (
                            <span className="field-error-message" role="alert">
                              {fieldProblems.options}
                            </span>
                          ) : null}
                          <Button
                            variant="ghost"
                            onClick={() =>
                              replaceAt(index, { ...field, options: [...field.options, ""] })
                            }
                            disabled={saving || field.options.length >= MAX_FIELD_OPTIONS}
                          >
                            <Plus aria-hidden={true} />
                            Add option
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {fields.length > 0 ? (
          <div className="custom-fields-add">
            <Button variant="secondary" onClick={handleAdd} disabled={saving || atLimit}>
              <Plus aria-hidden={true} />
              Add field
            </Button>
            {atLimit ? (
              <span className="custom-field-caption">
                {`A site can have at most ${MAX_CUSTOM_FIELDS} fields.`}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* The Fields view's one and only `.primary-cta`. */}
      <div className="settings-cta">
        <Button
          variant="primary"
          size="md"
          className="fill"
          disabled={saving || blocked || !siteConnected || !dirty}
          onClick={onSave}
        >
          <Save aria-hidden={true} />
          {saving ? "Saving" : "Save fields"}
        </Button>
        {!siteConnected ? (
          <p className="settings-cta-note">Connect this project before saving fields.</p>
        ) : blocked ? (
          <p className="settings-cta-note">Fix the highlighted field before saving.</p>
        ) : null}
      </div>

      {removingIndex !== null && fields[removingIndex] ? (
        <ConfirmDialog
          title={`Delete ${fields[removingIndex]!.label.trim() || "this field"}?`}
          message={
            <>
              <p>Sign up and member profiles stop asking for it.</p>
              <p>It is removed when you press Save fields, and nothing changes on your site before that.</p>
            </>
          }
          confirmLabel="Delete field"
          cancelLabel="Keep field"
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            handleRemove(removingIndex);
            setRemovingIndex(null);
          }}
        />
      ) : null}
    </div>
  );
};
