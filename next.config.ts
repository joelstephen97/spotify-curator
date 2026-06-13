import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We run locally on 127.0.0.1 (Spotify requires the loopback IP, not
  // "localhost"). Next 16 blocks cross-origin dev resources by default, which
  // breaks HMR + hydration when the host is 127.0.0.1 — allow it explicitly.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
