import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findStorePolicy, STORE_POLICY_LINKS } from "@/lib/store-policies";
import { getStorePolicy } from "@/lib/store-policies.server";
import { publicPageMetadata } from "@/lib/seo.server";
import "../policies.css";

type Props = {params: Promise<{slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug} = await params;
  const policy = findStorePolicy(slug);
  if (!policy) notFound();
  const content = await getStorePolicy(slug);
  return publicPageMetadata({path: policy.href, title: `${content?.title || policy.label} | IQON`,
    description: `Read IQON’s ${policy.label.toLowerCase()}.`, eligible: !!content});
}

export default async function PolicyPage({params}: Props) {
  const {slug} = await params;
  const policy = findStorePolicy(slug);
  if (!policy) notFound();
  const content = await getStorePolicy(slug);
  return <main id="main" className="policy-page section-pad">
    <header className="policy-heading"><p className="eyebrow">QUESTIONS & CARE</p><h1>{content?.title || policy.label}</h1></header>
    <div className="policy-layout">
      {content ? <article className="policy-body" aria-label={content.title} dangerouslySetInnerHTML={{__html: content.body}} /> :
        <section className="policy-fallback" aria-label="Policy temporarily unavailable">
          <p>We couldn’t load this policy right now. Please try again shortly or read the published policy on Shopify.</p>
          <a href={policy.fallbackUrl}>Read the {policy.label.toLowerCase()} on Shopify</a>
        </section>}
      <nav className="policy-nav" aria-label="Store policies"><p className="eyebrow">STORE POLICIES</p>
        <ul>{STORE_POLICY_LINKS.map(item => <li key={item.slug}><a href={item.href} aria-current={item.slug === slug ? "page" : undefined}>{item.label}</a></li>)}</ul>
        <a className="policy-help" href="/help">Questions & care</a>
      </nav>
    </div>
  </main>;
}
