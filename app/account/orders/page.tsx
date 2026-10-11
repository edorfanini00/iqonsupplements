"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { OrderSummary } from "@/lib/customer-account/types";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeading, useAccountData } from "../account-client";
import { OrderRow } from "../order-parts";

type Page = {orders: OrderSummary[]; nextCursor: string | null};

export default function OrdersPage() {
  const first = useAccountData<Page>("/api/account/orders");
  const [more, setMore] = useState<OrderSummary[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const next = cursor === undefined ? first.data?.nextCursor : cursor;
  async function loadMore() {
    if (!next || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/account/orders?after=${encodeURIComponent(next)}`, {cache: "no-store", signal: AbortSignal.timeout(20000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMore(current => [...current, ...data.orders]); setCursor(data.nextCursor);
    } catch { setError("We couldn’t load more orders. Please try again."); }
    finally { setLoading(false); }
  }
  if (first.status === "loading") return <><PageHeading title="Orders"/><LoadingBlock label="Loading your orders"/></>;
  if (first.status === "error" || !first.data) return <><PageHeading title="Orders"/><ErrorBlock message={first.error} retry={first.reload}/></>;
  const orders = [...first.data.orders, ...more];
  return <>
    <PageHeading title="Orders"/>
    {orders.length ? <div className="order-list">{orders.map(order => <OrderRow key={order.id} order={order}/>)}</div>
      : <EmptyBlock title="No orders yet." action={<Link className="button button-dark" href="/collections/all">Shop the collection<ArrowRight size={17}/></Link>}/>}
    {error && <ErrorBlock message={error}/>}
    {next && <button className="button button-outline account-more" disabled={loading} onClick={() => void loadMore()}>{loading ? "Loading…" : "Show earlier orders"}</button>}
  </>;
}
