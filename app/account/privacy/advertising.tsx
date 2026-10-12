"use client";

import { useState } from "react";
import { choiceKey } from "@/lib/ad-privacy";
import { saveAdChoice, useAdPrivacy, type SaveResult } from "../../ad-privacy-client";

// The visitor's advertising choice for this site. It can only restrict what Shopify's privacy
// settings allow, or pass an explicit permission to checkout; it never invents one.
const MESSAGES: Record<SaveResult, string> = {
  saved: "Saved. Your choice applies the next time you go to checkout.",
  changed: "Your choice was changed in another window. Here is the current setting; choose again if you want to change it.",
  blocked: "Your browser didn’t let us save this choice. We’ll respect an opt-out in this tab until you close it; allow cookies for this site to keep it.",
  "blocked-page": "Your browser didn’t let us save this choice. We’ll respect an opt-out until you leave this page; allow cookies and site data for this site to keep it.",
};

export function AdvertisingChoices() {
  const {choice, gpc, refresh} = useAdPrivacy();
  const [message, setMessage] = useState("");
  const shown = choiceKey(choice);
  const choose = (decision: "granted" | "denied") => {
    const result = saveAdChoice(decision, shown);
    refresh();
    setMessage(MESSAGES[result]);
  };
  const status = gpc ? "Off. Your browser’s Global Privacy Control signal is on, and it applies here and at checkout."
    : choice?.decision === "denied" ? "Off. You opted out in this browser."
    : choice?.decision === "granted" ? "Allowed. You allowed advertising measurement in this browser."
    : "You haven’t chosen here. Shopify’s privacy settings for your region apply at checkout.";
  return <section className="account-section ad-choices" id="advertising" aria-labelledby="advertising-title">
    <h2 id="advertising-title">Advertising measurement</h2>
    <p className="ad-choices-intro">When Shopify’s privacy settings and your choices allow it, IQON tells Meta (Facebook and Instagram) when checkout is started and when an order is completed, only for orders made up entirely of certain products, to measure its ads. We don’t send your name, email, address or product names. Shopping works the same either way.</p>
    <p className="ad-choices-status" role="status"><strong>Current setting:</strong> {status}</p>
    <div className="ad-choices-actions">
      <button type="button" className="button ad-choice-button" aria-pressed={choice?.decision === "denied"} onClick={() => choose("denied")}>Opt out</button>
      <button type="button" className="button ad-choice-button" aria-pressed={choice?.decision === "granted" && !gpc} disabled={gpc} onClick={() => choose("granted")}>Allow</button>
    </div>
    {gpc && <p className="account-note">To allow advertising measurement, turn off Global Privacy Control in your browser first.</p>}
    {message && <p className="ad-choices-message" aria-live="polite">{message}</p>}
    <p className="account-note">This choice is stored in this browser and passed to checkout. Checkout runs on Shopify’s own domain, so choices made on Shopify’s “Your Privacy Choices” page below apply to checkout and Shopify, but can’t change this site’s setting; use the buttons above for this site.</p>
  </section>;
}
