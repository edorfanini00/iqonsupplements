import { orderApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = async (request: Request, {params}: {params: Promise<{id: string}>}) => orderApi(request, (await params).id);
