import { callbackRoute } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => callbackRoute(request);
