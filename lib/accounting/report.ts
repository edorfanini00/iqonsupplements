import { listPaidOrders, getProducts } from "@/lib/portal-commerce";
/**
 * Accounting computations derived from Shopify orders + the local
 * accounting tables: live inventory on-hand (purchased minus sold), low-stock
 * flags, and P&L summaries (revenue, COGS, expenses, margins, net profit).
 *
 * Read-only against Shopify — has its own order fetcher (with the totals
 * fields P&L needs) so shared modules stay untouched. Server-only.
 */

import {
  listAdjustments,
  listInventoryItems,
  listExpenses,
  listManualSales,
  listPurchases,
  type InventoryItemDto,
  type BusinessExpenseDto,
} from "@/lib/accounting/store";
import { prisma } from "@/lib/db/prisma";

interface AccountingOrder {
  id: number;
  number?: string;
  status: string;
  currency?: string;
  total?: string;
  total_tax?: string;
  shipping_total?: string;
  discount_total?: string;
  date_created?: string;
  date_paid?: string;
  shipping?: { country?: string };
  billing?: { first_name?: string; last_name?: string };
  line_items?: {
    product_id: number;
    quantity: number;
    name?: string;
    total?: string;
  }[];
  fee_lines?: { name?: string; total?: string }[];
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(v: string | undefined | null): number {
  const n = Number.parseFloat(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Fetch paid (processing/completed) orders with the totals fields accounting
 * needs, paginated newest-first. Optional date window filters on date_created.
 */
async function fetchPaidOrdersForAccounting(opts?: {
  after?: string;
  before?: string;
  maxPages?: number;
}): Promise<{ orders: AccountingOrder[]; truncated: boolean }> {
  return await listPaidOrders(opts) as {orders:AccountingOrder[];truncated:boolean};
}

// ---------------------------------------------------------------------------
// Inventory report
// ---------------------------------------------------------------------------

export interface InventoryReportRow extends InventoryItemDto {
  /** Units sold in paid Shopify orders since this item's first purchase entry. */
  unitsSold: number;
  /** Net manual corrections (positive found / negative missing). */
  unitsAdjusted: number;
  /** unitsPurchased − unitsSold + unitsAdjusted (negative = entries missing). */
  unitsOnHand: number;
  low: boolean;
}

export interface InventoryReport {
  items: InventoryReportRow[];
  lowCount: number;
  /** True when the Shopify order scan hit its pagination cap (counts may be partial). */
  truncated: boolean;
}

export async function getInventoryReport(): Promise<InventoryReport> {
  const [items, manualSales, adjustments] = await Promise.all([
    listInventoryItems(),
    listManualSales(),
    listAdjustments(),
  ]);
  if (items.length === 0) return { items: [], lowCount: 0, truncated: false };

  // Net manual correction per product — counted in full, whatever the date,
  // since an adjustment is an explicit statement about physical stock.
  const adjustedByProduct = new Map<number, number>();
  for (const adj of adjustments) {
    adjustedByProduct.set(
      adj.shopifyProductId,
      (adjustedByProduct.get(adj.shopifyProductId) ?? 0) + adj.delta
    );
  }

  // One Shopify scan from the earliest tracking date across all items; each item
  // then only counts orders on/after its own first purchase date.
  const earliest = items
    .map((i) => i.trackingSince)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  let truncated = false;
  const soldByProduct = new Map<number, { date: string; qty: number }[]>();
  if (earliest) {
    const result = await fetchPaidOrdersForAccounting({ after: earliest });
    truncated = result.truncated;
    for (const order of result.orders) {
      const date = order.date_paid || order.date_created || "";
      for (const li of order.line_items ?? []) {
        if (!li.product_id) continue;
        const list = soldByProduct.get(li.product_id) ?? [];
        list.push({ date, qty: li.quantity || 0 });
        soldByProduct.set(li.product_id, list);
      }
    }
  }

  // Offline (manual) sales AND free giveaways deduct stock exactly like Shopify
  // orders — a unit shipped for free is still a unit gone from the shelf.
  for (const sale of manualSales) {
    const list = soldByProduct.get(sale.shopifyProductId) ?? [];
    list.push({ date: sale.soldAt, qty: sale.units });
    soldByProduct.set(sale.shopifyProductId, list);
  }

  const liveStock = new Map((await getProducts()).map(p=>[p.id,p.stock_quantity]));
  const rows: InventoryReportRow[] = items.map((item) => {
    const sales = soldByProduct.get(item.shopifyProductId) ?? [];
    const since = item.trackingSince ?? "";
    const unitsSold = sales
      .filter((s) => !since || !s.date || s.date >= since)
      .reduce((acc, s) => acc + s.qty, 0);
    const unitsAdjusted = adjustedByProduct.get(item.shopifyProductId) ?? 0;
    const unitsOnHand = liveStock.get(item.shopifyProductId) ?? item.unitsPurchased - unitsSold + unitsAdjusted;
    return {
      ...item,
      unitsSold,
      unitsAdjusted,
      unitsOnHand,
      low: unitsOnHand <= item.lowStockThreshold,
    };
  });

  return {
    items: rows,
    lowCount: rows.filter((r) => r.low).length,
    truncated,
  };
}

// ---------------------------------------------------------------------------
// P&L summary
// ---------------------------------------------------------------------------

export interface ProductPnlRow {
  shopifyProductId: number;
  name: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
  /** Whether this product has inventory purchases (COGS available). */
  tracked: boolean;
}

/** Estimated real cost to ship one DOMESTIC (US) order (label + materials).
 *  We charge $15 flat domestically, so the ~$9/order spread is profit.
 *  International orders are charged the live carrier rate (e.g. $30) which is
 *  pass-through — no shipping profit is counted on them. */
export const SHIPPING_COST_PER_ORDER = Math.max(0, Number(process.env.SUPPLEMENTS_ESTIMATED_SHIPPING_COST_PER_ORDER ?? 6) || 0);

export interface PnlSummary {
  from: string;
  to: string;
  orderCount: number;
  /** Offline sales recorded manually within this period. */
  manualSalesCount: number;
  /** Revenue from those offline sales (included in `revenue`). */
  manualRevenue: number;
  /** Free giveaways (e.g. affiliate shipments) recorded within this period. */
  giveawayCount: number;
  /** Units given away for free — no revenue, but their cost is in `cogs`. */
  giveawayUnits: number;
  /** Cost of the given-away units (included in `cogs`). */
  giveawayCogs: number;
  /** Product revenue: Shopify line-item totals after discounts + order-level fee
   *  discounts (BOGO/Zelle) + offline sales. Excludes shipping and tax. */
  revenue: number;
  /** Shipping collected from customers. */
  shippingCollected: number;
  /** Estimated shipping cost: orderCount × SHIPPING_COST_PER_ORDER. */
  shippingCost: number;
  /** shippingCollected − shippingCost (counted as profit). */
  shippingProfit: number;
  /** Sales tax collected — excluded from profit. */
  taxCollected: number;
  /** Sum of order grand totals actually charged. */
  totalCollected: number;
  /** Cost of goods sold: units sold × weighted avg unit cost per product. */
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  /** Affiliate commissions owed on orders in this period (direct + network). */
  affiliateFees: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
  products: ProductPnlRow[];
  /** Products sold in the period with no purchase entries (COGS unknown). */
  untrackedProducts: string[];
  truncated: boolean;
  expenseEntries: BusinessExpenseDto[];
}

// ---------------------------------------------------------------------------
// Demand trends (monthly time series for charts)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  /** `YYYY-MM` bucket key. */
  date: string;
  unitsSold: number;
  revenue: number;
}

export interface ProductTrend {
  shopifyProductId: number;
  name: string;
  totalUnits: number;
  totalRevenue: number;
  points: { date: string; unitsSold: number }[];
}

export interface DemandTrends {
  months: string[];
  overall: TrendPoint[];
  byProduct: ProductTrend[];
  truncated: boolean;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Monthly units-sold and revenue over the trailing `months`, overall and per
 * product, zero-filled so every month appears on the chart. Product names
 * prefer the tracked inventory name, falling back to the Shopify line-item name.
 */
export async function getDemandTrends(months = 12): Promise<DemandTrends> {
  const safeMonths = Math.min(36, Math.max(1, months));
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (safeMonths - 1), 1)
  );

  const [items, manualSales, ordersResult] = await Promise.all([
    listInventoryItems(),
    listManualSales(),
    fetchPaidOrdersForAccounting({ after: start.toISOString() }),
  ]);

  const nameByProduct = new Map<number, string>();
  for (const item of items) nameByProduct.set(item.shopifyProductId, item.name);

  const monthList: string[] = [];
  for (let i = 0; i < safeMonths; i++) {
    monthList.push(
      monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)))
    );
  }
  const monthIndex = new Map(monthList.map((m, i) => [m, i]));

  const overallUnits = new Array(safeMonths).fill(0);
  const overallRevenue = new Array(safeMonths).fill(0);
  const productMap = new Map<
    number,
    { name: string; totalUnits: number; totalRevenue: number; units: number[] }
  >();

  for (const order of ordersResult.orders) {
    const dateStr = order.date_paid || order.date_created || "";
    if (!dateStr) continue;
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) continue;
    const idx = monthIndex.get(monthKey(parsed));
    if (idx == null) continue;

    for (const li of order.line_items ?? []) {
      const qty = li.quantity || 0;
      const rev = num(li.total);
      overallUnits[idx] += qty;
      overallRevenue[idx] += rev;

      let p = productMap.get(li.product_id);
      if (!p) {
        p = {
          name: nameByProduct.get(li.product_id) || li.name || `Product #${li.product_id}`,
          totalUnits: 0,
          totalRevenue: 0,
          units: new Array(safeMonths).fill(0),
        };
        productMap.set(li.product_id, p);
      }
      p.units[idx] += qty;
      p.totalUnits += qty;
      p.totalRevenue += rev;
    }
  }

  // Fold offline (manual) sales into the same monthly buckets. Giveaways are
  // excluded — nothing was sold, so they don't belong in demand/sales charts
  // (they still deduct inventory and appear in the stock history).
  for (const sale of manualSales) {
    if (sale.kind === "giveaway") continue;
    const parsed = new Date(sale.soldAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const idx = monthIndex.get(monthKey(parsed));
    if (idx == null) continue;

    overallUnits[idx] += sale.units;
    overallRevenue[idx] += sale.totalAmount;

    let p = productMap.get(sale.shopifyProductId);
    if (!p) {
      p = {
        name:
          nameByProduct.get(sale.shopifyProductId) ||
          sale.productName ||
          `Product #${sale.shopifyProductId}`,
        totalUnits: 0,
        totalRevenue: 0,
        units: new Array(safeMonths).fill(0),
      };
      productMap.set(sale.shopifyProductId, p);
    }
    p.units[idx] += sale.units;
    p.totalUnits += sale.units;
    p.totalRevenue += sale.totalAmount;
  }

  const overall: TrendPoint[] = monthList.map((m, i) => ({
    date: m,
    unitsSold: overallUnits[i],
    revenue: round2(overallRevenue[i]),
  }));

  const byProduct: ProductTrend[] = [...productMap.entries()]
    .map(([shopifyProductId, p]) => ({
      shopifyProductId,
      name: p.name,
      totalUnits: p.totalUnits,
      totalRevenue: round2(p.totalRevenue),
      points: monthList.map((m, i) => ({ date: m, unitsSold: p.units[i] })),
    }))
    .sort((a, b) => b.totalUnits - a.totalUnits);

  return { months: monthList, overall, byProduct, truncated: ordersResult.truncated };
}

export async function getPnlSummary(from: Date, to: Date): Promise<PnlSummary> {
  const [items, expenseEntries, manualSales, ordersResult] = await Promise.all([
    listInventoryItems(),
    listExpenses(),
    listManualSales(),
    fetchPaidOrdersForAccounting({
      after: from.toISOString(),
      before: to.toISOString(),
    }),
  ]);

  const costByProduct = new Map<number, InventoryItemDto>();
  for (const item of items) costByProduct.set(item.shopifyProductId, item);

  let revenue = 0;
  let shippingCollected = 0;
  let taxCollected = 0;
  let totalCollected = 0;
  let cogs = 0;

  const perProduct = new Map<number, ProductPnlRow>();
  const untracked = new Set<string>();

  let domesticOrderCount = 0;
  let domesticShippingCollected = 0;

  for (const order of ordersResult.orders) {
    shippingCollected += num(order.shipping_total);
    taxCollected += num(order.total_tax);
    totalCollected += num(order.total);

    // Country missing on some legacy orders → assume US (the common case).
    const country = String(order.shipping?.country ?? "US").trim().toUpperCase();
    if (country === "US" || country === "") {
      domesticOrderCount += 1;
      domesticShippingCollected += num(order.shipping_total);
    }

    for (const li of order.line_items ?? []) {
      const lineRevenue = num(li.total);
      revenue += lineRevenue;

      const item = costByProduct.get(li.product_id);
      const unitCost = item && item.avgCostPerUnit > 0 ? item.avgCostPerUnit : 0;
      const lineCogs = unitCost * (li.quantity || 0);
      cogs += lineCogs;

      const name = item?.name || li.name || `Product #${li.product_id}`;
      if (!item) untracked.add(name);

      const row = perProduct.get(li.product_id) ?? {
        shopifyProductId: li.product_id,
        name,
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        profit: 0,
        tracked: Boolean(item),
      };
      row.unitsSold += li.quantity || 0;
      row.revenue += lineRevenue;
      row.cogs += lineCogs;
      row.profit = row.revenue - row.cogs;
      perProduct.set(li.product_id, row);
    }

    // Order-level fees: negative fees are discounts (Labor Day promo, Zelle)
    // that reduce product revenue; positive fees add to it.
    for (const fee of order.fee_lines ?? []) {
      revenue += num(fee.total);
    }
  }

  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  // Offline (manual) sales in range: counted as product revenue with COGS,
  // exactly like a Shopify line item (no shipping or tax involved). Free giveaways
  // (e.g. stock shipped to affiliates) carry no revenue but their unit cost
  // still counts as COGS — giving product away is a real cost to the business.
  const manualInRange = manualSales.filter(
    (s) => s.soldAt >= fromIso && s.soldAt < toIso
  );
  let manualRevenue = 0;
  let manualSalesCount = 0;
  let giveawayCount = 0;
  let giveawayUnits = 0;
  let giveawayCogs = 0;
  for (const sale of manualInRange) {
    const isGiveaway = sale.kind === "giveaway";
    if (isGiveaway) {
      giveawayCount += 1;
      giveawayUnits += sale.units;
    } else {
      manualSalesCount += 1;
      manualRevenue += sale.totalAmount;
      revenue += sale.totalAmount;
    }

    const item = costByProduct.get(sale.shopifyProductId);
    const unitCost = item && item.avgCostPerUnit > 0 ? item.avgCostPerUnit : 0;
    const lineCogs = unitCost * sale.units;
    cogs += lineCogs;
    if (isGiveaway) giveawayCogs += lineCogs;

    const name = item?.name || sale.productName || `Product #${sale.shopifyProductId}`;
    if (!item) untracked.add(name);

    const row = perProduct.get(sale.shopifyProductId) ?? {
      shopifyProductId: sale.shopifyProductId,
      name,
      unitsSold: 0,
      revenue: 0,
      cogs: 0,
      profit: 0,
      tracked: Boolean(item),
    };
    row.unitsSold += sale.units;
    row.revenue += isGiveaway ? 0 : sale.totalAmount;
    row.cogs += lineCogs;
    row.profit = row.revenue - row.cogs;
    perProduct.set(sale.shopifyProductId, row);
  }

  const expensesInRange = expenseEntries.filter(
    (e) => e.incurredAt >= fromIso && e.incurredAt < toIso
  );
  const expenses = expensesInRange.reduce((acc, e) => acc + e.amount, 0);

  // Affiliate commissions owed on the orders in this period. Matched by the
  // Shopify order id so it lines up exactly with the revenue counted above, and
  // includes network/referral commission rows. Counts all statuses since the
  // commission is a real cost whether or not it's been paid out yet.
  // Commissions credited to admin (house) profiles are excluded — that money
  // stays in-house, so it's not a cost.
  const shopifyOrderIds = ordersResult.orders
    .map((o) => o.id)
    .filter((id): id is number => Number.isInteger(id));
  let affiliateFees = 0;
  if (shopifyOrderIds.length > 0) {
    try {
      const agg = await prisma.affiliateOrder.aggregate({
        _sum: { commission: true },
        where: {
          shopifyOrderId: { in: shopifyOrderIds },
          affiliate: { portalRole: { not: "admin" } },
        },
      });
      affiliateFees = round2(agg._sum.commission ?? 0);
    } catch (err) {
      console.error("[getPnlSummary] affiliate fee lookup failed", err);
    }
  }
  // Month-end sales bonuses have no Shopify order behind them, so they're picked
  // up by date instead — still a real payout cost of the period.
  try {
    const bonusAgg = await prisma.affiliateOrder.aggregate({
      _sum: { commission: true },
      where: {
        matchType: "bonus",
        createdAt: { gte: from, lt: to },
        affiliate: { portalRole: { not: "admin" } },
      },
    });
    affiliateFees = round2(affiliateFees + (bonusAgg._sum.commission ?? 0));
  } catch (err) {
    console.error("[getPnlSummary] bonus fee lookup failed", err);
  }

  // Shipping: domestic (US) orders pay a flat rate (currently $15) but cost
  // roughly SHIPPING_COST_PER_ORDER to ship — that spread is profit.
  // International orders are charged the live carrier rate, which is
  // pass-through (cost ≈ what was collected), so they contribute no shipping
  // profit. Collected sales tax is treated as profit per business policy.
  const internationalShippingCollected = shippingCollected - domesticShippingCollected;
  const shippingCost =
    domesticOrderCount * SHIPPING_COST_PER_ORDER + internationalShippingCollected;
  const shippingProfit = domesticShippingCollected - domesticOrderCount * SHIPPING_COST_PER_ORDER;

  const grossProfit = revenue - cogs;
  const netProfit =
    grossProfit + shippingProfit - affiliateFees - expenses;

  const products = [...perProduct.values()]
    .map((row) => ({
      ...row,
      revenue: round2(row.revenue),
      cogs: round2(row.cogs),
      profit: round2(row.profit),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    from: fromIso,
    to: toIso,
    orderCount: ordersResult.orders.length,
    manualSalesCount,
    manualRevenue: round2(manualRevenue),
    giveawayCount,
    giveawayUnits,
    giveawayCogs: round2(giveawayCogs),
    revenue: round2(revenue),
    shippingCollected: round2(shippingCollected),
    shippingCost: round2(shippingCost),
    shippingProfit: round2(shippingProfit),
    taxCollected: round2(taxCollected),
    totalCollected: round2(totalCollected),
    cogs: round2(cogs),
    grossProfit: round2(grossProfit),
    grossMarginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
    affiliateFees,
    expenses: round2(expenses),
    netProfit: round2(netProfit),
    netMarginPct: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
    products,
    untrackedProducts: [...untracked].sort(),
    truncated: ordersResult.truncated,
    expenseEntries: expensesInRange,
  };
}

// ---------------------------------------------------------------------------
// Per-product stock history (daily deductions + running on-hand + events)
// ---------------------------------------------------------------------------

export interface StockHistoryDay {
  /** YYYY-MM-DD */
  date: string;
  /** Units deducted that day (Shopify orders + offline sales). */
  deducted: number;
  /** Stock on hand at the end of that day. */
  onHand: number;
}

export interface StockHistoryEvent {
  /** ISO timestamp of the order/sale/purchase/adjustment. */
  date: string;
  type: "order" | "offline" | "giveaway" | "purchase" | "adjustment";
  /** e.g. "Order #672", "Offline sale", "Free shipment", "Stock purchase". */
  reference: string;
  /** Customer name for Shopify orders, note/reason for manual entries. */
  detail: string | null;
  /** Positive units: deducted for order/offline/negative adjustments, added
   *  for purchases/positive adjustments (see `adds`). */
  units: number;
  /** True when this event adds stock instead of deducting it. */
  adds?: boolean;
}

export interface StockHistory {
  itemId: string;
  shopifyProductId: number;
  name: string;
  days: StockHistoryDay[];
  /** Newest first. */
  events: StockHistoryEvent[];
  truncated: boolean;
}

const STOCK_HISTORY_MAX_DAYS = 90;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Builds the day-by-day stock picture for one tracked product: how many units
 * left each day (with the orders behind those numbers) and the running
 * on-hand level, using the same counting rules as the inventory report
 * (deductions start at the product's first purchase entry).
 */
export async function getStockHistory(itemId: string): Promise<StockHistory | null> {
  const items = await listInventoryItems();
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;

  const since = item.trackingSince ?? new Date().toISOString();

  const [allPurchases, manualSales, adjustments, ordersResult] = await Promise.all([
    listPurchases(),
    listManualSales(),
    listAdjustments(),
    fetchPaidOrdersForAccounting({ after: since }),
  ]);

  const purchases = allPurchases.filter((p) => p.itemId === itemId);

  const events: StockHistoryEvent[] = [];

  for (const p of purchases) {
    events.push({
      date: p.purchasedAt,
      type: "purchase",
      reference: "Stock purchase",
      detail: p.note,
      units: p.units,
      adds: true,
    });
  }

  for (const adj of adjustments) {
    if (adj.shopifyProductId !== item.shopifyProductId) continue;
    events.push({
      date: adj.adjustedAt,
      type: "adjustment",
      reference: adj.delta < 0 ? "Adjustment — missing" : "Adjustment — added",
      detail: adj.reason,
      units: Math.abs(adj.delta),
      adds: adj.delta > 0,
    });
  }

  for (const order of ordersResult.orders) {
    const date = order.date_paid || order.date_created || "";
    if (!date || date < since) continue;
    const units = (order.line_items ?? [])
      .filter((li) => li.product_id === item.shopifyProductId)
      .reduce((acc, li) => acc + (li.quantity || 0), 0);
    if (units <= 0) continue;
    const customer = [order.billing?.first_name, order.billing?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    events.push({
      date,
      type: "order",
      reference: `Order #${order.number ?? order.id}`,
      detail: customer || null,
      units,
    });
  }

  for (const sale of manualSales) {
    if (sale.shopifyProductId !== item.shopifyProductId) continue;
    if (sale.soldAt < since) continue;
    const isGiveaway = sale.kind === "giveaway";
    events.push({
      date: sale.soldAt,
      type: isGiveaway ? "giveaway" : "offline",
      reference: isGiveaway ? "Free shipment" : "Offline sale",
      detail: sale.note,
      units: sale.units,
    });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Daily buckets for the chart: last 90 days, but never before tracking began.
  const today = new Date();
  const todayKey = dayKey(today.toISOString());
  const windowStart = new Date(
    Math.max(
      new Date(since).getTime(),
      today.getTime() - (STOCK_HISTORY_MAX_DAYS - 1) * 86_400_000
    )
  );
  const startKey = dayKey(windowStart.toISOString());

  const dayKeys: string[] = [];
  for (
    let t = Date.UTC(
      windowStart.getUTCFullYear(),
      windowStart.getUTCMonth(),
      windowStart.getUTCDate()
    );
    ;
    t += 86_400_000
  ) {
    const key = dayKey(new Date(t).toISOString());
    dayKeys.push(key);
    if (key >= todayKey) break;
  }

  const deductedByDay = new Map<string, number>();
  const addedByDay = new Map<string, number>();
  // Opening balance at the window start: everything that happened before it.
  let opening = 0;
  for (const e of events) {
    const key = dayKey(e.date);
    const isAdd = e.type === "purchase" || e.adds === true;
    const delta = isAdd ? e.units : -e.units;
    if (key < startKey) {
      opening += delta;
    } else if (isAdd) {
      addedByDay.set(key, (addedByDay.get(key) ?? 0) + e.units);
    } else {
      deductedByDay.set(key, (deductedByDay.get(key) ?? 0) + e.units);
    }
  }

  let running = opening;
  const days: StockHistoryDay[] = dayKeys.map((key) => {
    const deducted = deductedByDay.get(key) ?? 0;
    running += (addedByDay.get(key) ?? 0) - deducted;
    return { date: key, deducted, onHand: running };
  });

  return {
    itemId: item.id,
    shopifyProductId: item.shopifyProductId,
    name: item.name,
    days,
    events,
    truncated: ordersResult.truncated,
  };
}
