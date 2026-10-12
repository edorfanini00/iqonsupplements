"use client";

import { ArrowUpRight } from "lucide-react";
import { HOSTED_PRIVACY } from "@/lib/hosted-privacy";
import { PageHeading, useAccount } from "../account-client";

// Public: guests reach this from the footer; signed-in customers see it in the account menu.
// Privacy choices are handled on Shopify's own pages for the IQON store.
export default function AccountPrivacyPage() {
  const {session} = useAccount();
  return <>
    <PageHeading title="Privacy"/>
    {session?.status !== "signed_in" && <p className="account-meta">No sign-in needed.</p>}
    <section className="account-section privacy-hosted" aria-label="Privacy options">
      <a className="privacy-hosted-link" href={HOSTED_PRIVACY.choices} rel="noopener">
        <span><strong>Your Privacy Choices</strong><small>Opt out of the sale or sharing of your personal information, on Shopify’s page for the IQON store.</small></span>
        <ArrowUpRight size={18}/>
      </a>
      <a className="privacy-hosted-link" href={HOSTED_PRIVACY.policy} rel="noopener">
        <span><strong>Privacy policy</strong><small>How IQON collects, uses and shares personal information.</small></span>
        <ArrowUpRight size={18}/>
      </a>
      <p className="account-note">These pages are hosted by Shopify. Choices you make there are recorded by Shopify for the IQON store and its checkout. This site doesn’t run advertising or analytics tracking of its own.</p>
    </section>
  </>;
}
