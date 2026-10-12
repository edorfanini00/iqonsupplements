import { z } from "zod";
import type { SubscriptionAction } from "./types";

// Printable text only; Shopify performs its own address/territory validation after this.
const clean = (max: number) => z.string().transform(value => value.replace(/\s+/g, " ").trim()).pipe(z.string().max(max, `Use ${max} characters or fewer.`).refine(value => !/[\u0000-\u001f\u007f<>]/.test(value), "Remove unsupported characters."));
const required = (max: number, message: string) => clean(max).pipe(z.string().min(1, message));

export const addressSchema = z.object({
  firstName: clean(100).default(""),
  lastName: clean(100).default(""),
  company: clean(100).default(""),
  address1: required(200, "Enter a street address."),
  address2: clean(200).default(""),
  city: required(100, "Enter a city."),
  territoryCode: z.string().regex(/^[A-Z]{2}$/, "Choose a country."),
  zoneCode: z.string().regex(/^([A-Z0-9]{1,3}(-[A-Z0-9]{1,3})?)?$/, "Choose a state or region.").default(""),
  zip: clean(20).default(""),
  phoneNumber: clean(32).default(""),
  makeDefault: z.boolean().default(false),
}).strict();

export type AddressInput = z.infer<typeof addressSchema>;

/** Shopify expects E.164. North American 10-digit numbers get +1; others must include their country code. */
export function normalizePhone(value: string, territoryCode: string): string | null {
  if (!value) return "";
  const digits = value.replace(/[\s().-]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits) && (territoryCode === "US" || territoryCode === "CA")) return `+1${digits}`;
  return null;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.code === "unrecognized_keys" ? "Unexpected field." : issue.code === "invalid_type" ? "This field is invalid." : issue.message;
  }
  return fields;
}

export function parseAddress(input: unknown): {ok: true; address: Record<string, string>; makeDefault: boolean} | {ok: false; fields: Record<string, string>} {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return {ok: false, fields: fieldErrors(parsed.error)};
  const {makeDefault, phoneNumber, ...rest} = parsed.data;
  const phone = normalizePhone(phoneNumber, rest.territoryCode);
  if (phone === null) return {ok: false, fields: {phoneNumber: "Include the country code, for example +44 20 7946 0000."}};
  const address: Record<string, string> = {...rest, phoneNumber: phone};
  // Empty optional fields are sent as empty strings so an edit can clear them.
  return {ok: true, address, makeDefault};
}

export const profileSchema = z.object({
  firstName: clean(100).default(""),
  lastName: clean(100).default(""),
}).strict();

export const subscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({action: z.literal("pause")}).strict(),
  z.object({action: z.literal("resume")}).strict(),
  z.object({action: z.literal("cancel"), confirm: z.literal(true)}).strict(),
  z.object({action: z.literal("skip"), cycleIndex: z.number().int().min(0).max(10000)}).strict(),
  z.object({action: z.literal("unskip"), cycleIndex: z.number().int().min(0).max(10000)}).strict(),
]);
export type SubscriptionActionInput = z.infer<typeof subscriptionActionSchema> & {action: SubscriptionAction};
