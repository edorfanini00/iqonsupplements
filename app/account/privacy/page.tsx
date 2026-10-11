"use client";

import { PrivacyPanel } from "../../privacy-choices";
import { useStore } from "../../store-shell";
import { PageHeading, useAccount } from "../account-client";

// Public: guests reach this from the footer; signed-in customers see it in the account menu.
// The controls are the canonical privacy panel bound to the store shell's single privacy state;
// choices belong to this browser, not to the account.
export default function AccountPrivacyPage() {
  const {privacy, privacyLinks} = useStore();
  const {session} = useAccount();
  return <>
    <PageHeading title="Privacy"/>
    <p className="account-meta">{session?.status === "signed_in" ? "These choices are saved for this browser, not for your account, so set them on each device you use." : "No sign-in needed. These choices are saved for this browser."}</p>
    <section className="account-section privacy-inline" aria-label="Your Privacy Choices">
      <h2>Your Privacy Choices</h2>
      <p className="privacy-inline-lead">Choose how IQON may use your data on this site and when you check out.</p>
      <PrivacyPanel privacy={privacy} links={privacyLinks}/>
    </section>
  </>;
}
