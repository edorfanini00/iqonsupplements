"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { OrderSummary } from "@/lib/customer-account/types";
import { formatDate, formatMoney } from "./account-client";

const FULFILLMENT: Record<string, string> = {
  FULFILLED: "Shipped", PARTIALLY_FULFILLED: "Partly shipped", IN_PROGRESS: "Preparing", READY_FOR_PICKUP: "Ready for pickup",
  READY_FOR_DELIVERY: "Out for delivery", RESTOCKED: "Returned", ON_HOLD: "On hold",
};
export function orderStatus(order: Pick<OrderSummary, "cancelled" | "financialStatus" | "fulfillmentStatus">) {
  if (order.cancelled) return "Cancelled";
  if (order.financialStatus === "REFUNDED") return "Refunded";
  return FULFILLMENT[order.fulfillmentStatus] || "Processing";
}

export function OrderRow({order}: {order: OrderSummary}) {
  return <Link className="order-row" href={`/account/orders/${order.id}`}>
    <span className="order-thumbs" aria-hidden="true">{order.items.slice(0, 3).map((item, i) => item.image ? <img key={i} src={item.image} alt=""/> : <span key={i} className="order-thumb-blank">{item.title.slice(0, 1)}</span>)}</span>
    <span className="order-main"><strong>Order {order.name}</strong><small>{formatDate(order.processedAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}</small></span>
    <span className="order-state">{orderStatus(order)}</span>
    <span className="order-total">{formatMoney(order.totalPrice)}</span>
    <ArrowRight className="order-go" size={16} strokeWidth={1.5}/>
  </Link>;
}
