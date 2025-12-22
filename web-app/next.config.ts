import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.0.161:3000", "10.0.0.161:3001", "localhost:3000", "localhost:3001"],
    },
  },
};

export default nextConfig;
