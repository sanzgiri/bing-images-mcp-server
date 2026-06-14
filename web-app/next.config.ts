import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root so it ignores any stray package-lock.json
  // higher up the filesystem (e.g. ~/package-lock.json). Without this, Next
  // shows a dev-mode "1 Issue" badge that obscures the quiz button.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
