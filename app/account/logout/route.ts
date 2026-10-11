import { logoutRoute } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => logoutRoute(request);
