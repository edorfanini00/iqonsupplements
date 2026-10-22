"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { money, type ProductSellingPlan, type Purchase } from "@/lib/catalog";
import { STORE_POLICIES } from "@/lib/store-policies";

function cadence(interval?: string, count?: number) {
  const unit = interval?.toLowerCase();
  return unit && ["day", "week", "month", "year"].includes(unit) && count && count > 0
    ? `every ${count === 1 ? unit : `${count} ${unit}s`}` : undefined;
}

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
  const billing = cadence(plan?.billingInterval, plan?.billingIntervalCount);
  const delivery = cadence(plan?.deliveryInterval, plan?.deliveryIntervalCount);
  const monthly = plan?.billingInterval === "MONTH" && plan.billingIntervalCount === 1;
  const payPerDelivery = plan?.price === plan?.perDeliveryPrice;
  const comparable = !!plan && payPerDelivery && plan.currency === currency && oneTimePrice > plan.price;
  const saved = comparable ? Math.round((oneTimePrice - plan.price) * 100) / 100 : 0;
  const saving = saved ? Math.round(saved / oneTimePrice * 100) : 0;
  const phased = plan?.recurringPrice !== undefined;
  const billingCopy = billing || "per billing cycle";
  return <div className="product-purchase-choices">
    <RadioGroup className="purchase-options" value={purchase} onValueChange={value => setPurchase(value as Purchase)} aria-label="Purchase option">
      {plan && <div className="subscription-choice">
        <label className={`purchase-option subscription-option ${purchase === "subscription" ? "selected" : ""}`}>
          <RadioGroupItem value="subscription"/>
          <span><strong>{saving ? `Subscribe & save ${saving}%` : "Subscribe"}{phased && saving > 0 && <em className="subscription-saving">Save {saving}% initially</em>}</strong>
            <small>{saved ? `Save ${money(saved, currency)} ${phased ? "on your first order" : "every order"}` : "Automatic recurring deliveries"}</small>
          </span>
          <span className="subscription-price">{saved > 0 && <s>{money(oneTimePrice, currency)}</s>}<b>{money(plan.price, plan.currency)}</b><small>{billing || "per billing cycle"}</small></span>
        </label>
        {purchase === "subscription" && plan && <div className="subscription-details">
          {plans.length > 1 && <div className="subscription-schedule"><label htmlFor={selectId}>Delivery plan</label>
            <select id={selectId} value={plan.id} onChange={event => setPlanId(event.target.value)}>
              {plans.map(option => <option key={option.id} value={option.id}>{option.name} · {money(option.price, option.currency)}</option>)}
            </select>
          </div>}
          <ul className="subscription-benefits">
            {saving > 0 && <li>{saving}% off {phased ? "your first order" : "every order"}{monthly && !phased && ` · Save ${money(saved, currency)} a month`}</li>}
            <li>Free to skip or cancel anytime</li>
            <li>{delivery ? `Ships ${delivery} automatically` : "Automatic recurring deliveries"}</li>
          </ul>
          <p className="subscription-terms">{phased
            ? `${money(plan.price, plan.currency)} for ${plan.initialOrderCount === 1 ? "the first order" : plan.initialOrderCount ? `the first ${plan.initialOrderCount} orders` : "the initial billing period"}, then ${money(plan.recurringPrice!, plan.currency)} ${billingCopy}.`
            : `${money(plan.price, plan.currency)} ${billingCopy}.`}
            {!payPerDelivery && ` ${money(plan.perDeliveryPrice, plan.currency)} per delivery.`}
            {" "}Renews and charges automatically. Skip or cancel anytime from your <a href="/account">account</a>. Shipping and taxes calculated at checkout. See the <a href={STORE_POLICIES.subscription.href} rel="noopener">cancellation policy</a>.
          </p>
          {plan.description && <p className="subscription-description">{plan.description}</p>}
        </div>}
      </div>}
      {!requiresSellingPlan && <label className={`purchase-option ${purchase === "once" ? "selected" : ""}`}>
        <RadioGroupItem value="once"/>
        <span><strong>One time purchase</strong><small>Order whenever you need</small></span>
        <b>{money(oneTimePrice, currency)}</b>
      </label>}
    </RadioGroup>

  </div>;
}
