"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Stats" },
  { href: "/curate", label: "Curate" },
  { href: "/discoveries", label: "Discoveries" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur dark:border-white/5 dark:bg-[#07080a]/70">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-5 py-4">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
        >
          ◗ Spotify Curator
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
