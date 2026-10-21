import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { robotsRules } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return robotsRules({vercelEnv: process.env.VERCEL_ENV, host: (await headers()).get("host")});
}
