import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  devIndicators: false,
};

export default nextConfig;
