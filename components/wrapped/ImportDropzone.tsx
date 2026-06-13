"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "motion/react";
import { commas } from "@/lib/format";
import {
  parseStreamingHistory,
  aggregateImport,
  collectRows,
} from "@/lib/import";

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "uploading" }
  | { kind: "done"; summary: ImportSummary }
  | { kind: "error"; message: string };

interface ImportSummary {
  totalMinutes: number;
  totalHours: number;
  totalPlays: number;
  topArtist: string | null;
  since: string | null;
  until: string | null;
}

export default function ImportDropzone({ onDone }: { onDone?: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || !files.length) return;
      setState({ kind: "reading" });
      try {
        // Parse + aggregate entirely in the browser. Exports can be tens of MB;
        // we only ever send the tiny summary to the server (and the raw rows
        // never leave the device).
        const parsed: unknown[] = [];
        for (const file of Array.from(files)) {
          const text = await file.text();
          parsed.push(JSON.parse(text));
        }
        const plays = parseStreamingHistory(collectRows(parsed));
        if (!plays.length) {
          setState({
            kind: "error",
            message:
              "No music streams found. Upload the Streaming_History_Audio_*.json files from your export.",
          });
          return;
        }
        const aggregate = aggregateImport(plays);

        setState({ kind: "uploading" });
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aggregate }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({
            kind: "error",
            message:
              body.detail || body.error || `Upload failed (HTTP ${res.status}).`,
          });
          return;
        }
        setState({
          kind: "done",
          summary: {
            totalMinutes: aggregate.totalMinutes,
            totalHours: aggregate.totalHours,
            totalPlays: aggregate.totalPlays,
            topArtist: aggregate.topArtists[0]?.artist ?? null,
            since: aggregate.since,
            until: aggregate.until,
          },
        });
        onDone?.();
      } catch (e) {
        setState({
          kind: "error",
          message:
            e instanceof SyntaxError
              ? "That file isn't valid JSON. Upload the Streaming_History_Audio_*.json files."
              : e instanceof Error
                ? e.message
                : "Something went wrong.",
        });
      }
    },
    [onDone],
  );

  if (state.kind === "done") {
    const s = state.summary;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6"
      >
        <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">
          Lifetime data unlocked 🎉
        </p>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
          {commas(s.totalHours)} hours · {commas(s.totalPlays)} plays
          {s.topArtist ? ` · most-played: ${s.topArtist}` : ""}.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Your numbers now reflect your full history. Reload to see them everywhere.
        </p>
      </motion.div>
    );
  }

  const busy = state.kind === "reading" || state.kind === "uploading";

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          drag
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-black/15 hover:border-emerald-500/50 dark:border-white/15"
        }`}
      >
        <span className="font-display text-base font-bold">
          {busy
            ? state.kind === "reading"
              ? "Reading files…"
              : "Crunching your history…"
            : "Drop your Spotify data export"}
        </span>
        <span className="mt-1 max-w-md text-xs text-neutral-500">
          Upload the <code>Streaming_History_Audio_*.json</code> files from your
          Spotify privacy data export to unlock true lifetime minutes & play
          counts. Processed in-memory; only the summary is stored.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {state.kind === "error" && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        Get it from Spotify → Privacy Settings → “Download your data” → Extended
        streaming history. Arrives by email in a few days.
      </p>
    </div>
  );
}
