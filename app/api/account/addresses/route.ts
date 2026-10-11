import { addressesApi, createAddressApi } from "@/lib/customer-account/handlers";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => addressesApi(request);
export const POST = (request: Request) => createAddressApi(request);
