import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SignedOutPage() {
  return <section className="account-gate account-gate-single">
    <div className="account-gate-copy">
      <p className="eyebrow">MY ACCOUNT</p>
      <h1>You’re signed out.</h1>
      <p>Thanks for visiting. Sign in again any time with a one-time code.</p>
      <div className="account-gate-actions"><a className="button button-dark" href="/account/login">Sign in<ArrowRight size={17}/></a><Link className="under-link" href="/collections/all">Continue shopping<ArrowRight size={15}/></Link></div>
    </div>
  </section>;
}
