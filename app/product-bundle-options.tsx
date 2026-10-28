"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { money } from "@/lib/catalog";
import { BUNDLE_EXCLUDED_NOTE, BUNDLE_TIERS, tierUnitPrice } from "@/lib/bundle-offer";

/** Quick quantity choice for bundle eligible supplements. Selecting a tier sets the quantity to add. */
export function ProductBundleOptions({ quantity, setQuantity, price, currency }: {
  quantity: number;
  setQuantity: (value: number) => void;
  price: number;
  currency: string;
}) {
  const options = [
    {quantity: 1, label: "Buy 1", detail: "One time purchase", unit: price},
    ...BUNDLE_TIERS.map((tier, i) => ({quantity: tier.minQuantity, label: `Buy ${tier.minQuantity}${i === BUNDLE_TIERS.length - 1 ? "+" : ""}`,
      detail: `Save ${tier.percent}% on each`, unit: tierUnitPrice(price, tier.percent)})),
  ];
  const top = options[options.length - 1].quantity;
  const selected = String(Math.min(quantity, top));
  return <div className="product-purchase-choices bundle-choices">
    <p className="bundle-heading"><strong>Bundle and save</strong><span>{BUNDLE_TIERS.map((tier, i) => `Buy ${tier.minQuantity}${i === BUNDLE_TIERS.length - 1 ? "+" : ""}, save ${tier.percent}%`).join(" · ")}</span></p>
    <RadioGroup className="purchase-options" value={selected} onValueChange={value => setQuantity(Number(value))} aria-label="Bundle quantity">
      {options.map(option => <label key={option.quantity} className={`purchase-option bundle-option ${selected === String(option.quantity) ? "selected" : ""}`}>
        <RadioGroupItem value={String(option.quantity)}/>
        <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        <b>{money(option.unit, currency)}<small>each</small></b>
      </label>)}
    </RadioGroup>
    <p className="bundle-terms">Mix and match any eligible IQON supplements: every eligible item in your bag counts toward the bundle. Savings apply automatically in your bag and at checkout, and can’t be combined with discount codes. {BUNDLE_EXCLUDED_NOTE}</p>
  </div>;
}
