import { ordersApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => ordersApi(request);
