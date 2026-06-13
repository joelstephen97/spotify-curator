import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Spotify Curator",
  description:
    "AI-powered Spotify stats, library curation, and weekly auto-discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        <Nav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
