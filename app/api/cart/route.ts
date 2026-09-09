import { getCartResponse, mutateCartResponse } from "@/lib/shopify.server";
export const dynamic="force-dynamic";
export const GET=getCartResponse;
export const POST=mutateCartResponse;
