"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Stats" },
  { href: "/curate", label: "Curate" },
  { href: "/discoveries", label: "Discoveries" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-neutral-800">
      <nav className="mx-auto flex w-full max-w-3xl items-center gap-6 px-5 py-4">
        <span className="font-semibold tracking-tight text-emerald-400">
          ◗ Spotify Curator
        </span>
        <div className="ml-auto flex gap-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
