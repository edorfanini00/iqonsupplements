"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { OrderDetail } from "@/lib/customer-account/types";
import { ErrorBlock, formatDate, formatMoney, LoadingBlock, PageHeading, useAccountData } from "../../account-client";
import { orderStatus } from "../../order-parts";

const SHIPMENT: Record<string, string> = {
  DELIVERED: "Delivered", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery", ATTEMPTED_DELIVERY: "Delivery attempted", DELAYED: "Delayed",
  LABEL_PRINTED: "Label created", LABEL_PURCHASED: "Label created", CONFIRMED: "Confirmed", READY_FOR_PICKUP: "Ready for pickup", PICKED_UP: "Picked up", CARRIER_PICKED_UP: "With the carrier", FAILURE: "Delivery problem",
};

export default function OrderPage() {
  const {id} = useParams<{id: string}>();
  const valid = /^\d{1,20}$/.test(id);
  const order = useAccountData<OrderDetail>(valid ? `/api/account/orders/${id}` : null);
  const back = <Link className="account-back" href="/account/orders"><ArrowLeft size={15}/>All orders</Link>;
  if (!valid) return <>{back}<ErrorBlock message="We couldn’t find that order."/></>;
  if (order.status === "loading") return <>{back}<PageHeading title="Order"/><LoadingBlock label="Loading order"/></>;
  if (order.status === "error" || !order.data) return <>{back}<PageHeading title="Order"/><ErrorBlock message={order.error} retry={order.reload}/></>;
  const o = order.data;
  const delivered = o.shipments.some(s => s.shipmentStatus === "DELIVERED");
  return <>
    {back}
    <PageHeading title={`Order ${o.name}`} action={o.statusPageUrl ? <a className="under-link" href={o.statusPageUrl} target="_blank" rel="noopener noreferrer">Order status page<ArrowUpRight size={15}/></a> : undefined}/>
    <p className="account-meta">Placed {formatDate(o.processedAt, {month: "long", day: "numeric", year: "numeric"})} · <span className="account-pill">{delivered && !o.cancelled ? "Delivered" : orderStatus(o)}</span>{o.confirmationNumber ? ` · Confirmation ${o.confirmationNumber}` : ""}</p>
    <div className="order-detail">
      <section className="account-section order-lines">
        {o.lines.map(line => <div className="order-line" key={line.id}>
          {line.image ? <img src={line.image} alt={line.alt}/> : <span className="order-thumb-blank" aria-hidden="true">{line.title.slice(0, 1)}</span>}
          <div><strong>{line.title}</strong><small>{[line.variantTitle && line.variantTitle !== "Default Title" ? line.variantTitle : "", `Qty ${line.quantity}`].filter(Boolean).join(" · ")}</small></div>
          <span>{formatMoney(line.total)}</span>
        </div>)}
        <dl className="order-totals">
          {o.subtotal && <div><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>}
          <div><dt>Shipping</dt><dd>{Number(o.shipping.amount) ? formatMoney(o.shipping) : "Free"}</dd></div>
          {o.tax && Number(o.tax.amount) > 0 && <div><dt>Tax</dt><dd>{formatMoney(o.tax)}</dd></div>}
          <div><dt>Total</dt><dd>{formatMoney(o.totalPrice)}</dd></div>
        </dl>
      </section>
      <aside className="order-side">
        {o.shippingAddress && <section><p className="eyebrow">SHIPPED TO</p><address>{o.shippingAddress.formatted.map((line, i) => <span key={i}>{line}</span>)}</address></section>}
        {o.shipments.length > 0 && <section><p className="eyebrow">TRACKING</p>{o.shipments.map(s => <div className="shipment" key={s.id}>
          <strong>{SHIPMENT[s.shipmentStatus || ""] || (s.status === "SUCCESS" ? "Shipped" : "Preparing")}</strong>
          {s.estimatedDeliveryAt && <small>Expected {formatDate(s.estimatedDeliveryAt, {month: "long", day: "numeric"})}</small>}
          {s.tracking.map((t, i) => t.url ? <a key={i} className="under-link" href={t.url} target="_blank" rel="noopener noreferrer">{[t.company, t.number].filter(Boolean).join(" ") || "Track package"}<ArrowUpRight size={14}/></a> : <small key={i}>{[t.company, t.number].filter(Boolean).join(" ")}</small>)}
        </div>)}</section>}
        {o.cancelled && <section><p className="eyebrow">CANCELLED</p><small>{o.cancelReason ? o.cancelReason.toLowerCase().replace(/_/g, " ") : "This order was cancelled."}</small></section>}
      </aside>
    </div>
  </>;
}
