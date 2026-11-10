"use client";

import type { KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { money } from "@/lib/catalog";
import { BUNDLE_OFFERS, tierUnitPrice, type BundleFamily } from "@/lib/bundle-offer";

function navigateBundle(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const current = event.currentTarget;
  const group = current.closest('[role="radiogroup"]');
  if (!group || event.target !== current) return;
  let key = event.key;
  if (getComputedStyle(group).direction === "rtl") {
    if (key === "ArrowLeft") key = "ArrowRight";
    else if (key === "ArrowRight") key = "ArrowLeft";
  }
  const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    .filter(radio => !radio.disabled && radio.getAttribute("aria-disabled") !== "true");
  const index = radios.indexOf(current);
  if (index < 0) return;
  let next: number;
  if (key === "Home" || key === "PageUp") next = 0;
  else if (key === "End" || key === "PageDown") next = radios.length - 1;
  else if (key === "ArrowDown" || key === "ArrowRight") next = (index + 1) % radios.length;
  else if (key === "ArrowUp" || key === "ArrowLeft") next = (index + radios.length - 1) % radios.length;
  else return;

  // Cancel Radix's deferred focus: keyup can otherwise clear its select-on-focus flag.
  // Commit the normal radio click before focusing, so even a held/repeated arrow's
  // Radix focus handler sees the checked radio and cannot select it a second time.
  event.preventDefault();
  flushSync(() => radios[next].click());
  radios[next].focus();
}

/** Quick quantity choices for every purchasable product, with savings only for approved bundles.
 * `family` selects that product's own bundle (supplements or skincare); its tiers, terms and
 * counting never mix with the other family. */
export function ProductBundleOptions({ quantity, setQuantity, price, currency, bundleEligible = true, family = "supplements" }: {
  quantity: number;
  setQuantity: (value: number) => void;
  price: number;
  currency: string;
  bundleEligible?: boolean;
  family?: BundleFamily;
}) {
  const { tiers: BUNDLE_TIERS, terms } = BUNDLE_OFFERS[family];
  const options = [
    {quantity: 1, label: "Buy 1", detail: "One time purchase", unit: price},
    ...BUNDLE_TIERS.map((tier, i) => ({quantity: tier.minQuantity, label: `Buy ${tier.minQuantity}${i === BUNDLE_TIERS.length - 1 ? "+" : ""}`,
      detail: bundleEligible ? `Save ${tier.percent}% on each` : "One time purchase", unit: bundleEligible ? tierUnitPrice(price, tier.percent) : price})),
  ];
  const top = options[options.length - 1].quantity;
  const selected = String(Math.min(quantity, top));
  return <div className="product-purchase-choices bundle-choices">
    <p className="bundle-heading"><strong>{bundleEligible ? "Bundle and save" : "Choose quantity"}</strong>{bundleEligible && <span>{BUNDLE_TIERS.map((tier, i) => `Buy ${tier.minQuantity}${i === BUNDLE_TIERS.length - 1 ? "+" : ""}, save ${tier.percent}%`).join(" · ")}</span>}</p>
    <RadioGroup className="purchase-options" value={selected} onValueChange={value => setQuantity(Number(value))} aria-label={bundleEligible ? "Bundle quantity" : "Purchase quantity"}>
      {options.map(option => <label key={option.quantity} className={`purchase-option bundle-option ${selected === String(option.quantity) ? "selected" : ""}`}>
        <RadioGroupItem value={String(option.quantity)} onKeyDown={navigateBundle}/>
        <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        <b>{money(option.unit, currency)}<small>each</small></b>
      </label>)}
    </RadioGroup>
    {bundleEligible ? <p className="bundle-terms">{terms}</p> : <p className="bundle-terms">This product is not part of the bundle offer. Each quantity is charged at the regular price.</p>}
  </div>;
}
