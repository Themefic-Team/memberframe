import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, FileArchive, Link2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { framer } from "framer-plugin";
import { Badge, Banner, Button, FieldRow, FieldRows, IconButton, Segmented, Select, TextField, useToast } from "../ui";
import {
  assetSummary,
  assetsFailure,
  deleteAsset,
  fetchAssets,
  formatBytes,
  linkAsset,
  updateAsset,
  uploadAsset,
  type AssetList,
  type SiteAsset,
} from "../../services/assetsService";
import { useConnection } from "../../hooks/useConnection";
import { useSiteTiers } from "../../hooks/useSiteTiers";
import {
  deployCanvasComponent,
  generateProtectedDownloadCode,
  type DeployContext,
} from "../../services";
import { deployBaseUrl } from "../../config/backend";
import { DEFAULT_PROTECTED_DOWNLOAD_CONFIG } from "../../types/canvas";
import type { TierLadderEntry } from "../../types/member";

type AddMode = "upload" | "link";

const ADD_MODES = [
  { value: "upload", label: "Upload" },
  { value: "link", label: "Link" },
] as const satisfies ReadonlyArray<{ value: AddMode; label: string }>;

/** "Any signed in member", then the site's tiers by rank: the highest reads "only". */
export function fileTierOptions(tiers: ReadonlyArray<TierLadderEntry>): ReadonlyArray<{ value: string; label: string }> {
  const ordered = [...tiers].sort((a, b) => a.rank - b.rank);
  const top = ordered[ordered.length - 1]?.key;
  return [
    { value: "signed_in", label: "Any signed in member" },
    ...ordered.map((tier) => ({
      value: tier.key,
      label: tier.key === top ? `${tier.name} only` : `${tier.name} or higher`,
    })),
  ];
}

/** "Gold", "Members", or the key itself for a tier deleted since. */
function tierLabel(key: string, tiers: ReadonlyArray<TierLadderEntry>): string {
  if (key === "signed_in") return "Members";
  return tiers.find((tier) => tier.key === key)?.name ?? key;
}

export interface FilesPanelProps {
  siteId: string;
}

/**
 * Manage, Files. FP-12, PRD F10.
 *
 * The creator's side of Upgrade to Download. Upload a file, or link one hosted
 * elsewhere, choose which plan it needs, and copy its Asset ID into a
 * `<ProtectedDownload>` on the canvas. The plan rule lives here, on the file,
 * because a rule in published page code is one any visitor could change.
 *
 * A file never leaves the server by its storage address. Visitors get a link
 * that works for 60 seconds, signed after their plan is checked again.
 */
export const FilesPanel: React.FC<FilesPanelProps> = ({ siteId }) => {
  const showToast = useToast();
  const { connection, settings } = useConnection();
  const tiers = useSiteTiers(siteId);
  const tierOptions = useMemo(() => fileTierOptions(tiers), [tiers]);

  const deployContext = useMemo<DeployContext>(
    () => ({
      apiBaseUrl: deployBaseUrl(),
      siteKey: connection?.siteKey ?? "",
      afterLoginPath: settings?.auth.afterLoginPath ?? "",
      loginPath: settings?.auth.loginPath ?? "/login",
      afterLogoutPath: settings?.auth.afterLogoutPath ?? "/",
      signupPath: settings?.auth.signupPath ?? "",
      resetPath: settings?.auth.resetPath ?? "/reset-password",
      tiers,
    }),
    [connection, settings, tiers]
  );

  const [list, setList] = useState<AssetList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<AddMode>("upload");
  const [name, setName] = useState("");
  const [requiredTier, setRequiredTier] = useState("signed_in");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await fetchAssets(siteId);
    if (result.kind === "ok") {
      setList(result.data);
      setLoadError(null);
    } else {
      setLoadError(assetsFailure(result));
    }
  }, [siteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tooLarge = file !== null && list !== null && file.size > list.maxBytes;

  const add = useCallback(async () => {
    setAddError(null);
    if (mode === "upload" && !file) {
      setAddError("Choose a file first.");
      return;
    }
    if (mode === "link" && !/^https:\/\//i.test(url.trim())) {
      setAddError("Paste a full https address to the file.");
      return;
    }
    if (tooLarge) return;

    setAdding(true);
    const result =
      mode === "upload" && file
        ? await uploadAsset(siteId, file, { name: name.trim(), requiredTier })
        : await linkAsset(siteId, { name: name.trim(), url: url.trim(), requiredTier });
    setAdding(false);

    if (result.kind !== "ok") {
      setAddError(assetsFailure(result));
      return;
    }

    setList((current) => (current ? { ...current, assets: [result.data.asset, ...current.assets] } : current));
    setName("");
    setUrl("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    showToast({ tone: "success", message: "File added. Copy its Asset ID." });
  }, [file, mode, name, requiredTier, showToast, siteId, tooLarge, url]);

  const copyId = useCallback((asset: SiteAsset) => {
    void navigator.clipboard?.writeText(asset.id).catch(() => undefined);
    setCopiedId(asset.id);
    window.setTimeout(() => setCopiedId((current) => (current === asset.id ? null : current)), 2000);
  }, []);

  const insertAssetButton = useCallback(
    async (asset: SiteAsset) => {
      setInsertingId(asset.id);
      try {
        const buttonText = asset.name ? `Download ${asset.name}` : "Download Source Files";
        const generated = generateProtectedDownloadCode(
          {
            ...DEFAULT_PROTECTED_DOWNLOAD_CONFIG,
            defaultAssetId: asset.id,
            buttonText,
          },
          undefined,
          deployContext
        );

        const outcome = await deployCanvasComponent(framer, generated, {
          attributes: {
            controls: {
              assetId: asset.id,
              buttonText,
            },
          },
        });

        if (outcome.ok) {
          showToast({ tone: "success", message: "Download button added to canvas" });
        } else {
          showToast({ tone: "error", message: outcome.title.slice(0, 45) });
        }
      } catch (error) {
        showToast({
          tone: "error",
          message: error instanceof Error ? error.message.slice(0, 45) : "Could not add to canvas",
        });
      } finally {
        setInsertingId(null);
      }
    },
    [deployContext, showToast]
  );

  const save = useCallback(
    async (asset: SiteAsset, patch: { name: string; requiredTier: string; fileName: string; url: string }) => {
      setBusyId(asset.id);
      const result = await updateAsset(siteId, asset.id, {
        name: patch.name,
        requiredTier: patch.requiredTier,
        fileName: patch.fileName,
        ...(asset.source === "url" && patch.url !== asset.remoteUrl ? { url: patch.url } : {}),
      });
      setBusyId(null);
      if (result.kind !== "ok") {
        showToast({ tone: "error", message: assetsFailure(result).slice(0, 45) });
        return;
      }
      setList((current) =>
        current ? { ...current, assets: current.assets.map((entry) => (entry.id === asset.id ? result.data.asset : entry)) } : current
      );
      setEditingId(null);
      showToast({ tone: "success", message: "File saved" });
    },
    [showToast, siteId]
  );

  const remove = useCallback(
    async (asset: SiteAsset) => {
      setBusyId(asset.id);
      const result = await deleteAsset(siteId, asset.id);
      setBusyId(null);
      setConfirmDeleteId(null);
      if (result.kind !== "ok") {
        showToast({ tone: "error", message: assetsFailure(result).slice(0, 45) });
        return;
      }
      setList((current) => (current ? { ...current, assets: current.assets.filter((entry) => entry.id !== asset.id) } : current));
      showToast({ tone: "success", message: "File deleted" });
    },
    [showToast, siteId]
  );

  if (loadError) {
    return <Banner tone="warning" title="Files could not load" message={loadError} action={{ label: "Retry", onClick: () => void reload() }} />;
  }

  if (!list) {
    return <p className="settings-help">Loading files.</p>;
  }

  return (
    <div className="files-panel">
      <section className="section-group">
        <div className="section-header-row">
          <h2 className="section-title">Add a file</h2>
          <span className="section-subtitle">
            Members on the plan you choose download it from a Protected Download button.
          </span>
        </div>

        <Segmented label="How to add the file" options={ADD_MODES} value={mode} onChange={setMode} />

        <FieldRows>
          {mode === "upload" ? (
            <FieldRow
              label="File"
              fill
              error={tooLarge ? `Files can be up to ${formatBytes(list.maxBytes)}.` : undefined}
              hint={file ? `${file.name}, ${formatBytes(file.size)}` : `Up to ${formatBytes(list.maxBytes)}.`}
            >
              <input
                ref={fileInput}
                id="files-upload-input"
                className="files-input-hidden"
                type="file"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;
                  setFile(chosen);
                  if (chosen && name.trim() === "") setName(chosen.name.replace(/\.[^.]+$/, ""));
                }}
              />
              <Button variant="secondary" size="sm" className="fill" onClick={() => fileInput.current?.click()}>
                <Upload aria-hidden={true} />
                {file ? "Choose another file" : "Choose file"}
              </Button>
            </FieldRow>
          ) : (
            <FieldRow
              label="Link"
              htmlFor="files-link"
              fill
              hint="Google Drive and Dropbox share links work. Members never see this address."
            >
              <TextField id="files-link" type="url" value={url} onChange={setUrl} placeholder="https://" fill />
            </FieldRow>
          )}

          <FieldRow label="Name" htmlFor="files-name" fill hint="Shown in this list only.">
            <TextField id="files-name" value={name} onChange={setName} placeholder="Design system kit" fill />
          </FieldRow>

          <FieldRow label="Who can download" htmlFor="files-tier" fill>
            <Select id="files-tier" value={requiredTier} options={tierOptions} onChange={setRequiredTier} fill />
          </FieldRow>
        </FieldRows>

        {addError ? <Banner tone="danger" title="Not added" message={addError} /> : null}

        <Button variant="primary" size="md" className="fill" disabled={adding || tooLarge} onClick={() => void add()}>
          {mode === "upload" ? <Upload aria-hidden={true} /> : <Link2 aria-hidden={true} />}
          {adding ? (mode === "upload" ? "Uploading" : "Adding") : mode === "upload" ? "Upload file" : "Add link"}
        </Button>
      </section>

      <section className="section-group">
        <div className="section-header-row">
          <h2 className="section-title">Files</h2>
          <span className="section-subtitle">
            {list.assets.length === 0
              ? "Nothing yet."
              : `${list.assets.length} file${list.assets.length === 1 ? "" : "s"}. Download links work for 60 seconds.`}
          </span>
        </div>

        {list.assets.length === 0 ? (
          <p className="settings-help">
            Add a file above, then click &quot;Add button to canvas&quot; on its row or copy its Asset ID into Protected Download.
          </p>
        ) : (
          <ul className="files-list">
            {list.assets.map((asset) =>
              editingId === asset.id ? (
                <FileEditor
                  key={asset.id}
                  asset={asset}
                  tierOptions={tierOptions}
                  busy={busyId === asset.id}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => void save(asset, patch)}
                />
              ) : (
                <li key={asset.id} className="file-row">
                  <span className="file-row-icon" aria-hidden={true}>
                    {asset.source === "url" ? <Link2 /> : <FileArchive />}
                  </span>
                  <span className="file-row-main">
                    <span className="file-row-name">{asset.name}</span>
                    <span className="file-row-meta">
                      {[assetSummary(asset), `${asset.downloadCount} download${asset.downloadCount === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    <code className="file-row-id">{asset.id}</code>
                  </span>
                  <Badge tone={asset.requiredTier === "signed_in" ? "neutral" : "brand"}>{tierLabel(asset.requiredTier, tiers)}</Badge>
                  <span className="file-row-actions">
                    {confirmDeleteId === asset.id ? (
                      <>
                        <Button variant="danger" size="sm" disabled={busyId === asset.id} onClick={() => void remove(asset)}>
                          Delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <IconButton
                          label={insertingId === asset.id ? "Adding..." : "Add button to canvas"}
                          disabled={insertingId === asset.id || busyId === asset.id}
                          onClick={() => void insertAssetButton(asset)}
                        >
                          <Plus aria-hidden={true} />
                        </IconButton>
                        <IconButton label={copiedId === asset.id ? "Copied" : "Copy Asset ID"} onClick={() => copyId(asset)}>
                          {copiedId === asset.id ? <Check aria-hidden={true} /> : <Copy aria-hidden={true} />}
                        </IconButton>
                        <IconButton label="Edit file" onClick={() => setEditingId(asset.id)}>
                          <Pencil aria-hidden={true} />
                        </IconButton>
                        <IconButton label="Delete file" onClick={() => setConfirmDeleteId(asset.id)}>
                          <Trash2 aria-hidden={true} />
                        </IconButton>
                      </>
                    )}
                  </span>
                </li>
              )
            )}
          </ul>
        )}

        {list.storage === "local" ? (
          <p className="settings-help">
            Uploads are kept on the API server&apos;s disk. For more than one server, set ASSET_STORAGE=s3 to use S3 or
            Cloudflare R2.
          </p>
        ) : null}
      </section>
    </div>
  );
};

interface FileEditorProps {
  asset: SiteAsset;
  tierOptions: ReadonlyArray<{ value: string; label: string }>;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: { name: string; requiredTier: string; fileName: string; url: string }) => void;
}

/** One file, open for editing in place of its row. */
const FileEditor: React.FC<FileEditorProps> = ({ asset, tierOptions, busy, onCancel, onSave }) => {
  const [name, setName] = useState(asset.name);
  const [requiredTier, setRequiredTier] = useState(asset.requiredTier);
  const [fileName, setFileName] = useState(asset.fileName);
  const [url, setUrl] = useState(asset.remoteUrl ?? "");
  const options = tierOptions.some((option) => option.value === requiredTier)
    ? tierOptions
    : [...tierOptions, { value: requiredTier, label: `${requiredTier} (deleted tier)` }];

  return (
    <li className="file-row is-editing">
      <FieldRows>
        <FieldRow label="Name" htmlFor={`file-name-${asset.id}`} fill>
          <TextField id={`file-name-${asset.id}`} value={name} onChange={setName} fill />
        </FieldRow>
        <FieldRow label="Saved as" htmlFor={`file-save-${asset.id}`} fill hint="The file name a member's browser saves.">
          <TextField id={`file-save-${asset.id}`} value={fileName} onChange={setFileName} fill />
        </FieldRow>
        {asset.source === "url" ? (
          <FieldRow label="Link" htmlFor={`file-url-${asset.id}`} fill>
            <TextField id={`file-url-${asset.id}`} type="url" value={url} onChange={setUrl} fill />
          </FieldRow>
        ) : null}
        <FieldRow label="Who can download" htmlFor={`file-tier-${asset.id}`} fill>
          <Select id={`file-tier-${asset.id}`} value={requiredTier} options={options} onChange={setRequiredTier} fill />
        </FieldRow>
      </FieldRows>
      <div className="file-row-edit-actions">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || name.trim() === "" || fileName.trim() === ""}
          onClick={() => onSave({ name: name.trim(), requiredTier, fileName: fileName.trim(), url: url.trim() })}
        >
          {busy ? "Saving" : "Save"}
        </Button>
      </div>
    </li>
  );
};
