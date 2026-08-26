import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Custom Node server (server/index.ts) hosts Next + Socket.io
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
