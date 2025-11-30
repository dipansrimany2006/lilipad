import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["keyv", "cacheable-request", "got"],
};

export default nextConfig;
