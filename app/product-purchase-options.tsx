"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { money, type ProductSellingPlan, type Purchase } from "@/lib/catalog";

export function ProductPurchaseOptions({ purchase, setPurchase, plan, plans, setPlanId, oneTimePrice, currency, requiresSellingPlan = false }: {
  purchase: Purchase;
  setPurchase: (value: Purchase) => void;
  plan?: ProductSellingPlan;
  plans: ProductSellingPlan[];
  setPlanId: (id: string) => void;
  oneTimePrice: number;
  currency: string;
  requiresSellingPlan?: boolean;
}) {
  const selectId = useId();
  const saving = plan && plan.compareAtPrice > plan.price
    ? Math.round((1 - plan.price / plan.compareAtPrice) * 100) : 0;
  return <div className="product-purchase-choices">
    <RadioGroup className="purchase-options" value={purchase} onValueChange={value => setPurchase(value as Purchase)} aria-label="Purchase option">
      {!requiresSellingPlan && <label className={`purchase-option ${purchase === "once" ? "selected" : ""}`}>
        <RadioGroupItem value="once"/>
        <span><strong>One-time purchase</strong><small>Choose your own rhythm</small></span>
        <b>{money(oneTimePrice, currency)}</b>
      </label>}
      {plan && <label className={`purchase-option ${purchase === "subscription" ? "selected" : ""}`}>
        <RadioGroupItem value="subscription"/>
        <span><strong>{saving ? "Subscribe & save" : "Subscribe"}{saving > 0 && <em className="subscription-saving">Save {saving}%{plan.recurringPrice !== undefined ? " initially" : ""}</em>}</strong><small>Automatic recurring deliveries</small></span>
        <b>{money(plan.price, plan.currency)}</b>
      </label>}
    </RadioGroup>
    {purchase === "subscription" && plan && <div className="subscription-details">
      {plans.length > 1 ? <div className="subscription-schedule"><label htmlFor={selectId}>Delivery plan</label>
        <select id={selectId} value={plan.id} onChange={event => setPlanId(event.target.value)}>
          {plans.map(option => <option key={option.id} value={option.id}>{option.name} · {money(option.price, option.currency)}</option>)}
        </select>
      </div> : <p className="subscription-plan-name">{plan.name}</p>}
      <p className="subscription-terms">{plan.recurringPrice !== undefined
        ? `${money(plan.price, plan.currency)} for ${plan.initialOrderCount === 1 ? "the first order" : plan.initialOrderCount ? `the first ${plan.initialOrderCount} orders` : "the initial billing period"}, then ${money(plan.recurringPrice, plan.currency)} per billing cycle.`
        : `${money(plan.price, plan.currency)} per billing cycle.`}
        {plan.perDeliveryPrice !== plan.price && ` ${money(plan.perDeliveryPrice, plan.currency)} per delivery.`}
        {" "}Renews automatically. Shipping, taxes and subscription terms are shown at checkout.
      </p>
      {plan.description && <p className="subscription-description">{plan.description}</p>}
    </div>}
  </div>;
}
