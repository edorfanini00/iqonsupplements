"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { SubscriptionSummary } from "@/lib/customer-account/types";
import { cadenceLabel, EmptyBlock, ErrorBlock, formatDate, formatMoney, LoadingBlock, PageHeading, useAccountData } from "../account-client";
import { StatusPill } from "../subscription-parts";

export default function SubscriptionsPage() {
  const list = useAccountData<{subscriptions: SubscriptionSummary[]; managementUrl: string | null}>("/api/account/subscriptions");
  if (list.status === "loading") return <><PageHeading title="Subscriptions"/><LoadingBlock label="Loading your subscriptions"/></>;
  if (list.status === "error" || !list.data) return <><PageHeading title="Subscriptions"/><ErrorBlock message={list.error} retry={list.reload}/></>;
  const {subscriptions, managementUrl} = list.data;
  return <>
    <PageHeading title="Subscriptions" action={managementUrl && subscriptions.length ? <a className="under-link" href={managementUrl}>Manage with Shopify<ArrowUpRight size={15}/></a> : undefined}/>
    {subscriptions.length ? <div className="subscription-list">{subscriptions.map(s => <Link key={s.id} className="subscription-card" href={`/account/subscriptions/${s.id}`}>
      <div className="subscription-card-top"><StatusPill status={s.status}/><span>{cadenceLabel(s.delivery)}</span></div>
      <ul>{s.lines.map(line => <li key={line.id}>
        {line.image ? <img src={line.image} alt={line.alt}/> : <span className="order-thumb-blank" aria-hidden="true">{line.title.slice(0, 1)}</span>}
        <span><strong>{line.title}</strong><small>{[line.variantTitle && line.variantTitle !== "Default Title" ? line.variantTitle : "", `Qty ${line.quantity}`, formatMoney(line.price)].filter(Boolean).join(" · ")}</small></span>
      </li>)}</ul>
      <div className="subscription-card-foot">
        <span>{s.status === "ACTIVE" && s.nextBillingDate ? `Next order ${formatDate(s.nextBillingDate, {month: "long", day: "numeric"})}` : s.status === "PAUSED" ? "Paused — no orders until you resume" : s.lastPaymentFailed ? "The last payment didn’t go through" : `Started ${formatDate(s.createdAt)}`}</span>
        <ArrowRight size={16} strokeWidth={1.5}/>
      </div>
    </Link>)}</div>
      : <EmptyBlock title="You don’t have any subscriptions." action={<Link className="button button-dark" href="/collections/supplements">Explore supplements<ArrowRight size={17}/></Link>}/>}
  </>;
}
