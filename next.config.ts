import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {source:"/products/gentle-cleanser",destination:"/products/anti-aging-cleanser-with-peptides",permanent:true},
      {source:"/products/peptide-serum",destination:"/collections/skincare",permanent:true},
      {source:"/products/barrier-cream",destination:"/collections/skincare",permanent:true},
    ];
  },
  // The Vercel target checks the application without unrelated Worker tooling.
  typescript: { tsconfigPath: "tsconfig.next.json" },
};

export default nextConfig;
