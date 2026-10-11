"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { SeasonRow } from "@/lib/season";

type SeasonItem = {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  owner?: { id: string; name: string } | null;
};

type SeasonDetail = {
  season: SeasonItem;
  nightCount: number;
  standings: SeasonRow[];
};

function rangeLabel(season: SeasonItem): string {
  if (season.startsOn && season.endsOn) return `${season.startsOn} – ${season.endsOn}`;
  if (season.startsOn) return `From ${season.startsOn}`;
  if (season.endsOn) return `Through ${season.endsOn}`;
  return "All finished nights";
}

export function SeasonPanel({ showOwner }: { showOwner: boolean }) {
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"good" | "bad">("good");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/seasons");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTone("bad");
      setMessage(typeof data.error === "string" ? data.error : "Could not load seasons");
      return;
    }
    setSeasons(Array.isArray(data.seasons) ? data.seasons : []);
  }, []);

  const openSeason = useCallback(async (id: string) => {
    const res = await fetch(`/api/seasons/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTone("bad");
      setMessage(typeof data.error === "string" ? data.error : "Could not load season");
      return;
    }
    setDetail(data);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setStartsOn("");
    setEndsOn("");
  }

  function startEdit(season: SeasonItem) {
    setEditingId(season.id);
    setTitle(season.title);
    setStartsOn(season.startsOn ?? "");
    setEndsOn(season.endsOn ?? "");
    setMessage("");
  }

  async function saveSeason(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(editingId ? `/api/seasons/${editingId}` : "/api/seasons", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsOn: startsOn || null,
          endsOn: endsOn || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTone("bad");
        setMessage(typeof data.error === "string" ? data.error : "Could not save season");
        return;
      }
      const saved = data.season as SeasonItem | undefined;
      setTone("good");
      setMessage(editingId ? `Updated “${saved?.title ?? title}”` : `Created “${saved?.title ?? title}”`);
      resetForm();
      await loadList();
      if (saved && detail?.season.id === saved.id) await openSeason(saved.id);
    } finally {
      setBusy(false);
    }
  }

  async function removeSeason(season: SeasonItem) {
    if (!confirm(`Delete season “${season.title}”? Finished nights stay in Past winners.`)) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/seasons/${season.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTone("bad");
        setMessage(typeof data.error === "string" ? data.error : "Could not delete season");
        return;
      }
      if (detail?.season.id === season.id) setDetail(null);
      if (editingId === season.id) resetForm();
      setTone("good");
      setMessage(`Deleted “${season.title}”`);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold md:text-4xl">Season</h1>
      <p className="mt-1 text-sm text-muted">
        Adds up scores from finished nights. The same name, ignoring caps and
        extra spaces, is one player. Team nights count the team name. Dates
        are UTC.
      </p>
      {message && (
        <p className={`mt-4 text-sm ${tone === "bad" ? "text-bad" : "text-good"}`}>
          {message}
        </p>
      )}

      <form
        onSubmit={saveSeason}
        className="mt-8 space-y-4 rounded-2xl border border-line bg-panel p-5"
      >
        <div className="text-sm font-bold text-chalk">
          {editingId ? "Edit season" : "New season"}
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
            Name
          </span>
          <input
            className="field"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fall 2026"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              From
            </span>
            <input
              className="field"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber">
              Through
            </span>
            <input
              className="field"
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          Leave the dates blank to include every finished night.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          {editingId && (
            <button
              type="button"
              className="rounded-md border px-5 py-2.5 text-sm font-bold"
              style={{ borderColor: "var(--line)", color: "var(--chalk)" }}
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
            {busy ? "Saving…" : editingId ? "Update season" : "Save season"}
          </button>
        </div>
      </form>

      <div className="mt-10 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-amber">
          Your seasons
        </h2>
        {seasons.length === 0 && (
          <p className="text-muted">No seasons yet.</p>
        )}
        {seasons.map((season) => (
          <article
            key={season.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="text-xl font-bold">{season.title}</div>
              <div className="mt-1 text-sm text-muted">
                {rangeLabel(season)}
                {showOwner && season.owner ? ` · ${season.owner.name}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void openSeason(season.id)}
              >
                Standings
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => startEdit(season)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void removeSeason(season)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {detail && (
        <div className="mt-10">
          <h2 className="text-2xl font-bold">{detail.season.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {rangeLabel(detail.season)} · {detail.nightCount}{" "}
            {detail.nightCount === 1 ? "night" : "nights"}
          </p>
          {detail.standings.length === 0 ? (
            <p className="mt-4 text-muted">No scores in this range yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-2 text-xs uppercase tracking-[0.14em] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">Points</th>
                    <th className="px-4 py-3 font-bold">Nights</th>
                    <th className="px-4 py-3 font-bold">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.standings.map((row, index) => (
                    <tr key={row.name} className="border-t border-line">
                      <td className="px-4 py-3 tabular-nums text-muted">{index + 1}</td>
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="px-4 py-3 tabular-nums text-amber">{row.points}</td>
                      <td className="px-4 py-3 tabular-nums">{row.nights}</td>
                      <td className="px-4 py-3 tabular-nums">{row.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
