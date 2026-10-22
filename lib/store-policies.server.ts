import { cache } from "react";
import { createPolicyLoader } from "./store-policy-content.server";

// Keep metadata and page content on the same request snapshot at cache expiry.
export const getStorePolicy = cache(createPolicyLoader());
