"use client";

import { useState } from "react";

export default function CuratePage() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(
          body.error === "not_connected"
            ? "Connect Spotify first (on the Stats tab)."
            : `Failed: ${body.error ?? res.status}`,
        );
      } else {
        setMessage(`Created “${name.trim()}” with ${body.added} track(s).`);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Curate from your library
        </h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          Build a new playlist from your saved (liked) tracks.
        </p>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name"
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-emerald-500 dark:border-white/15"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-full bg-emerald-500 px-5 py-2 font-medium text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </form>

      {message && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
      )}
    </div>
  );
}
