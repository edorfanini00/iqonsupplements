"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import type { SubscriptionAction, SubscriptionDetail } from "@/lib/customer-account/types";
import { AccountRequestError, cadenceLabel, ErrorBlock, formatDate, formatMoney, LoadingBlock, PageHeading, useAccountData, useAccountMutation } from "../../account-client";
import { ConfirmDialog } from "../../confirm";
import { StatusPill } from "../../subscription-parts";

const BRAND: Record<string, string> = {visa: "Visa", mastercard: "Mastercard", master: "Mastercard", american_express: "American Express", amex: "American Express", discover: "Discover", jcb: "JCB", diners_club: "Diners Club"};

export default function SubscriptionPage() {
  const {id} = useParams<{id: string}>();
  const valid = /^\d{1,20}$/.test(id);
  const subscription = useAccountData<SubscriptionDetail>(valid ? `/api/account/subscriptions/${id}` : null);
  const send = useAccountMutation();
  const [busy, setBusy] = useState<string>("");
  const [message, setMessage] = useState<{text: string; error: boolean} | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "pause" | null>(null);
  const back = <Link className="account-back" href="/account/subscriptions"><ArrowLeft size={15}/>All subscriptions</Link>;
  if (!valid) return <>{back}<ErrorBlock message="We couldn’t find that subscription."/></>;
  if (subscription.status === "loading") return <>{back}<PageHeading title="Subscription"/><LoadingBlock label="Loading subscription"/></>;
  if (subscription.status === "error" || !subscription.data) return <>{back}<PageHeading title="Subscription"/><ErrorBlock message={subscription.error} retry={subscription.reload}/></>;
  const s = subscription.data;
  const can = (action: SubscriptionAction) => s.actions.includes(action);
  const title = s.lines.length === 1 ? s.lines[0].title : `${s.lines.length} products`;

  async function act(action: SubscriptionAction, extra: Record<string, unknown> = {}, key: string = action) {
    setBusy(key); setMessage(null);
    try {
      const updated = await send<SubscriptionDetail>(`/api/account/subscriptions/${id}/actions`, "POST", {action, ...extra});
      subscription.setData(updated);
      setMessage({text: {pause: "Your subscription is paused.", resume: "Your subscription is active again.", cancel: "Your subscription is cancelled.", skip: "That delivery is skipped.", unskip: "That delivery is back on."}[action], error: false});
    } catch (error) {
      setMessage({text: error instanceof AccountRequestError ? error.message : "Something went wrong. Please try again.", error: true});
      if (error instanceof AccountRequestError && error.status === 409) void subscription.reload();
    } finally { setBusy(""); }
  }

  const nextCycle = s.upcoming.find(c => !c.billed);
  return <>
    {back}
    <PageHeading title={title} action={<StatusPill status={s.status}/>}/>
    <p className="account-meta">{cadenceLabel(s.delivery)}{s.status === "ACTIVE" && s.nextBillingDate ? ` · Next order ${formatDate(s.nextBillingDate, {month: "long", day: "numeric"})}` : ""}{s.managedBy ? ` · Managed by ${s.managedBy}` : ""}</p>
    {message && <p className={message.error ? "account-error-inline" : "account-success"} role={message.error ? "alert" : "status"}>{message.text}</p>}
    {s.lastPaymentFailed && <p className="account-error-inline" role="alert">The last payment for this subscription didn’t go through. Update the payment method with Shopify to continue.</p>}

    <div className="subscription-detail">
      <section className="account-section">
        <div className="order-lines">{s.lines.map(line => <div className="order-line" key={line.id}>
          {line.image ? <img src={line.image} alt={line.alt}/> : <span className="order-thumb-blank" aria-hidden="true">{line.title.slice(0, 1)}</span>}
          <div><strong>{line.title}</strong><small>{[line.variantTitle && line.variantTitle !== "Default Title" ? line.variantTitle : "", `Qty ${line.quantity}`].filter(Boolean).join(" · ")}</small></div>
          <span>{formatMoney(line.price)}</span>
        </div>)}
          <dl className="order-totals"><div><dt>Shipping per order</dt><dd>{Number(s.deliveryPrice.amount) ? formatMoney(s.deliveryPrice) : "Free"}</dd></div></dl>
        </div>

        {s.actions.length > 0 && <div className="subscription-actions">
          {can("pause") && <button className="button button-outline" disabled={!!busy} onClick={() => setConfirm("pause")}>{busy === "pause" ? "Pausing…" : "Pause subscription"}</button>}
          {can("resume") && <button className="button button-dark" disabled={!!busy} onClick={() => void act("resume")}>{busy === "resume" ? "Resuming…" : "Resume subscription"}</button>}
          {can("cancel") && <button className="quiet-button subscription-cancel" disabled={!!busy} onClick={() => setConfirm("cancel")}>{busy === "cancel" ? "Cancelling…" : "Cancel subscription"}</button>}
        </div>}

        {s.status === "ACTIVE" && s.upcoming.length > 0 && <div className="subscription-upcoming">
          <h2>Upcoming orders</h2>
          <ul>{s.upcoming.map(cycle => <li key={cycle.cycleIndex} className={cycle.skipped ? "is-skipped" : ""}>
            <span>{formatDate(cycle.date, {weekday: "short", month: "long", day: "numeric"})}{cycle.skipped && <small>Skipped</small>}</span>
            {!cycle.billed && can(cycle.skipped ? "unskip" : "skip") && <button className="under-link" disabled={!!busy} onClick={() => void act(cycle.skipped ? "unskip" : "skip", {cycleIndex: cycle.cycleIndex}, `cycle-${cycle.cycleIndex}`)}>
              {busy === `cycle-${cycle.cycleIndex}` ? "Saving…" : cycle.skipped ? "Undo skip" : cycle === nextCycle ? "Skip next order" : "Skip"}</button>}
          </li>)}</ul>
        </div>}

        {s.actions.length === 0 && ["ACTIVE", "PAUSED", "FAILED"].includes(s.status) && <p className="account-note">{s.managementUrl ? "Changes to this subscription are made on Shopify’s subscription page." : "Changes to this subscription are handled by our team. Contact us and we’ll take care of it."} </p>}
      </section>

      <aside className="order-side">
        <section>
          <p className="eyebrow">SUBSCRIPTION DELIVERY ADDRESS</p>
          {s.deliveryAddress ? <address>{s.deliveryAddress.lines.map((line, i) => <span key={i}>{line}</span>)}</address> : s.pickup ? <address><span>Pickup: {s.pickup}</span></address> : <small>No delivery address on this subscription.</small>}
          <small className="account-hint">Used only for this subscription. Your saved addresses don’t change it.</small>
        </section>
        <section>
          <p className="eyebrow">PAYMENT FOR THIS SUBSCRIPTION</p>
          {s.payment?.kind === "card" ? <p className="payment-line">{BRAND[s.payment.brand.toLowerCase()] || s.payment.brand} ending {s.payment.lastDigits}<small>Expires {s.payment.expires}{s.payment.expiresSoon ? " · expiring soon" : ""}</small></p>
            : s.payment?.kind === "bank" ? <p className="payment-line">{s.payment.bankName} ending {s.payment.lastDigits}</p>
            : s.payment?.kind === "other" ? <p className="payment-line">Saved payment method</p>
            : s.payment?.kind === "unavailable" ? <p className="payment-line">Managed by Shopify<small>Shown on Shopify’s subscription page.</small></p>
            : <small>No payment method on file.</small>}
          <small className="account-hint"><LockKeyhole size={12}/> Card details are stored and changed only by Shopify. IQON never sees your full card number.</small>
          {s.managementUrl ? <a className="under-link" href={s.managementUrl}>Update payment or address with Shopify<ArrowUpRight size={14}/></a>
            : <small className="account-hint">To change the card or delivery address on this subscription, <Link href="/help">contact us</Link>.</small>}
        </section>
        <section>
          <p className="eyebrow">DELIVERY FREQUENCY</p>
          <small>{cadenceLabel(s.delivery)}. To change how often it arrives, <Link href="/help">contact us</Link>.</small>
        </section>
        {s.orders.length > 0 && <section>
          <p className="eyebrow">ORDERS FROM THIS SUBSCRIPTION</p>
          {s.orders.map(order => <Link key={order.id} className="under-link" href={`/account/orders/${order.id}`}>Order {order.name} · {formatDate(order.processedAt)}</Link>)}
        </section>}
      </aside>
    </div>

    <ConfirmDialog open={confirm === "cancel"} onOpenChange={open => !open && setConfirm(null)} title="Cancel this subscription?"
      description="No further orders will be placed or charged. Orders already placed aren’t affected." confirm="Cancel subscription"
      onConfirm={() => { setConfirm(null); void act("cancel", {confirm: true}); }}/>
    <ConfirmDialog open={confirm === "pause"} onOpenChange={open => !open && setConfirm(null)} title="Pause this subscription?"
      description="No orders will be placed or charged until you resume." confirm="Pause subscription" cancel="Not now"
      onConfirm={() => { setConfirm(null); void act("pause"); }}/>
  </>;
}
