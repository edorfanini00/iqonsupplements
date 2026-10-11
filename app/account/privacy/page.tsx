"use client";

import { ArrowUpRight } from "lucide-react";
import { PageHeading, useAccount } from "../account-client";
import { useStore } from "../../store-shell";

// Integration seam with the storefront privacy module (Your Privacy Choices). That module
// owns the only consent state (a browser cookie) and its UI sheet; this page opens the same
// sheet rather than keeping a second copy of the choices. Until the privacy release is in
// the store shell, openPrivacy is absent and this page says so plainly.
type PrivacyStore = {openPrivacy?: () => void; privacyLinks?: {policy: string; optOut: string}};

export default function AccountPrivacyPage() {
  const store = useStore() as ReturnType<typeof useStore> & PrivacyStore;
  const {session} = useAccount();
  const ready = typeof store.openPrivacy === "function" && !!store.privacyLinks;
  return <>
    <PageHeading title="Privacy"/>
    {session?.status !== "signed_in" && <p className="account-meta">No sign-in needed. These choices apply to this browser whether or not you have an account.</p>}
    <section className="account-section privacy-panel">
      <h2>Your privacy choices</h2>
      {ready ? <>
        <p>Choose whether IQON can use analytics, advertising and personalization on this browser. Your choices are saved in this browser, not in your account, so set them again on other devices. A Global Privacy Control signal from your browser is always honored.</p>
        <button className="button button-dark" type="button" onClick={() => store.openPrivacy!()}>Review privacy choices</button>
        <div className="privacy-links">
          <a className="under-link" href={store.privacyLinks!.policy}>Privacy policy<ArrowUpRight size={14}/></a>
          <a className="under-link" href={store.privacyLinks!.optOut}>Shopify data sharing opt-out<ArrowUpRight size={14}/></a>
        </div>
      </> : <p role="status">Privacy choices are not available on the store yet.</p>}
    </section>
  </>;
}
