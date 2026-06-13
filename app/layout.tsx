import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

import Nav from "@/components/Nav";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Soundprint — your year in sound",
  description:
    "A downloadable poster of your listening: top artists, genres, minutes, and a weekly AI discovery playlist. Built on the Spotify API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 dark:bg-[#07080a] dark:text-neutral-100">
        <ThemeProvider>
          {/* Atmospheric backdrop, Tailwind-only: a soft emerald wash that adapts
              to the active theme. */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60%_50%_at_15%_0%,rgba(16,185,129,0.10),transparent_70%),radial-gradient(55%_45%_at_100%_5%,rgba(16,185,129,0.06),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_15%_0%,rgba(16,185,129,0.18),transparent_70%),radial-gradient(55%_45%_at_100%_5%,rgba(52,211,153,0.10),transparent_70%),radial-gradient(80%_60%_at_50%_115%,rgba(5,46,33,0.5),transparent_70%)]" />
          {/* Film-grain overlay for depth — Tailwind-only via an inline SVG noise. */}
          <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035] mix-blend-soft-light dark:opacity-[0.06] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
