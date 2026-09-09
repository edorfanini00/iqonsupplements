import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Vercel target checks the application without unrelated Worker tooling.
  typescript: { tsconfigPath: "tsconfig.next.json" },
};

export default nextConfig;
