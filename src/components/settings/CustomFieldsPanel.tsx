import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ListPlus, Plus, TextCursorInput, Trash2, X } from "lucide-react";
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  fieldErrorId,
  Fields,
  Setting,
  IconButton,
  Select,
  Sheet,
  TextField,
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
  /**
   * Keys already in the stored document. Their key is locked, because members'
   * answers are stored under it and renaming it would orphan every one.
   */
  savedKeys: ReadonlyArray<string>;
  saving: boolean;
  /** Saves the whole list as given. Resolves true when saved. */
  onSave: (fields: CustomFieldDefinition[]) => Promise<boolean>;
  siteConnected: boolean;
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

/** The field open in the sheet: its position, and the whole list with the edit in it. */
interface EditingField {
  index: number;
  list: CustomFieldDefinition[];
  isNew: boolean;
}

/**
 * The Fields sub-tab of Settings. Feature plan FP-09 section 2, PRD F16.
 *
 * One card per field: its label, type, and whether it is required, with move
 * up and down. A click opens the field's form in a `Sheet` (2026-10-25, the
 * user's request; before, the form expanded inside the card). Save field, a
 * move, and a confirmed delete save the list at once.
 *
 * The sheet edits a copy of the whole list, not one field: a new label's key
 * is checked against the others, a condition points at another field, and
 * removing an option can clear another field's condition.
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
 * in `utils/customFields.ts` where a node test can reach them.
 */
export const CustomFieldsPanel: React.FC<CustomFieldsPanelProps> = ({
  fields,
  savedKeys,
  saving,
  onSave,
  siteConnected,
}) => {
  const [editing, setEditing] = useState<EditingField | null>(null);
  /** The field waiting on the delete popup. */
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);

  const listProblems = useMemo(() => definitionProblems(fields), [fields]);
  const atLimit = fields.length >= MAX_CUSTOM_FIELDS;

  const setList = (change: (list: CustomFieldDefinition[]) => CustomFieldDefinition[]) =>
    setEditing((current) => (current ? { ...current, list: change(current.list) } : current));

  const replaceAt = (index: number, next: CustomFieldDefinition) =>
    setList((list) => list.map((field, position) => (position === index ? next : field)));

  /**
   * A label change carries the key with it while the key is still the one the
   * old label produced. Once the creator has typed a key of their own, or the
   * field has been saved, the label moves alone.
   */
  const handleLabel = (index: number, label: string) =>
    setList((list) => {
      const field = list[index];
      if (!field) return list;
      const others = list.filter((_, position) => position !== index).map((entry) => entry.key);
      const locked = savedKeys.includes(field.key);
      const followsLabel = !locked && field.key === keyFromLabel(field.label, others);
      return list.map((entry, position) =>
        position === index ? { ...field, label, key: followsLabel ? keyFromLabel(label, others) : field.key } : entry
      );
    });

  const handleType = (index: number, type: CustomFieldType) =>
    setList((list) =>
      list.map((field, position) =>
        position === index
          ? {
              ...field,
              type,
              // A new dropdown starts with one empty option to fill, rather than a
              // list the creator has to know to add to.
              options: type === "select" ? (field.options.length > 0 ? field.options : [""]) : field.options,
            }
          : field
      )
    );

  const handleAdd = () => {
    if (atLimit) return;

    const taken = fields.map((field) => field.key);
    const label = "New field";

    setEditing({
      index: fields.length,
      isNew: true,
      list: [
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
      ],
    });
  };

  const handleOpen = (index: number) => setEditing({ index, isNew: false, list: fields.map((field) => ({ ...field })) });

  const submit = async () => {
    if (!editing) return;
    if (await onSave(editing.list)) setEditing(null);
  };

  const handleRemove = async (index: number) => {
    if (await onSave(removeDefinition(fields, index))) setEditing(null);
  };

  /** A move saves at once, like a toggle: the order is all it changes. */
  const handleMove = (index: number, direction: -1 | 1) => {
    const next = moveDefinition(fields, index, direction);
    if (next.every((field, position) => field === fields[position])) return;
    void onSave(next);
  };

  const handleOption = (index: number, optionIndex: number, value: string) =>
    setList((list) =>
      list.map((field, position) =>
        position === index
          ? { ...field, options: field.options.map((option, i) => (i === optionIndex ? value : option)) }
          : field
      )
    );

  const handleRemoveOption = (index: number, optionIndex: number) =>
    setList((list) => {
      const field = list[index];
      if (!field) return list;
      const removed = field.options[optionIndex];
      const options = field.options.filter((_, position) => position !== optionIndex);

      // A dependent field pointing at the removed option would become unsaveable
      // with its reason in another field's sheet. Making it always shown keeps
      // the list saveable and the dependent field's answers intact.
      return list.map((entry, position) => {
        if (position === index) return { ...field, options };
        if (entry.showWhen && entry.showWhen.key === field.key && entry.showWhen.value === removed) {
          return { ...entry, showWhen: null };
        }
        return entry;
      });
    });

  const renderSheet = (open: EditingField) => {
    const { index, list, isNew } = open;
    const field = list[index]!;
    const problems = definitionProblems(list);
    const fieldProblems = problems[index] ?? {};
    const blocked = hasDefinitionProblems(problems);
    // The list is saved whole, so another field's problem blocks the save too.
    const otherProblem = blocked && Object.keys(fieldProblems).length === 0;
    const locked = savedKeys.includes(field.key);
    const parents = conditionParents(list, index);
    const id = "custom-field";
    const saved = isNew ? null : fields[index] ?? null;

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

    // A stored condition the list no longer offers is still shown, so the
    // select does not silently display "Always" over a value that the save
    // would send.
    const currentCondition = encodeCondition(field.showWhen);
    if (!conditionOptions.some((option) => option.value === currentCondition)) {
      conditionOptions.push({ value: currentCondition, label: "A removed answer" });
    }

    return (
      <Sheet
        title={saved ? saved.label.trim() || "Untitled field" : "New field"}
        description={saved ? CUSTOM_FIELD_TYPE_LABELS[saved.type] : "Asked at sign up and on the member's profile."}
        icon={<TextCursorInput aria-hidden={true} />}
        badge={saved?.required ? <Badge tone="neutral">Required</Badge> : undefined}
        onClose={saving ? undefined : () => setEditing(null)}
        footer={
          <>
            {!isNew ? (
              <Button variant="danger" size="md" disabled={saving} onClick={() => setRemovingIndex(index)}>
                <Trash2 aria-hidden={true} />
                Delete field
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="md"
              loading={saving}
              disabled={!siteConnected || blocked}
              onClick={() => void submit()}
            >
              {isNew ? "Add field" : "Save field"}
            </Button>
          </>
        }
      >
        {!siteConnected ? (
          <Banner tone="warning" title="Not connected" message="Connect this project before saving fields." />
        ) : otherProblem ? (
          <Banner tone="warning" title="Another field needs a fix" message="Close this, open the field marked Needs a fix, and correct it first." />
        ) : null}

        <Fields>
          <Field label="Label" htmlFor={`${id}-label`} error={fieldProblems.label}>
            <TextField
              id={`${id}-label`}
              value={field.label}
              invalid={Boolean(fieldProblems.label)}
              aria-describedby={fieldProblems.label ? fieldErrorId(`${id}-label`) : undefined}
              disabled={saving}
              maxLength={120}
              onChange={(label) => handleLabel(index, label)}
              fill
            />
          </Field>

          <Field
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
              fill
            />
          </Field>

          <Field label="Type" htmlFor={`${id}-type`}>
            <Select
              id={`${id}-type`}
              value={field.type}
              options={TYPE_OPTIONS}
              disabled={saving}
              onChange={(type) => handleType(index, type)}
            />
          </Field>

          <Setting
            title="Required"
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
          </Setting>

          {field.type !== "boolean" && field.type !== "select" ? (
            <Field label="Placeholder" htmlFor={`${id}-placeholder`}>
              <TextField
                id={`${id}-placeholder`}
                value={field.placeholder}
                disabled={saving}
                maxLength={120}
                onChange={(placeholder) => replaceAt(index, { ...field, placeholder })}
                fill
              />
            </Field>
          ) : null}

          {parents.length > 0 || field.showWhen ? (
            <Field label="Show when" htmlFor={`${id}-condition`} error={fieldProblems.showWhen}>
              <Select
                id={`${id}-condition`}
                value={currentCondition}
                options={conditionOptions}
                disabled={saving}
                onChange={(value) => replaceAt(index, { ...field, showWhen: decodeCondition(value) })}
              />
            </Field>
          ) : null}
        </Fields>

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
              onClick={() => replaceAt(index, { ...field, options: [...field.options, ""] })}
              disabled={saving || field.options.length >= MAX_FIELD_OPTIONS}
            >
              <Plus aria-hidden={true} />
              Add option
            </Button>
          </div>
        ) : null}
      </Sheet>
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

        {!siteConnected ? (
          <Banner tone="warning" title="Not connected" message="Connect this project before saving fields." />
        ) : null}

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
              const hasProblem = Object.keys(listProblems[index] ?? {}).length > 0;
              return (
                // Keyed by position, like the move buttons' indexes.
                <div key={index} className={cn("custom-field-card", hasProblem && "is-invalid")}>
                  <div className="custom-field-head">
                    <button
                      type="button"
                      className="custom-field-toggle"
                      aria-haspopup="dialog"
                      onClick={() => handleOpen(index)}
                    >
                      <span className="custom-field-name">
                        {field.label.trim() === "" ? "Untitled field" : field.label}
                      </span>
                      <span className="custom-field-meta">
                        {CUSTOM_FIELD_TYPE_LABELS[field.type]}
                        {field.required ? ", required" : ""}
                        {field.showWhen ? ", conditional" : ""}
                        {hasProblem ? ", needs a fix" : ""}
                      </span>
                      <span className="custom-field-chevron">
                        <ChevronRight aria-hidden={true} />
                      </span>
                    </button>

                    <div className="custom-field-actions">
                      <IconButton
                        label={`Move ${field.label || "field"} up`}
                        onClick={() => handleMove(index, -1)}
                        disabled={saving || !siteConnected || index === 0}
                      >
                        <ArrowUp aria-hidden={true} />
                      </IconButton>
                      <IconButton
                        label={`Move ${field.label || "field"} down`}
                        onClick={() => handleMove(index, 1)}
                        disabled={saving || !siteConnected || index === fields.length - 1}
                      >
                        <ArrowDown aria-hidden={true} />
                      </IconButton>
                    </div>
                  </div>
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

      {editing ? renderSheet(editing) : null}

      {removingIndex !== null && fields[removingIndex] ? (
        <ConfirmDialog
          title={`Delete ${fields[removingIndex]!.label.trim() || "this field"}?`}
          message={<p>Sign up and member profiles stop asking for it. The site updates at once.</p>}
          confirmLabel="Delete field"
          cancelLabel="Keep field"
          busy={saving}
          onCancel={() => setRemovingIndex(null)}
          onConfirm={() => {
            const index = removingIndex;
            setRemovingIndex(null);
            void handleRemove(index);
          }}
        />
      ) : null}
    </div>
  );
};
