import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["keyv", "cacheable-request", "got"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.ipfs.nftstorage.link",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
      {
        protocol: "https",
        hostname: "**.arweave.net",
      },
    ],
  },
};

export default nextConfig;
