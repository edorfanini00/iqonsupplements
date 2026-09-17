"use client";
import React, { useState } from "react";
export function RecruitmentLink({ inviteUrl }: { inviteUrl: string }) {
  const [message, setMessage] = useState("");
  return <section className="rounded-lg border border-[#20282c]/15 p-5 my-6 text-left">
    <h2 className="font-medium mb-2">Your recruitment link</h2>
    <p className="text-sm text-[#64717a] mb-3">Invite other affiliates, even while pending. Every application still requires approval. This is not your customer discount link.</p>
    <input aria-label="Your recruitment link" readOnly value={inviteUrl} onFocus={e => e.target.select()} className="w-full rounded-lg border p-2 text-sm" />
    <button type="button" className="underline text-sm mt-3" onClick={async () => {
      try { await navigator.clipboard.writeText(inviteUrl); setMessage("Copied"); }
      catch { setMessage("Select and copy the link above."); }
    }}>Copy link</button>
    <span role="status" className="ml-3 text-sm">{message}</span>
  </section>;
}
