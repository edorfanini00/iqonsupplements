import { money, type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";

/** Only known, label-derived supply durations can produce a daily price. */
export function dailyProductPrice(product: Product, price = product.price, currency = product.currency) {
  const days = productContent[product.id]?.supplyDays;
  if (product.pricePending || !days || days <= 0 || !Number.isFinite(price) || price <= 0) return null;
  // A different pack or variant can have a different supply duration.
  if (product.variants && product.variants.length > 1) return null;
  return money(price / days, currency);
}

export function ProductEssentials({ product, price, currency }: {
  product: Product; price?: number; currency?: string;
}) {
  const content = productContent[product.id];
  if (!content?.essentials) return null;
  const dailyPrice = dailyProductPrice(product, price, currency);
  return <div className="product-essentials">
    <dl aria-label="The essentials">{content.essentials.map(item => <div key={item.label}>
      <dt>{item.label}</dt><dd>{item.value}</dd>
    </div>)}</dl>
    {dailyPrice && <p><span>{dailyPrice} / day</span> at suggested use · {content.supplyDays}-day bottle</p>}
  </div>;
}
