import type { NextConfig } from "next";
import { CANONICAL_HOST, PRIVATE_PATHS } from "./lib/seo";

const noindex = (value: string) => [{key: "X-Robots-Tag", value}];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {source:"/products/gentle-cleanser",destination:"/products/anti-aging-cleanser-with-peptides",permanent:true},
      {source:"/products/peptide-serum",destination:"/collections/skincare",permanent:true},
      {source:"/products/barrier-cream",destination:"/collections/skincare",permanent:true},
    ];
  },
  async headers() {
    return [
      // Legacy domains and Vercel aliases serve the same pages without redirects; keep them out of the index.
      {source: "/:path*", missing: [{type: "host", value: CANONICAL_HOST.replace(/\./g, "\\.")}], headers: noindex("noindex")},
      ...PRIVATE_PATHS.flatMap(path => {
        const base = path.replace(/\/$/, "");
        return [{source: base, headers: noindex("noindex, nofollow")}, {source: `${base}/:path*`, headers: noindex("noindex, nofollow")}];
      }),
    ];
  },
  // The Vercel target checks the application without unrelated Worker tooling.
  typescript: { tsconfigPath: "tsconfig.next.json" },
};

export default nextConfig;
