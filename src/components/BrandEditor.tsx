"use client";

import { BRAND_MODES, BRAND_PRESETS, type BrandModeId, type BrandPresetId } from "@/lib/branding";

export type BrandFormState = {
  displayName: string;
  tagline: string;
  logoUrl: string;
  preset: BrandPresetId;
  mode: BrandModeId;
  accent: string;
  background: string;
};

type Props = {
  value: BrandFormState;
  onChange: (next: BrandFormState) => void;
  /** When true, displayName/tagline labels say "override" */
  overrideMode?: boolean;
  onUpload?: (file: File) => Promise<string | null>;
  idPrefix?: string;
};

export const emptyBrandForm = (): BrandFormState => ({
  displayName: "",
  tagline: "",
  logoUrl: "",
  preset: "default",
  mode: "dark",
  accent: "",
  background: "",
});

export function BrandEditor({
  value,
  onChange,
  overrideMode = false,
  onUpload,
  idPrefix = "brand",
}: Props) {
  const set = <K extends keyof BrandFormState>(key: K, v: BrandFormState[K]) =>
    onChange({ ...value, [key]: v });

  async function handleUpload(file: File | undefined) {
    if (!file || !onUpload) return;
    const url = await onUpload(file);
    if (url) set("logoUrl", url);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-muted">
            {overrideMode ? "Display name (optional)" : "Display name"}
          </span>
          <input
            id={`${idPrefix}-name`}
            className="field"
            value={value.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder={overrideMode ? "Inherit site name" : "Trivia Live"}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">
            {overrideMode ? "Tagline (optional)" : "Tagline"}
          </span>
          <input
            id={`${idPrefix}-tagline`}
            className="field"
            value={value.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder={overrideMode ? "Inherit site tagline" : "Live rounds for everyone"}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Preset</span>
          <select
            className="field"
            value={value.preset}
            onChange={(e) => set("preset", e.target.value as BrandPresetId)}
          >
            {BRAND_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Mode</span>
          <select
            className="field"
            value={value.mode}
            onChange={(e) => set("mode", e.target.value as BrandModeId)}
          >
            {BRAND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Accent color</span>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-11 w-14 cursor-pointer rounded border border-line bg-transparent p-1"
              value={value.accent || "#e8a317"}
              onChange={(e) => set("accent", e.target.value)}
            />
            <input
              className="field"
              value={value.accent}
              onChange={(e) => set("accent", e.target.value)}
              placeholder="#e8a317 (optional)"
            />
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-muted">Background color</span>
          <div className="flex gap-2">
            <input
              type="color"
              className="h-11 w-14 cursor-pointer rounded border border-line bg-transparent p-1"
              value={value.background || "#0b1020"}
              onChange={(e) => set("background", e.target.value)}
            />
            <input
              className="field"
              value={value.background}
              onChange={(e) => set("background", e.target.value)}
              placeholder="#0b1020 (optional)"
            />
          </div>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-muted">Logo URL</span>
        <input
          className="field"
          value={value.logoUrl}
          onChange={(e) => set("logoUrl", e.target.value)}
          placeholder="https://… or upload below"
        />
      </label>

      {onUpload && (
        <label className="block space-y-2">
          <span className="text-sm text-muted">Upload logo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-panel file:px-3 file:py-2 file:text-chalk"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
        </label>
      )}

      {value.logoUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-2/50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.logoUrl} alt="Logo preview" className="h-12 w-12 rounded object-contain" />
          <span className="text-sm text-muted truncate">{value.logoUrl}</span>
        </div>
      ) : null}
    </div>
  );
}
