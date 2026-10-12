"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AccountAddress } from "@/lib/customer-account/types";
import { AccountRequestError, EmptyBlock, ErrorBlock, LoadingBlock, PageHeading, useAccountData, useAccountMutation } from "../account-client";
import { ConfirmDialog } from "../confirm";
import { AddressForm, type AddressDraft } from "./address-form";

type Book = {addresses: AccountAddress[]};

export default function AddressesPage() {
  const book = useAccountData<Book>("/api/account/addresses");
  const send = useAccountMutation();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState("");
  const [removing, setRemoving] = useState<AccountAddress | null>(null);
  const [message, setMessage] = useState<{text: string; error: boolean} | null>(null);

  async function run(key: string, request: () => Promise<Book>, success: string) {
    setBusy(key); setMessage(null);
    try { book.setData(await request()); setMessage({text: success, error: false}); return true; }
    catch (error) { setMessage({text: error instanceof AccountRequestError ? error.message : "Something went wrong. Please try again.", error: true}); return false; }
    finally { setBusy(""); }
  }
  async function save(draft: AddressDraft, id: string | "new") {
    // Field errors are returned to the form; the page notice is for success only.
    setBusy("save"); setMessage(null);
    try {
      const result = id === "new" ? await send<Book>("/api/account/addresses", "POST", draft) : await send<Book>(`/api/account/addresses/${id}`, "PATCH", draft);
      book.setData(result); setEditing(null); setMessage({text: id === "new" ? "Address saved." : "Address updated.", error: false});
      return null;
    } catch (error) {
      if (error instanceof AccountRequestError) return {message: error.message, fields: error.body.fields || {}};
      return {message: "Something went wrong. Please try again.", fields: {}};
    } finally { setBusy(""); }
  }

  const add = editing === null && <button className="button button-outline" onClick={() => { setEditing("new"); setMessage(null); }}>Add address<Plus size={16}/></button>;
  if (book.status === "loading") return <><PageHeading title="Addresses"/><LoadingBlock label="Loading your addresses"/></>;
  if (book.status === "error" || !book.data) return <><PageHeading title="Addresses"/><ErrorBlock message={book.error} retry={book.reload}/></>;
  const {addresses} = book.data;
  return <>
    <PageHeading title="Addresses" action={addresses.length ? add || undefined : undefined}/>
    {message && <p className={message.error ? "account-error-inline" : "account-success"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    {editing === "new" && <AddressForm title="New address" busy={busy === "save"} canBeDefault={addresses.length > 0} onCancel={() => setEditing(null)} onSave={draft => save(draft, "new")}/>}
    {addresses.length === 0 && editing !== "new" && <EmptyBlock title="No saved addresses yet." action={add || undefined}/>}
    <div className="address-grid">{addresses.map(address => editing === address.id
      ? <AddressForm key={address.id} title="Edit address" initial={address} busy={busy === "save"} canBeDefault={!address.isDefault} onCancel={() => setEditing(null)} onSave={draft => save(draft, address.id)}/>
      : <article key={address.id} className={`address-card ${address.isDefault ? "is-default" : ""}`}>
        {address.isDefault && <span className="account-pill">Default</span>}
        <address>{address.formatted.map((line, i) => <span key={i}>{line}</span>)}{address.phoneNumber && <span>{address.phoneNumber}</span>}</address>
        <div className="address-actions">
          <button className="under-link" disabled={!!busy || editing !== null} onClick={() => { setEditing(address.id); setMessage(null); }}>Edit</button>
          {!address.isDefault && <button className="under-link" disabled={!!busy || editing !== null} onClick={() => void run(`default-${address.id}`, () => send<Book>(`/api/account/addresses/${address.id}`, "PATCH", {makeDefault: true}), "Default address updated.")}>{busy === `default-${address.id}` ? "Saving…" : "Set as default"}</button>}
          <button className="under-link address-remove" disabled={!!busy || editing !== null} onClick={() => setRemoving(address)}>{busy === `delete-${address.id}` ? "Removing…" : "Remove"}</button>
        </div>
      </article>)}</div>
    <p className="account-note">Saved addresses are offered at checkout. Subscriptions keep their own delivery address, shown on each subscription.</p>
    <ConfirmDialog open={!!removing} onOpenChange={open => !open && setRemoving(null)} title="Remove this address?" description={removing?.formatted.slice(0, 3).join(", ")} confirm="Remove address"
      onConfirm={() => { const target = removing!; setRemoving(null); void run(`delete-${target.id}`, () => send<Book>(`/api/account/addresses/${target.id}`, "DELETE", {}), "Address removed."); }}/>
  </>;
}
