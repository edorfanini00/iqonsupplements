import type { NextConfig } from "next";
import { CANONICAL_HOST, PRIVATE_PATHS } from "./lib/seo";
import { LEGACY_PRODUCT_REDIRECTS } from "./lib/legacy-redirects";

const noindex = (value: string) => [{key: "X-Robots-Tag", value}];

const nextConfig: NextConfig = {
  webpack(config) {
    // Hydrogen's browser SDK imports this public module at runtime.
    config.output.environment = {...config.output.environment, dynamicImport: true, asyncFunction: true};
    config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals]).filter(Boolean), {
      "https://cdn.shopify.com/storefront/standard-events.js": "import https://cdn.shopify.com/storefront/standard-events.js",
    }];
    return config;
  },
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
