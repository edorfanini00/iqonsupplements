import { subscriptionActionApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const POST = async (request: Request, {params}: {params: Promise<{id: string}>}) => subscriptionActionApi(request, (await params).id);
