import type { NextConfig } from "next";
import { CANONICAL_HOST, PRIVATE_PATHS } from "./lib/seo";
import { LEGACY_PRODUCT_REDIRECTS } from "./lib/legacy-redirects";

const noindex = (value: string) => [{key: "X-Robots-Tag", value}];

const nextConfig: NextConfig = {
  async redirects() {
    return LEGACY_PRODUCT_REDIRECTS.map(({handle, destination}) => ({source: `/products/${handle}`, destination, permanent: true}));
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
