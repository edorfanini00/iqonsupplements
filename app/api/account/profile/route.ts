import { profileApi, updateProfileApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => profileApi(request);
export const PATCH = (request: Request) => updateProfileApi(request);
