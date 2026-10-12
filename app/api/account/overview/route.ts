import { overviewApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => overviewApi(request);
