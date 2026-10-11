"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { AccountOverview } from "@/lib/customer-account/types";
import { EmptyBlock, ErrorBlock, formatDate, LoadingBlock, PageHeading, useAccountData } from "./account-client";
import { OrderRow } from "./order-parts";

export default function AccountOverviewPage() {
  const overview = useAccountData<AccountOverview>("/api/account/overview");
  if (overview.status === "loading") return <><PageHeading title="Overview"/><LoadingBlock label="Loading your account"/></>;
  if (overview.status === "error" || !overview.data) return <><PageHeading title="Overview"/><ErrorBlock message={overview.error} retry={overview.reload}/></>;
  const {recentOrders, subscriptions, defaultAddress, profile} = overview.data;
  return <>
    <PageHeading title="Overview"/>
    <section className="account-section">
      <div className="account-section-head"><h2>Recent orders</h2>{recentOrders.length > 0 && <Link className="under-link" href="/account/orders">All orders<ArrowRight size={15}/></Link>}</div>
      {recentOrders.length ? <div className="order-list">{recentOrders.map(order => <OrderRow key={order.id} order={order}/>)}</div>
        : <EmptyBlock title="No orders yet." action={<Link className="button button-dark" href="/collections/all">Shop the collection<ArrowRight size={17}/></Link>}/>}
    </section>
    <div className="account-tiles">
      <Link className="account-tile" href="/account/subscriptions">
        <span className="eyebrow">SUBSCRIPTIONS</span>
        <strong>{subscriptions.active ? `${subscriptions.active} active` : subscriptions.paused ? `${subscriptions.paused} paused` : "None yet"}</strong>
        <small>{subscriptions.nextBillingDate ? `Next order ${formatDate(subscriptions.nextBillingDate, {month: "long", day: "numeric"})}` : subscriptions.active || subscriptions.paused ? "Manage your deliveries" : "Subscribe on any product page"}</small>
        <ArrowUpRight size={17}/>
      </Link>
      <Link className="account-tile" href="/account/addresses">
        <span className="eyebrow">DEFAULT ADDRESS</span>
        <strong>{defaultAddress ? defaultAddress.address1 : "No address saved"}</strong>
        <small>{defaultAddress ? [defaultAddress.city, defaultAddress.zoneCode, defaultAddress.zip].filter(Boolean).join(", ") : "Add one for faster checkout"}</small>
        <ArrowUpRight size={17}/>
      </Link>
      <Link className="account-tile" href="/account/profile">
        <span className="eyebrow">PROFILE</span>
        <strong>{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Add your name"}</strong>
        <small>{profile.email || ""}</small>
        <ArrowUpRight size={17}/>
      </Link>
    </div>
  </>;
}
