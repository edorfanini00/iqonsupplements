"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import type { AccountProfile } from "@/lib/customer-account/types";
import { AccountRequestError, ErrorBlock, LoadingBlock, PageHeading, useAccount, useAccountData, useAccountMutation } from "../account-client";

export default function ProfilePage() {
  const profile = useAccountData<AccountProfile>("/api/account/profile");
  const {session} = useAccount();
  const send = useAccountMutation();
  const id = useId();
  // Draft starts from the loaded profile; it is re-seeded when a save returns new values.
  const [draft, setDraft] = useState<{firstName: string; lastName: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{text: string; error: boolean} | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (profile.status === "loading") return <><PageHeading title="Profile"/><LoadingBlock label="Loading your profile"/></>;
  if (profile.status === "error" || !profile.data) return <><PageHeading title="Profile"/><ErrorBlock message={profile.error} retry={profile.reload}/></>;
  const p = profile.data;
  const values = draft ?? {firstName: p.firstName, lastName: p.lastName};
  const changed = values.firstName !== p.firstName || values.lastName !== p.lastName;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(null); setErrors({});
    try { profile.setData(await send<AccountProfile>("/api/account/profile", "PATCH", values)); setDraft(null); setMessage({text: "Your name is updated.", error: false}); }
    catch (error) { if (error instanceof AccountRequestError) { setErrors(error.body.fields || {}); setMessage({text: error.message, error: true}); } else setMessage({text: "Something went wrong. Please try again.", error: true}); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Profile"/>
    {message && <p className={message.error ? "account-error-inline" : "account-success"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    <form className="profile-form" onSubmit={submit} noValidate>
      <div className="account-field-row">
        {(["firstName", "lastName"] as const).map(key => <div key={key} className={`account-field ${errors[key] ? "has-error" : ""}`}>
          <label htmlFor={`${id}-${key}`}>{key === "firstName" ? "First name" : "Last name"}</label>
          <input id={`${id}-${key}`} value={values[key]} maxLength={100} autoComplete={key === "firstName" ? "given-name" : "family-name"} disabled={busy} onChange={event => setDraft({...values, [key]: event.target.value})}/>
          {errors[key] && <small>{errors[key]}</small>}
        </div>)}
      </div>
      <button className="button button-dark" type="submit" disabled={busy || !changed}>{busy ? "Saving…" : "Save changes"}</button>
    </form>
    <dl className="profile-facts">
      <div><dt>Email</dt><dd>{p.email || "Not set"}<small>You sign in with this email. To change it, use your Shopify account settings.</small>{session?.status === "signed_in" && <a className="under-link" href={session.hostedAccountUrl} rel="noopener">Shopify account settings<ArrowUpRight size={14}/></a>}</dd></div>
      {p.phone && <div><dt>Phone</dt><dd>{p.phone}</dd></div>}
    </dl>
  </>;
}
