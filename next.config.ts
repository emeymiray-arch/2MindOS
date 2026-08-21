import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // Pin root to this package so Turbopack never picks the parent ~/package-lock.json
  // (that drift made /api/* 404 and prevented any goal saves from reaching disk).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
