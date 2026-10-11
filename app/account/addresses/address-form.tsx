"use client";

import { useId, useState, type FormEvent } from "react";
import type { AccountAddress } from "@/lib/customer-account/types";
import { COUNTRIES, REGIONS } from "./regions";

export type AddressDraft = {firstName: string; lastName: string; company: string; address1: string; address2: string; city: string; territoryCode: string; zoneCode: string; zip: string; phoneNumber: string; makeDefault: boolean};
type Result = {message: string; fields: Record<string, string>} | null;

export function AddressForm({title, initial, busy, canBeDefault, onCancel, onSave}: {title: string; initial?: AccountAddress; busy: boolean; canBeDefault: boolean; onCancel: () => void; onSave: (draft: AddressDraft) => Promise<Result>}) {
  const id = useId();
  const [draft, setDraft] = useState<AddressDraft>({
    firstName: initial?.firstName || "", lastName: initial?.lastName || "", company: initial?.company || "", address1: initial?.address1 || "", address2: initial?.address2 || "",
    city: initial?.city || "", territoryCode: initial?.territoryCode || "US", zoneCode: initial?.zoneCode || "", zip: initial?.zip || "", phoneNumber: initial?.phoneNumber || "", makeDefault: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const set = (key: keyof AddressDraft) => (value: string | boolean) => { setDraft(current => ({...current, [key]: value})); setErrors(current => ({...current, [key]: ""})); };
  const regions = REGIONS[draft.territoryCode];
  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!draft.address1.trim()) local.address1 = "Enter a street address.";
    if (!draft.city.trim()) local.city = "Enter a city.";
    if (regions && !draft.zoneCode) local.zoneCode = "Choose a state or region.";
    if (Object.keys(local).length) { setErrors(local); return; }
    const result = await onSave(draft);
    if (result) { setErrors(result.fields); setFormError(Object.keys(result.fields).some(k => k !== "form") ? "" : result.message); }
  }
  const field = (key: keyof AddressDraft, label: string, props: Record<string, unknown> = {}) => <div className={`account-field ${errors[key] ? "has-error" : ""}`}>
    <label htmlFor={`${id}-${key}`}>{label}</label>
    <input id={`${id}-${key}`} value={draft[key] as string} onChange={event => set(key)(event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${id}-${key}-error` : undefined} disabled={busy} {...props}/>
    {errors[key] && <small id={`${id}-${key}-error`}>{errors[key]}</small>}
  </div>;
  return <form className="address-form" onSubmit={submit} noValidate aria-label={title}>
    <h2>{title}</h2>
    {formError && <p className="account-error-inline" role="alert">{formError}</p>}
    <div className="account-field-row">{field("firstName", "First name", {autoComplete: "given-name", maxLength: 100})}{field("lastName", "Last name", {autoComplete: "family-name", maxLength: 100})}</div>
    {field("address1", "Street address", {autoComplete: "address-line1", maxLength: 200, required: true})}
    {field("address2", "Apartment, suite, etc. (optional)", {autoComplete: "address-line2", maxLength: 200})}
    {field("company", "Company (optional)", {autoComplete: "organization", maxLength: 100})}
    <div className="account-field-row">
      {field("city", "City", {autoComplete: "address-level2", maxLength: 100, required: true})}
      <div className={`account-field ${errors.territoryCode ? "has-error" : ""}`}>
        <label htmlFor={`${id}-country`}>Country</label>
        <select id={`${id}-country`} value={draft.territoryCode} disabled={busy} autoComplete="country" onChange={event => { set("territoryCode")(event.target.value); set("zoneCode")(""); }}>
          {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        {errors.territoryCode && <small>{errors.territoryCode}</small>}
      </div>
    </div>
    <div className="account-field-row">
      {regions ? <div className={`account-field ${errors.zoneCode ? "has-error" : ""}`}>
        <label htmlFor={`${id}-zone`}>{draft.territoryCode === "CA" ? "Province" : "State"}</label>
        <select id={`${id}-zone`} value={draft.zoneCode} disabled={busy} autoComplete="address-level1" aria-invalid={!!errors.zoneCode} onChange={event => set("zoneCode")(event.target.value)}>
          <option value="">Select</option>{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        {errors.zoneCode && <small>{errors.zoneCode}</small>}
      </div> : field("zoneCode", "Region code (optional)", {maxLength: 7, autoCapitalize: "characters", onChange: (event: {target: {value: string}}) => set("zoneCode")(event.target.value.toUpperCase())})}
      {field("zip", draft.territoryCode === "US" ? "ZIP code" : "Postal code", {autoComplete: "postal-code", maxLength: 20})}
    </div>
    {field("phoneNumber", "Phone (optional)", {autoComplete: "tel", type: "tel", maxLength: 32})}
    {canBeDefault && <label className="account-check"><input type="checkbox" checked={draft.makeDefault} disabled={busy} onChange={event => set("makeDefault")(event.target.checked)}/>Use as my default address</label>}
    <div className="address-form-actions"><button className="button button-dark" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button><button className="quiet-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
