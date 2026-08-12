import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  devIndicators: false,
  webpack(config) {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
