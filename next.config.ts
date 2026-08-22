import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  devIndicators: false,
};

export default function nextConfig(phase: string): NextConfig {
  return {
    ...baseConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };
}
