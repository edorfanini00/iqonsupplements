import { deleteAddressApi, updateAddressApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
type Params = {params: Promise<{id: string}>};
export const PATCH = async (request: Request, {params}: Params) => updateAddressApi(request, (await params).id);
export const DELETE = async (request: Request, {params}: Params) => deleteAddressApi(request, (await params).id);
