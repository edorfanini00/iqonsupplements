/**
 * Accounting persistence: inventory items, stock purchases, and business
 * expenses. Pure Prisma CRUD — all Shopify-derived math (units sold, on-hand,
 * P&L) lives in lib/accounting/report.ts. Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { shopifyCoversPending } from "@/lib/accounting/pending-products";

export interface InventoryPurchaseDto {
  id: string;
  itemId: string;
  shopifyProductId: number;
  productName: string;
  units: number;
  totalCost: number;
  costPerUnit: number;
  note: string | null;
  purchasedAt: string;
  createdAt: string;
  /** Set when the line was recorded as part of a multi-item supplier order. */
  orderId: string | null;
}

export interface SupplierOrderLineDto {
  id: string;
  shopifyProductId: number;
  productName: string;
  units: number;
  totalCost: number;
  costPerUnit: number;
}

export interface SupplierOrderDto {
  id: string;
  supplier: string | null;
  note: string | null;
  orderedAt: string;
  /** Null while in transit; stock counts only once this is set. */
  arrivedAt: string | null;
  createdAt: string;
  totalCost: number;
  totalUnits: number;
  lines: SupplierOrderLineDto[];
}

export interface InventoryItemDto {
  id: string;
  shopifyProductId: number;
  name: string;
  lowStockThreshold: number;
  /** Total units ever purchased. */
  unitsPurchased: number;
  /** Total spent across purchases. */
  totalSpent: number;
  /** Weighted average cost per unit (totalSpent / unitsPurchased). */
  avgCostPerUnit: number;
  /** ISO date of the earliest purchase — sales are deducted from this date. */
  trackingSince: string | null;
}

export type ManualSaleKind = "sale" | "giveaway";

export interface ManualSaleDto {
  id: string;
  shopifyProductId: number;
  productName: string;
  /** "sale" = revenue + stock deduction; "giveaway" = stock deduction only. */
  kind: ManualSaleKind;
  units: number;
  totalAmount: number;
  pricePerUnit: number;
  note: string | null;
  soldAt: string;
  createdAt: string;
}

export interface InventoryAdjustmentDto {
  id: string;
  shopifyProductId: number;
  productName: string;
  /** Positive = units added (found/recount), negative = units removed (lost/missing). */
  delta: number;
  reason: string | null;
  adjustedAt: string;
  createdAt: string;
}

export interface BusinessExpenseDto {
  id: string;
  label: string;
  category: string | null;
  amount: number;
  note: string | null;
  incurredAt: string;
  createdAt: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Purchase lines that actually count toward stock/COGS: standalone entries,
 * plus supplier-order lines whose order has been marked arrived. Lines on
 * in-transit orders are excluded everywhere until arrival.
 */
const ARRIVED_PURCHASES: Prisma.InventoryPurchaseWhereInput = {
  OR: [{ orderId: null }, { order: { arrivedAt: { not: null } } }],
};

// ---------------------------------------------------------------------------
// Inventory items + purchases
// ---------------------------------------------------------------------------

type ItemWithPurchases = {
  id: string;
  shopifyProductId: number;
  name: string;
  lowStockThreshold: number;
  purchases: { units: number; totalCost: number; purchasedAt: Date }[];
};

function mapItem(row: ItemWithPurchases): InventoryItemDto {
  const unitsPurchased = row.purchases.reduce((acc, p) => acc + p.units, 0);
  const totalSpent = row.purchases.reduce((acc, p) => acc + p.totalCost, 0);
  const earliest = row.purchases.reduce<Date | null>(
    (min, p) => (min === null || p.purchasedAt < min ? p.purchasedAt : min),
    null
  );
  return {
    id: row.id,
    shopifyProductId: row.shopifyProductId,
    name: row.name,
    lowStockThreshold: row.lowStockThreshold,
    unitsPurchased,
    totalSpent: round2(totalSpent),
    avgCostPerUnit: unitsPurchased > 0 ? round2(totalSpent / unitsPurchased) : 0,
    trackingSince: earliest ? earliest.toISOString() : null,
  };
}

export async function listInventoryItems(): Promise<InventoryItemDto[]> {
  const rows = await prisma.inventoryItem.findMany({
    include: {
      purchases: {
        where: ARRIVED_PURCHASES,
        select: { units: true, totalCost: true, purchasedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map(mapItem);
}

export async function listPurchases(limit = 500): Promise<InventoryPurchaseDto[]> {
  const rows = await prisma.inventoryPurchase.findMany({
    where: ARRIVED_PURCHASES,
    include: { item: { select: { shopifyProductId: true, name: true } } },
    orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    itemId: row.itemId,
    shopifyProductId: row.item.shopifyProductId,
    productName: row.item.name,
    units: row.units,
    totalCost: round2(row.totalCost),
    costPerUnit: row.units > 0 ? round2(row.totalCost / row.units) : 0,
    note: row.note,
    purchasedAt: row.purchasedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    orderId: row.orderId,
  }));
}

/**
 * Record a stock purchase. Upserts the inventory item for the Shopify product
 * (so the first purchase of a product starts tracking it) and refreshes the
 * stored product name.
 */
export async function createPurchase(input: {
  shopifyProductId: number;
  productName: string;
  units: number;
  totalCost: number;
  purchasedAt: Date;
  note?: string | null;
}): Promise<InventoryPurchaseDto> {
  const item = await prisma.inventoryItem.upsert({
    where: { shopifyProductId: input.shopifyProductId },
    create: { shopifyProductId: input.shopifyProductId, name: input.productName },
    update: { name: input.productName },
  });
  const row = await prisma.inventoryPurchase.create({
    data: {
      itemId: item.id,
      units: input.units,
      totalCost: input.totalCost,
      note: clean(input.note),
      purchasedAt: input.purchasedAt,
    },
  });
  return {
    id: row.id,
    itemId: item.id,
    shopifyProductId: item.shopifyProductId,
    productName: item.name,
    units: row.units,
    totalCost: round2(row.totalCost),
    costPerUnit: row.units > 0 ? round2(row.totalCost / row.units) : 0,
    note: row.note,
    purchasedAt: row.purchasedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    orderId: row.orderId,
  };
}

// ---------------------------------------------------------------------------
// Supplier orders (multi-item restocks)
// ---------------------------------------------------------------------------

type SupplierOrderRow = {
  id: string;
  supplier: string | null;
  note: string | null;
  orderedAt: Date;
  arrivedAt: Date | null;
  createdAt: Date;
  purchases: {
    id: string;
    units: number;
    totalCost: number;
    item: { shopifyProductId: number; name: string };
  }[];
};

function mapSupplierOrder(row: SupplierOrderRow): SupplierOrderDto {
  const lines = row.purchases.map((p) => ({
    id: p.id,
    shopifyProductId: p.item.shopifyProductId,
    productName: p.item.name,
    units: p.units,
    totalCost: round2(p.totalCost),
    costPerUnit: p.units > 0 ? round2(p.totalCost / p.units) : 0,
  }));
  return {
    id: row.id,
    supplier: row.supplier,
    note: row.note,
    orderedAt: row.orderedAt.toISOString(),
    arrivedAt: row.arrivedAt ? row.arrivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    totalCost: round2(lines.reduce((acc, l) => acc + l.totalCost, 0)),
    totalUnits: lines.reduce((acc, l) => acc + l.units, 0),
    lines,
  };
}

export async function listSupplierOrders(limit = 200): Promise<SupplierOrderDto[]> {
  const rows = await prisma.supplierOrder.findMany({
    include: {
      purchases: {
        select: {
          id: true,
          units: true,
          totalCost: true,
          item: { select: { shopifyProductId: true, name: true } },
        },
      },
    },
    orderBy: [{ orderedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(mapSupplierOrder);
}

/**
 * Record a multi-item supplier order: creates the order plus one purchase
 * line per product (upserting inventory items), all in one transaction.
 */
export async function createSupplierOrder(input: {
  supplier?: string | null;
  note?: string | null;
  orderedAt: Date;
  /** True for backfilled orders that already arrived — stock counts immediately. */
  arrived?: boolean;
  lines: {
    shopifyProductId: number;
    productName: string;
    units: number;
    totalCost: number;
  }[];
}): Promise<SupplierOrderDto> {
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierOrder.create({
      data: {
        supplier: clean(input.supplier),
        note: clean(input.note),
        orderedAt: input.orderedAt,
        arrivedAt: input.arrived ? input.orderedAt : null,
      },
    });
    for (const line of input.lines) {
      const item = await tx.inventoryItem.upsert({
        where: { shopifyProductId: line.shopifyProductId },
        create: { shopifyProductId: line.shopifyProductId, name: line.productName },
        update: { name: line.productName },
      });
      await tx.inventoryPurchase.create({
        data: {
          itemId: item.id,
          orderId: created.id,
          units: line.units,
          totalCost: line.totalCost,
          purchasedAt: input.orderedAt,
        },
      });
    }
    return tx.supplierOrder.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        purchases: {
          select: {
            id: true,
            units: true,
            totalCost: true,
            item: { select: { shopifyProductId: true, name: true } },
          },
        },
      },
    });
  });
  return mapSupplierOrder(order);
}

/**
 * Marks an in-transit supplier order as arrived: its purchase lines start
 * counting toward stock from the arrival date (the lines' purchasedAt moves to
 * arrival so stock trends and tracking windows reflect when units landed).
 */
export async function markSupplierOrderArrived(
  id: string
): Promise<SupplierOrderDto | null> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplierOrder.findUnique({ where: { id } });
      if (!existing) return null;
      const arrivedAt = existing.arrivedAt ?? new Date();
      if (!existing.arrivedAt) {
        await tx.supplierOrder.update({ where: { id }, data: { arrivedAt } });
        await tx.inventoryPurchase.updateMany({
          where: { orderId: id },
          data: { purchasedAt: arrivedAt },
        });
      }
      return tx.supplierOrder.findUniqueOrThrow({
        where: { id },
        include: {
          purchases: {
            select: {
              id: true,
              units: true,
              totalCost: true,
              item: { select: { shopifyProductId: true, name: true } },
            },
          },
        },
      });
    });
    return row ? mapSupplierOrder(row) : null;
  } catch {
    return null;
  }
}

/**
 * Delete a supplier order together with all of its purchase lines (cascade),
 * then drop any inventory items left without purchases.
 */
export async function deleteSupplierOrder(id: string): Promise<boolean> {
  try {
    const row = await prisma.supplierOrder.delete({
      where: { id },
      include: { purchases: { select: { itemId: true } } },
    });
    const itemIds = [...new Set(row.purchases.map((p) => p.itemId))];
    for (const itemId of itemIds) {
      const remaining = await prisma.inventoryPurchase.count({ where: { itemId } });
      if (remaining === 0) {
        await prisma.inventoryItem.delete({ where: { id: itemId } }).catch(() => {});
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function deletePurchase(id: string): Promise<boolean> {
  try {
    const row = await prisma.inventoryPurchase.delete({ where: { id } });
    // Drop the item when its last purchase is removed so it disappears from
    // the inventory table instead of lingering with 0 purchased units.
    const remaining = await prisma.inventoryPurchase.count({
      where: { itemId: row.itemId },
    });
    if (remaining === 0) {
      await prisma.inventoryItem.delete({ where: { id: row.itemId } }).catch(() => {});
    }
    // Drop a supplier order whose last line was just removed.
    if (row.orderId) {
      const linesLeft = await prisma.inventoryPurchase.count({
        where: { orderId: row.orderId },
      });
      if (linesLeft === 0) {
        await prisma.supplierOrder.delete({ where: { id: row.orderId } }).catch(() => {});
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function updateItemThreshold(
  itemId: string,
  lowStockThreshold: number
): Promise<boolean> {
  try {
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { lowStockThreshold },
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Manual (offline) sales
// ---------------------------------------------------------------------------

type ManualSaleRow = {
  id: string;
  shopifyProductId: number;
  productName: string;
  kind: string;
  units: number;
  totalAmount: number;
  note: string | null;
  soldAt: Date;
  createdAt: Date;
};

function mapManualSale(row: ManualSaleRow): ManualSaleDto {
  return {
    id: row.id,
    shopifyProductId: row.shopifyProductId,
    productName: row.productName,
    kind: row.kind === "giveaway" ? "giveaway" : "sale",
    units: row.units,
    totalAmount: round2(row.totalAmount),
    pricePerUnit: row.units > 0 ? round2(row.totalAmount / row.units) : 0,
    note: row.note,
    soldAt: row.soldAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listManualSales(limit = 1000): Promise<ManualSaleDto[]> {
  const rows = await prisma.manualSale.findMany({
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(mapManualSale);
}

export async function createManualSale(input: {
  shopifyProductId: number;
  productName: string;
  kind?: ManualSaleKind;
  units: number;
  totalAmount: number;
  soldAt: Date;
  note?: string | null;
}): Promise<ManualSaleDto> {
  const kind: ManualSaleKind = input.kind === "giveaway" ? "giveaway" : "sale";
  const row = await prisma.manualSale.create({
    data: {
      shopifyProductId: input.shopifyProductId,
      productName: input.productName.trim(),
      kind,
      // Giveaways never carry revenue, whatever the caller sent.
      totalAmount: kind === "giveaway" ? 0 : input.totalAmount,
      units: input.units,
      note: clean(input.note),
      soldAt: input.soldAt,
    },
  });
  return mapManualSale(row);
}

export async function deleteManualSale(id: string): Promise<boolean> {
  try {
    await prisma.manualSale.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inventory adjustments (manual add/deduct corrections)
// ---------------------------------------------------------------------------

function mapAdjustment(row: {
  id: string;
  shopifyProductId: number;
  productName: string;
  delta: number;
  reason: string | null;
  adjustedAt: Date;
  createdAt: Date;
}): InventoryAdjustmentDto {
  return {
    id: row.id,
    shopifyProductId: row.shopifyProductId,
    productName: row.productName,
    delta: row.delta,
    reason: row.reason,
    adjustedAt: row.adjustedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdjustments(limit = 1000): Promise<InventoryAdjustmentDto[]> {
  const rows = await prisma.inventoryAdjustment.findMany({
    orderBy: [{ adjustedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(mapAdjustment);
}

export async function createAdjustment(input: {
  shopifyProductId: number;
  productName: string;
  delta: number;
  reason?: string | null;
  adjustedAt: Date;
}): Promise<InventoryAdjustmentDto> {
  const row = await prisma.inventoryAdjustment.create({
    data: {
      shopifyProductId: input.shopifyProductId,
      productName: input.productName.trim(),
      delta: input.delta,
      reason: clean(input.reason),
      adjustedAt: input.adjustedAt,
    },
  });
  return mapAdjustment(row);
}

export async function deleteAdjustment(id: string): Promise<boolean> {
  try {
    await prisma.inventoryAdjustment.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Business expenses
// ---------------------------------------------------------------------------

export async function listExpenses(limit = 1000): Promise<BusinessExpenseDto[]> {
  const rows = await prisma.businessExpense.findMany({
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    category: row.category,
    amount: round2(row.amount),
    note: row.note,
    incurredAt: row.incurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createExpense(input: {
  label: string;
  category?: string | null;
  amount: number;
  incurredAt: Date;
  note?: string | null;
}): Promise<BusinessExpenseDto> {
  const row = await prisma.businessExpense.create({
    data: {
      label: input.label.trim(),
      category: clean(input.category),
      amount: input.amount,
      note: clean(input.note),
      incurredAt: input.incurredAt,
    },
  });
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    amount: round2(row.amount),
    note: row.note,
    incurredAt: row.incurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    await prisma.businessExpense.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function sumExpensesBetween(from: Date, to: Date): Promise<number> {
  const agg = await prisma.businessExpense.aggregate({
    _sum: { amount: true },
    where: { incurredAt: { gte: from, lt: to } },
  });
  return round2(agg._sum.amount ?? 0);
}

// ---------------------------------------------------------------------------
// Placeholder products (not yet in Shopify)
// ---------------------------------------------------------------------------

export interface PendingProductDto {
  id: string;
  syntheticId: number;
  name: string;
  createdAt: string;
  matchedShopifyId: number | null;
}

/** Placeholders that haven't been matched to a live Shopify product yet. */
export async function listUnmatchedPendingProducts(): Promise<PendingProductDto[]> {
  const rows = await prisma.pendingProduct.findMany({
    where: { matchedShopifyId: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    syntheticId: r.syntheticId,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
    matchedShopifyId: r.matchedShopifyId,
  }));
}

/** Create a placeholder with the next free synthetic id. */
export async function createPendingProduct(
  name: string
): Promise<PendingProductDto | { error: string }> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "Enter a product name." };
  if (clean.length > 120) return { error: "Name is too long." };

  const existing = await prisma.pendingProduct.findMany({
    select: { syntheticId: true, name: true, matchedShopifyId: true },
  });
  const dupe = existing.find(
    (p) =>
      p.matchedShopifyId === null &&
      p.name.trim().toLowerCase() === clean.toLowerCase()
  );
  if (dupe) return { error: `"${clean}" is already in the list.` };

  const maxId = existing.reduce((acc, p) => Math.max(acc, p.syntheticId), 0);
  const row = await prisma.pendingProduct.create({
    data: {
      name: clean,
      syntheticId: Math.max(910_000, maxId + 1),
    },
  });
  return {
    id: row.id,
    syntheticId: row.syntheticId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    matchedShopifyId: row.matchedShopifyId,
  };
}

/**
 * Link placeholder inventory to real Shopify products.
 *
 * Any inventory item still keyed by a synthetic id (>= 900000) whose name
 * matches a live Shopify product is remapped in place: the item plus its manual
 * sales and stock adjustments move to the real Shopify id. Purchases hang off the
 * item row, so they follow automatically — and from that moment Shopify orders
 * deduct this stock with no manual steps. Placeholder rows are marked matched
 * so they leave the picker.
 */
export async function reconcileSyntheticItems(
  shopifyProducts: { id: number; name: string }[]
): Promise<{ remapped: { from: number; to: number; name: string }[] }> {
  const remapped: { from: number; to: number; name: string }[] = [];
  if (shopifyProducts.length === 0) return { remapped };

  const allItems = await prisma.inventoryItem.findMany({
    select: { id: true, shopifyProductId: true, name: true },
  });
  const usedShopifyIds = new Set(allItems.map((i) => i.shopifyProductId));
  const syntheticItems = allItems.filter((i) => i.shopifyProductId >= 900_000);

  for (const item of syntheticItems) {
    const match = shopifyProducts.find((w) => shopifyCoversPending(w.name, item.name));
    // If another inventory item already tracks the real Shopify id (purchases were
    // recorded under both), leave it alone — merging money figures silently
    // would be worse than showing two rows.
    if (!match || usedShopifyIds.has(match.id)) continue;

    try {
      await prisma.$transaction([
        prisma.inventoryItem.update({
          where: { id: item.id },
          data: { shopifyProductId: match.id, name: match.name },
        }),
        prisma.manualSale.updateMany({
          where: { shopifyProductId: item.shopifyProductId },
          data: { shopifyProductId: match.id, productName: match.name },
        }),
        prisma.inventoryAdjustment.updateMany({
          where: { shopifyProductId: item.shopifyProductId },
          data: { shopifyProductId: match.id, productName: match.name },
        }),
        prisma.pendingProduct.updateMany({
          where: { syntheticId: item.shopifyProductId, matchedShopifyId: null },
          data: { matchedShopifyId: match.id, matchedAt: new Date() },
        }),
      ]);
      usedShopifyIds.add(match.id);
      remapped.push({ from: item.shopifyProductId, to: match.id, name: match.name });
    } catch (err) {
      console.error("[accounting] synthetic remap failed", {
        item: item.name,
        err,
      });
    }
  }

  // Placeholders that never got a purchase have no inventory item; still mark
  // them matched once the Shopify product exists so they drop out of the picker.
  const orphanPending = await prisma.pendingProduct.findMany({
    where: { matchedShopifyId: null },
  });
  for (const pending of orphanPending) {
    const match = shopifyProducts.find((w) => shopifyCoversPending(w.name, pending.name));
    if (!match) continue;
    await prisma.pendingProduct.update({
      where: { id: pending.id },
      data: { matchedShopifyId: match.id, matchedAt: new Date() },
    });
  }

  return { remapped };
}
