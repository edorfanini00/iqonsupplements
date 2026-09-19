"use client";

import {accountingMutationFetch} from "@/lib/affiliates/accounting-mutation-fetch";
import { useLatestRead } from "@/lib/affiliates/use-latest-read";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Package,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Trash2,
  Plus,
  Loader2,
  DollarSign,
  Wallet,
  BarChart3,
  Users,
  LineChart,
  PieChart,
  HandCoins,
  X,
  ShoppingCart,
  PackageCheck,
  Search,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  SectionTitle,
  Pill,
  EmptyState,
  formatCurrency,
  formatShortDate,
} from "@/components/affiliates/shared/ui";
import { BarChart } from "@/components/affiliates/charts/BarChart";
import { AreaChart } from "@/components/affiliates/charts/AreaChart";
import { Donut } from "@/components/affiliates/charts/Donut";

// ---------------------------------------------------------------------------
// Types (mirror the API DTOs)
// ---------------------------------------------------------------------------

interface PickerProduct {
  id: number;
  name: string;
  price: string;
  pending?: boolean;
}

interface InventoryRow {
  id: string;
  wooProductId: number;
  name: string;
  lowStockThreshold: number;
  unitsPurchased: number;
  totalSpent: number;
  avgCostPerUnit: number;
  trackingSince: string | null;
  unitsSold: number;
  unitsAdjusted: number;
  unitsOnHand: number;
  low: boolean;
}

interface Adjustment {
  id: string;
  wooProductId: number;
  productName: string;
  /** Positive = units added, negative = units missing/removed. */
  delta: number;
  reason: string | null;
  adjustedAt: string;
  createdAt: string;
}

interface Purchase {
  id: string;
  wooProductId: number;
  productName: string;
  units: number;
  totalCost: number;
  costPerUnit: number;
  note: string | null;
  purchasedAt: string;
  orderId: string | null;
}

interface SupplierOrderLine {
  id: string;
  wooProductId: number;
  productName: string;
  units: number;
  totalCost: number;
  costPerUnit: number;
}

interface SupplierOrder {
  id: string;
  supplier: string | null;
  note: string | null;
  orderedAt: string;
  /** Null while in transit — stock only counts once marked arrived. */
  arrivedAt: string | null;
  totalCost: number;
  totalUnits: number;
  lines: SupplierOrderLine[];
}

/** One editable row of the multi-item order composer. */
interface OrderLineInput {
  key: number;
  productId: string;
  units: string;
  cost: string;
  costMode: "total" | "perUnit";
}

let orderLineKey = 1;
function newOrderLine(): OrderLineInput {
  return { key: orderLineKey++, productId: "", units: "", cost: "", costMode: "total" };
}

const ORDER_DRAFT_KEY = "iqon.accounting.supplierOrderDraft.v1";
interface OrderDraft {
  lines: Omit<OrderLineInput, "key">[];
  supplier: string;
  note: string;
  date: string;
  arrived: boolean;
  savedAt: string;
}

interface Expense {
  id: string;
  label: string;
  category: string | null;
  amount: number;
  note: string | null;
  incurredAt: string;
}

interface ManualSale {
  id: string;
  wooProductId: number;
  productName: string;
  /** "sale" = revenue + stock deduction; "giveaway" = free shipment, stock only. */
  kind: "sale" | "giveaway";
  units: number;
  totalAmount: number;
  pricePerUnit: number;
  note: string | null;
  soldAt: string;
}

interface ProductPnl {
  wooProductId: number;
  name: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
  tracked: boolean;
}

interface Summary {
  orderCount: number;
  manualSalesCount: number;
  manualRevenue: number;
  giveawayCount: number;
  giveawayUnits: number;
  giveawayCogs: number;
  revenue: number;
  shippingCollected: number;
  shippingCost: number;
  shippingProfit: number;
  taxCollected: number;
  totalCollected: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  affiliateFees: number;
  expenses: number;
  netProfit: number;
  netMarginPct: number;
  products: ProductPnl[];
  untrackedProducts: string[];
  truncated: boolean;
}

interface TrendPoint {
  date: string;
  unitsSold: number;
  revenue: number;
}

interface ProductTrend {
  wooProductId: number;
  name: string;
  totalUnits: number;
  totalRevenue: number;
  points: { date: string; unitsSold: number }[];
}

interface Trends {
  months: string[];
  overall: TrendPoint[];
  byProduct: ProductTrend[];
  truncated: boolean;
}

interface StockHistoryDay {
  date: string;
  deducted: number;
  onHand: number;
}

interface StockHistoryEvent {
  date: string;
  type: "order" | "offline" | "giveaway" | "purchase" | "adjustment";
  adds?: boolean;
  reference: string;
  detail: string | null;
  units: number;
}

interface StockHistory {
  itemId: string;
  wooProductId: number;
  name: string;
  days: StockHistoryDay[];
  events: StockHistoryEvent[];
  truncated: boolean;
}

type Tab = "overview" | "insights" | "inventory" | "purchases" | "sales" | "expenses";

type Period =
  | "last-7"
  | "last-30"
  | "last-90"
  | "this-month"
  | "last-month"
  | "this-year"
  | "all-time";

const PERIOD_LABELS: Record<Period, string> = {
  "last-7": "Last 7 days",
  "last-30": "Last 30 days",
  "last-90": "Last 90 days",
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "all-time": "All time",
};

const PERIOD_ORDER: Period[] = [
  "last-7",
  "last-30",
  "last-90",
  "this-month",
  "last-month",
  "this-year",
  "all-time",
];

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  switch (period) {
    case "last-7":
      return { from: daysAgo(7), to };
    case "last-30":
      return { from: daysAgo(30), to };
    case "last-90":
      return { from: daysAgo(90), to };
    case "this-month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "this-year":
      return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to };
    case "all-time":
      return { from: new Date("2020-01-01T00:00:00Z").toISOString(), to };
  }
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputCls =
  "w-full rounded-xl border border-[#242526]/12 bg-white/70 px-3.5 py-2.5 text-sm text-[#20282c] placeholder:text-[#64717a]/60 outline-none focus:border-[#242526]/40";
const labelCls =
  "block text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-1.5";
const primaryBtnCls =
  "inline-flex items-center gap-2 rounded-full bg-[#242526] text-white px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] font-sans hover:bg-[#242526]/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Searchable product picker: type to filter instead of scrolling the whole
 * catalog. `value` is the product id as a string ("" = nothing selected).
 */
function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = "Search products…",
}: {
  products: PickerProduct[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = products.find((p) => String(p.id) === value) ?? null;

  // Close when clicking anywhere outside the combobox.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : products;

  function pick(p: PickerProduct) {
    onChange(String(p.id));
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64717a] pointer-events-none" />
        <input
          value={open ? query : selected?.name ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={selected ? selected.name : placeholder}
          className={`${inputCls} pl-9`}
        />
        {selected && !open && (
          <button
            type="button"
            aria-label="Clear product"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#64717a] hover:bg-[#242526]/8 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-lg border border-[#242526]/12 bg-white shadow-[0_16px_40px_-16px_rgba(30,30,30,0.35)]">
          {filtered.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-[#64717a]">
              No products match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors hover:bg-[#242526]/5 ${
                  String(p.id) === value ? "bg-[#242526]/5 font-medium" : ""
                }`}
              >
                {p.name}
                {p.pending ? (
                  <span className="text-[#64717a]"> (coming soon)</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAccountingPage() {
  const [tab, setTab] = useState<Tab>("overview");

  // Shared data
  const [products, setProducts] = useState<PickerProduct[]>([]);
  // "Add new product" placeholder form + note when placeholders auto-link to Woo.
  const [npName, setNpName] = useState("");
  const [npSaving, setNpSaving] = useState(false);
  const [npError, setNpError] = useState<string | null>(null);
  const [npSuccess, setNpSuccess] = useState<string | null>(null);
  const [reconciledNote, setReconciledNote] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryTruncated, setInventoryTruncated] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<ManualSale[]>([]);

  // Overview
  const [period, setPeriod] = useState<Period>("this-month");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Insights (12-month demand trends)
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [demandProductId, setDemandProductId] = useState<string>("all");

  // Purchase entry mode: one product at a time, or a whole supplier order
  // with several products bought together.
  const [pMode, setPMode] = useState<"single" | "order">("single");

  // Multi-item order composer
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [oLines, setOLines] = useState<OrderLineInput[]>([newOrderLine()]);
  const [oSupplier, setOSupplier] = useState("");
  const [oDate, setODate] = useState(todayInputValue());
  const [oNote, setONote] = useState("");
  const [oArrived, setOArrived] = useState(false);
  const [oSaving, setOSaving] = useState(false);
  const [oError, setOError] = useState<string | null>(null);
  const [oDraftRestored, setODraftRestored] = useState(false);
  // Draft persistence: the supplier-order form used to be pure React state, so
  // a refresh / closed tab / navigating away before "Save order" silently lost
  // everything the user typed (Edoardo lost an in-transit order this way).
  // We mirror the form into localStorage and restore it on mount.
  const orderDraftLoaded = useRef(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Purchase composer.
  // costMode "total": you know what you paid in total (a real invoice).
  // costMode "perUnit": you only know the price per unit — used for opening
  // stock where the old invoice total is unknown (e.g. CJC already on hand).
  const [pProductId, setPProductId] = useState("");
  const [pUnits, setPUnits] = useState("");
  const [pCost, setPCost] = useState("");
  const [pCostMode, setPCostMode] = useState<"total" | "perUnit">("total");
  const [pDate, setPDate] = useState(todayInputValue());
  const [pNote, setPNote] = useState("");
  const [pSaving, setPSaving] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  // Stock history modal (opened by clicking an inventory row)
  const [historyItem, setHistoryItem] = useState<InventoryRow | null>(null);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Offline sale composer.
  // sKind "sale": money collected → revenue + stock deduction.
  // sKind "giveaway": free shipment (e.g. to an affiliate) → stock deduction
  // only, no revenue (the unit cost still shows up in COGS).
  const [sProductId, setSProductId] = useState("");
  const [sKind, setSKind] = useState<"sale" | "giveaway">("sale");
  const [sUnits, setSUnits] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDate, setSDate] = useState(todayInputValue());
  const [sNote, setSNote] = useState("");
  const [sSaving, setSSaving] = useState(false);
  const [sError, setSError] = useState<string | null>(null);

  // Stock adjustment composer (add found stock / deduct missing units)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [aProductId, setAProductId] = useState("");
  const [aDirection, setADirection] = useState<"deduct" | "add">("deduct");
  const [aUnits, setAUnits] = useState("");
  const [aReason, setAReason] = useState("");
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState<string | null>(null);

  // Expense composer
  const [eLabel, setELabel] = useState("");
  const [eCategory, setECategory] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState(todayInputValue());
  const [eNote, setENote] = useState("");
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Loaders
  // -------------------------------------------------------------------------

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/accounting/inventory", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setInventory(data.items ?? []);
        setInventoryTruncated(Boolean(data.truncated));
      }
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/purchases", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setPurchases(data.purchases ?? []);
    }
  }, []);

  const [ordersLoadError, setOrdersLoadError] = useState<string | null>(null);
  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/orders", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
      setOrdersLoadError(null);
    } else {
      // Keep whatever we had; never let a transient 5xx make orders "disappear".
      setOrdersLoadError(
        res ? `Could not load past orders (HTTP ${res.status}). Showing last known list.` : "Could not load past orders (network). Showing last known list."
      );
    }
  }, []);

  const loadSales = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/sales", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setSales(data.sales ?? []);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/expenses", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    }
  }, []);

  const loadAdjustments = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/adjustments", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setAdjustments(data.adjustments ?? []);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/affiliates/admin/accounting/products", {
      credentials: "include",
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
      // Placeholders that just got linked to live Woo products — surface it so
      // the admin knows stock carried over automatically.
      const linked = (data.reconciled ?? []) as { name: string }[];
      if (linked.length > 0) {
        setReconciledNote(
          linked.map((r) => r.name).join(", ")
        );
      }
    }
  }, []);

  const addPendingProduct = useCallback(async () => {
    const name = npName.trim();
    if (!name) {
      setNpError("Enter a product name, e.g. “Semaglutide 10mg”.");
      return;
    }
    setNpSaving(true);
    setNpError(null);
    setNpSuccess(null);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNpError(
          data?.error?.message || data?.error || "Failed to add product"
        );
        return;
      }
      setNpName("");
      setNpSuccess(name);
      await loadProducts();
    } catch {
      setNpError("Failed to add product");
    } finally {
      setNpSaving(false);
    }
  }, [npName, loadProducts]);

  const beginRead = useLatestRead();
  const [readError, setReadError] = useState<string | null>(null);
  const loadSummary = useCallback(async (p: Period) => {
    setSummaryLoading(true);
    const request = beginRead();
    setReadError(null); setSummary(null);
    try {
      const { from, to } = periodRange(p);
      const res = await fetch(
        `/api/affiliates/admin/accounting/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { credentials: "include", cache: "no-store", signal: request.signal }
      );
      if (!res.ok) throw new Error("Could not load data. Please retry.");
      if (res.ok) {
        const data = await res.json();
        if (!request.isCurrent()) return;
        setSummary(data.summary ?? null);
      }
    } catch {
      if (request.isCurrent()) setReadError("Could not load data. Please retry.");
    } finally {
      if (!request.isCurrent()) return;
      setSummaryLoading(false);
    }
  }, [beginRead]);

  const loadTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const res = await fetch("/api/affiliates/admin/accounting/trends?months=12", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTrends(data.trends ?? null);
      }
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
    loadPurchases();
    loadOrders();
    loadSales();
    loadExpenses();
    loadProducts();
    loadTrends();
    loadAdjustments();
  }, [loadInventory, loadPurchases, loadOrders, loadSales, loadExpenses, loadProducts, loadTrends, loadAdjustments]);

  useEffect(() => {
    loadSummary(period);
  }, [period, loadSummary]);

  // Restore an unsaved supplier-order draft (see comment near oDraftRestored).
  useEffect(() => {
    if (orderDraftLoaded.current) return;
    orderDraftLoaded.current = true;
    try {
      const raw = window.localStorage.getItem(ORDER_DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<OrderDraft>;
      const lines = Array.isArray(d.lines)
        ? d.lines
            .filter((l) => l && typeof l === "object")
            .map((l) => ({
              key: orderLineKey++,
              productId: String(l.productId ?? ""),
              units: String(l.units ?? ""),
              cost: String(l.cost ?? ""),
              costMode: l.costMode === "perUnit" ? ("perUnit" as const) : ("total" as const),
            }))
        : [];
      const hasContent =
        lines.some((l) => l.productId || l.units || l.cost) ||
        Boolean(d.supplier) ||
        Boolean(d.note);
      if (!hasContent) return;
      setOLines(lines.length ? lines : [newOrderLine()]);
      setOSupplier(d.supplier ?? "");
      setONote(d.note ?? "");
      if (d.date) setODate(d.date);
      setOArrived(d.arrived === true);
      setODraftRestored(true);
    } catch {
      window.localStorage.removeItem(ORDER_DRAFT_KEY);
    }
  }, []);

  // Persist the draft on every edit; clear it once the form is empty.
  useEffect(() => {
    if (!orderDraftLoaded.current) return;
    const hasContent =
      oLines.some((l) => l.productId || l.units.trim() || l.cost.trim()) ||
      oSupplier.trim() ||
      oNote.trim();
    try {
      if (!hasContent) {
        window.localStorage.removeItem(ORDER_DRAFT_KEY);
        return;
      }
      const draft: OrderDraft = {
        lines: oLines.map(({ productId, units, cost, costMode }) => ({ productId, units, cost, costMode })),
        supplier: oSupplier,
        note: oNote,
        date: oDate,
        arrived: oArrived,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage full / private mode: nothing to do */
    }
  }, [oLines, oSupplier, oNote, oDate, oArrived]);

  // Warn before leaving the page with an unsaved order in the form.
  useEffect(() => {
    const dirty =
      oLines.some((l) => l.productId || l.units.trim() || l.cost.trim()) ||
      oSupplier.trim() ||
      oNote.trim();
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [oLines, oSupplier, oNote]);

  const openHistory = useCallback(async (row: InventoryRow) => {
    setHistoryItem(row);
    setHistory(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/affiliates/admin/accounting/items/${row.id}/history`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history ?? null);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryItem(null);
    setHistory(null);
  }, []);

  useEffect(() => {
    if (!historyItem) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeHistory();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [historyItem, closeHistory]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const addPurchase = useCallback(async () => {
    if (pSaving) return;
    setPError(null);
    const product = products.find((p) => String(p.id) === pProductId);
    if (!product) {
      setPError("Pick a product.");
      return;
    }
    const units = Number(pUnits);
    if (!Number.isInteger(units) || units <= 0) {
      setPError("Units must be a positive whole number.");
      return;
    }
    const costInput = Number(pCost);
    if (!Number.isFinite(costInput) || costInput < 0) {
      setPError(
        pCostMode === "perUnit"
          ? "Enter the cost per unit."
          : "Enter the total cost of the order."
      );
      return;
    }
    // API stores total cost; when the admin entered a per-unit price, scale it.
    const totalCost =
      pCostMode === "perUnit"
        ? Math.round(costInput * units * 100) / 100
        : costInput;
    setPSaving(true);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wooProductId: product.id,
          productName: product.name,
          units,
          totalCost,
          purchasedAt: pDate ? `${pDate}T12:00:00.000Z` : undefined,
          note: pNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPError(data.message || "Could not record the purchase.");
        return;
      }
      setPUnits("");
      setPCost("");
      setPNote("");
      await Promise.all([loadPurchases(), loadInventory(), loadSummary(period)]);
    } finally {
      setPSaving(false);
    }
  }, [pSaving, products, pProductId, pUnits, pCost, pCostMode, pDate, pNote, loadPurchases, loadInventory, loadSummary, period]);

  const removePurchase = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this purchase entry? Inventory counts will update.")) return;
      setPurchases((prev) => prev.filter((p) => p.id !== id));
      await accountingMutationFetch(`/api/affiliates/admin/accounting/purchases/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
      await Promise.all([loadInventory(), loadOrders(), loadSummary(period)]);
    },
    [loadInventory, loadOrders, loadSummary, period]
  );

  const setOrderLine = useCallback(
    (key: number, patch: Partial<OrderLineInput>) => {
      setOLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
      );
    },
    []
  );

  const addOrder = useCallback(async () => {
    if (oSaving) return;
    setOError(null);
    const filled = oLines.filter(
      (l) => l.productId || l.units.trim() || l.cost.trim()
    );
    if (filled.length === 0) {
      setOError("Add at least one product to the order.");
      return;
    }
    const lines: {
      wooProductId: number;
      productName: string;
      units: number;
      totalCost: number;
    }[] = [];
    for (const line of filled) {
      const product = products.find((p) => String(p.id) === line.productId);
      if (!product) {
        setOError("Pick a product for every line.");
        return;
      }
      const units = Number(line.units);
      if (!Number.isInteger(units) || units <= 0) {
        setOError(`Units for ${product.name} must be a positive whole number.`);
        return;
      }
      const costInput = Number(line.cost);
      if (!Number.isFinite(costInput) || costInput < 0) {
        setOError(`Enter the cost for ${product.name}.`);
        return;
      }
      const totalCost =
        line.costMode === "perUnit"
          ? Math.round(costInput * units * 100) / 100
          : costInput;
      lines.push({
        wooProductId: product.id,
        productName: product.name,
        units,
        totalCost,
      });
    }
    setOSaving(true);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplier: oSupplier.trim() || undefined,
          note: oNote.trim() || undefined,
          orderedAt: oDate ? `${oDate}T12:00:00.000Z` : undefined,
          arrived: oArrived,
          lines,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOError(data.message || "Could not record the order.");
        return;
      }
      setOLines([newOrderLine()]);
      setOSupplier("");
      setONote("");
      setOArrived(false);
      setODraftRestored(false);
      try {
        window.localStorage.removeItem(ORDER_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      await Promise.all([
        loadOrders(),
        loadPurchases(),
        loadInventory(),
        loadSummary(period),
      ]);
    } finally {
      setOSaving(false);
    }
  }, [oSaving, oLines, oSupplier, oNote, oDate, oArrived, products, loadOrders, loadPurchases, loadInventory, loadSummary, period]);

  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const markOrderArrived = useCallback(
    async (id: string) => {
      setOrderActionError(null);
      const res = await accountingMutationFetch(`/api/affiliates/admin/accounting/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "arrived" }),
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.order) {
          setOrders((prev) =>
            prev.map((o) => (o.id === id ? (data.order as SupplierOrder) : o))
          );
        }
        await Promise.all([
          loadOrders(),
          loadPurchases(),
          loadInventory(),
          loadSummary(period),
        ]);
      } else {
        const data = res ? await res.json().catch(() => ({})) : {};
        setOrderActionError(
          data.error || (res ? `Could not mark the order as arrived (HTTP ${res.status}).` : "Could not mark the order as arrived (network).")
        );
      }
    },
    [loadOrders, loadPurchases, loadInventory, loadSummary, period]
  );

  const removeOrder = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Delete this whole order and all its items? Inventory counts will update."
        )
      )
        return;
      setOrderActionError(null);
      const res = await accountingMutationFetch(`/api/affiliates/admin/accounting/orders/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => null);
      if (res?.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        await Promise.all([loadPurchases(), loadInventory(), loadSummary(period)]);
      } else {
        const data = res ? await res.json().catch(() => ({})) : {};
        setOrderActionError(
          data.error || (res ? `Could not delete the order (HTTP ${res.status}).` : "Could not delete the order (network).")
        );
        await loadOrders();
      }
    },
    [loadOrders, loadPurchases, loadInventory, loadSummary, period]
  );

  const addAdjustment = useCallback(async () => {
    if (aSaving) return;
    setAError(null);
    const product = products.find((p) => String(p.id) === aProductId);
    if (!product) {
      setAError("Pick a product.");
      return;
    }
    const units = Number(aUnits);
    if (!Number.isInteger(units) || units <= 0) {
      setAError("Units must be a positive whole number.");
      return;
    }
    const delta = aDirection === "deduct" ? -units : units;
    setASaving(true);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wooProductId: product.id,
          productName: product.name,
          delta,
          reason: aReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAError(data.error || "Could not record the adjustment.");
        return;
      }
      setAUnits("");
      setAReason("");
      await Promise.all([loadAdjustments(), loadInventory()]);
    } finally {
      setASaving(false);
    }
  }, [aSaving, products, aProductId, aDirection, aUnits, aReason, loadAdjustments, loadInventory]);

  const removeAdjustment = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this adjustment? Stock counts will update.")) return;
      setAdjustments((prev) => prev.filter((a) => a.id !== id));
      await accountingMutationFetch(`/api/affiliates/admin/accounting/adjustments/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
      await Promise.all([loadAdjustments(), loadInventory()]);
    },
    [loadAdjustments, loadInventory]
  );

  const addSale = useCallback(async () => {
    if (sSaving) return;
    setSError(null);
    const product = products.find((p) => String(p.id) === sProductId);
    if (!product) {
      setSError("Pick a product.");
      return;
    }
    const units = Number(sUnits);
    if (!Number.isInteger(units) || units <= 0) {
      setSError("Units must be a positive whole number.");
      return;
    }
    // Free shipments never carry an amount — the server stores $0 for them.
    const totalAmount = sKind === "giveaway" ? 0 : Number(sAmount);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      setSError("Enter the total amount collected.");
      return;
    }
    setSSaving(true);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          wooProductId: product.id,
          productName: product.name,
          kind: sKind,
          units,
          totalAmount,
          soldAt: sDate ? `${sDate}T12:00:00.000Z` : undefined,
          note: sNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSError(data.message || "Could not record the sale.");
        return;
      }
      setSUnits("");
      setSAmount("");
      setSNote("");
      await Promise.all([loadSales(), loadInventory(), loadSummary(period), loadTrends()]);
    } finally {
      setSSaving(false);
    }
  }, [sSaving, products, sProductId, sKind, sUnits, sAmount, sDate, sNote, loadSales, loadInventory, loadSummary, loadTrends, period]);

  const removeSale = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this entry? Revenue and inventory will update.")) return;
      setSales((prev) => prev.filter((s) => s.id !== id));
      await accountingMutationFetch(`/api/affiliates/admin/accounting/sales/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
      await Promise.all([loadInventory(), loadSummary(period), loadTrends()]);
    },
    [loadInventory, loadSummary, loadTrends, period]
  );

  const addExpense = useCallback(async () => {
    if (eSaving) return;
    setEError(null);
    const label = eLabel.trim();
    if (!label) {
      setEError("Describe the expense.");
      return;
    }
    const amount = Number(eAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setEError("Enter a valid amount.");
      return;
    }
    setESaving(true);
    try {
      const res = await accountingMutationFetch("/api/affiliates/admin/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label,
          category: eCategory.trim() || undefined,
          amount,
          incurredAt: eDate ? `${eDate}T12:00:00.000Z` : undefined,
          note: eNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setEError(data.message || "Could not record the expense.");
        return;
      }
      setELabel("");
      setECategory("");
      setEAmount("");
      setENote("");
      await Promise.all([loadExpenses(), loadSummary(period)]);
    } finally {
      setESaving(false);
    }
  }, [eSaving, eLabel, eCategory, eAmount, eDate, eNote, loadExpenses, loadSummary, period]);

  const removeExpense = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this expense?")) return;
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await accountingMutationFetch(`/api/affiliates/admin/accounting/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {});
      await loadSummary(period);
    },
    [loadSummary, period]
  );

  const saveThreshold = useCallback(
    async (itemId: string, value: number) => {
      setInventory((prev) =>
        prev.map((row) =>
          row.id === itemId
            ? {
                ...row,
                lowStockThreshold: value,
                low: row.unitsOnHand <= value,
              }
            : row
        )
      );
      await accountingMutationFetch(`/api/affiliates/admin/accounting/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lowStockThreshold: value }),
      }).catch(() => {});
    },
    []
  );

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const lowRows = useMemo(() => inventory.filter((r) => r.low), [inventory]);
  // Live preview beneath the cost field. In "total" mode it derives cost/unit;
  // in "perUnit" mode it derives the total that will be stored.
  const costPreview = useMemo(() => {
    const units = Number(pUnits);
    const cost = Number(pCost);
    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(cost) || cost <= 0) {
      return null;
    }
    return pCostMode === "perUnit"
      ? { label: "total", value: Math.round(cost * units * 100) / 100 }
      : { label: "per unit", value: cost / units };
  }, [pUnits, pCost, pCostMode]);

  // Running totals of the multi-item order composer (only counts valid lines).
  const orderTotalPreview = useMemo(() => {
    let total = 0;
    let units = 0;
    let counted = 0;
    for (const line of oLines) {
      const lineUnits = Number(line.units);
      const cost = Number(line.cost);
      if (
        !Number.isFinite(lineUnits) ||
        lineUnits <= 0 ||
        !Number.isFinite(cost) ||
        cost <= 0
      ) {
        continue;
      }
      total += line.costMode === "perUnit" ? cost * lineUnits : cost;
      units += lineUnits;
      counted += 1;
    }
    return counted > 0
      ? { total: Math.round(total * 100) / 100, units }
      : null;
  }, [oLines]);

  // Chart data derived from the 12-month trends.
  const demandChartData = useMemo(() => {
    if (!trends) return [];
    if (demandProductId === "all") {
      return trends.overall.map((p) => ({
        date: p.date,
        label: p.date,
        primary: p.unitsSold,
      }));
    }
    const product = trends.byProduct.find(
      (p) => String(p.wooProductId) === demandProductId
    );
    return (product?.points ?? []).map((pt) => ({
      date: pt.date,
      label: pt.date,
      primary: pt.unitsSold,
    }));
  }, [trends, demandProductId]);

  const revenueChartData = useMemo(
    () =>
      (trends?.overall ?? []).map((p) => ({
        date: p.date,
        label: p.date,
        primary: p.revenue,
      })),
    [trends]
  );

  const mostSoldData = useMemo(
    () =>
      (trends?.byProduct ?? [])
        .filter((p) => p.totalUnits > 0)
        .slice(0, 8)
        .map((p) => ({
          label: p.name,
          value: p.totalUnits,
          hint: `${formatCurrency(p.totalRevenue)} revenue`,
        })),
    [trends]
  );

  const revenueShareData = useMemo(() => {
    const list = (trends?.byProduct ?? []).filter((p) => p.totalRevenue > 0);
    const top = list.slice(0, 5).map((p) => ({ label: p.name, value: p.totalRevenue }));
    const rest = list.slice(5).reduce((acc, p) => acc + p.totalRevenue, 0);
    if (rest > 0) top.push({ label: "Other", value: Math.round(rest * 100) / 100 });
    return top;
  }, [trends]);

  const historyChartData = useMemo(
    () =>
      (history?.days ?? []).map((d) => ({
        date: d.date,
        label: d.date,
        primary: d.deducted,
        secondary: d.onHand,
      })),
    [history]
  );

  const totalWindowRevenue = useMemo(
    () => (trends?.overall ?? []).reduce((acc, p) => acc + p.revenue, 0),
    [trends]
  );
  const totalWindowUnits = useMemo(
    () => (trends?.overall ?? []).reduce((acc, p) => acc + p.unitsSold, 0),
    [trends]
  );

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "insights", label: "Insights", icon: LineChart },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "purchases", label: "Purchases", icon: DollarSign },
    { id: "sales", label: "Offline sales", icon: HandCoins },
    { id: "expenses", label: "Expenses", icon: Receipt },
  ];

  return (
    <>
      {readError && <p role="alert">{readError} <button type="button" onClick={() => loadSummary(period)}>Retry</button></p>}
      <PageHeader
        eyebrow="Finance"
        title="Accounting"
        description="Track what you pay for stock, watch inventory deplete as orders come in, log other costs, and see your real margins."
        actions={
          lowRows.length > 0 ? (
            <button
              onClick={() => setTab("inventory")}
              className="inline-flex items-center gap-2 rounded-full bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans hover:bg-amber-200 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowRows.length} low on stock
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-sans border transition-colors ${
              tab === id
                ? "bg-[#242526] text-white border-[#242526]"
                : "glass-surface text-[#64717a] border-[#242526]/10 hover:text-[#20282c]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------ OVERVIEW ---------------------------- */}
      {tab === "overview" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-6">
            {PERIOD_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-2 text-[10px] uppercase tracking-[0.16em] font-sans border transition-colors ${
                  period === p
                    ? "bg-[#242526] text-white border-[#242526]"
                    : "bg-white/60 text-[#64717a] border-[#242526]/10 hover:text-[#20282c]"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {summaryLoading || !summary ? (
            <div className="glass-surface rounded-lg p-14 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#64717a]" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
                <StatCard
                  icon={TrendingUp}
                  label="Revenue"
                  value={formatCurrency(summary.revenue)}
                  hint={
                    summary.manualSalesCount > 0
                      ? `${summary.orderCount} paid orders + ${summary.manualSalesCount} offline (${formatCurrency(summary.manualRevenue)})`
                      : `${summary.orderCount} paid orders`
                  }
                />
                <StatCard
                  icon={Package}
                  label="Cost of goods"
                  value={formatCurrency(summary.cogs)}
                  hint={
                    summary.giveawayCount > 0
                      ? `incl. ${summary.giveawayUnits} free units shipped (${formatCurrency(summary.giveawayCogs)})`
                      : undefined
                  }
                />
                <StatCard
                  icon={DollarSign}
                  label="Gross profit"
                  value={formatCurrency(summary.grossProfit)}
                  hint={`${summary.grossMarginPct.toFixed(1)}% margin`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Shipping + tax profit"
                  value={formatCurrency(summary.shippingProfit + summary.taxCollected)}
                  hint={`${formatCurrency(summary.shippingCollected)} shipping − ${formatCurrency(summary.shippingCost)} cost + ${formatCurrency(summary.taxCollected)} tax`}
                />
                <StatCard
                  icon={Users}
                  label="Affiliate fees"
                  value={formatCurrency(summary.affiliateFees)}
                  hint="commissions on these orders"
                />
                <StatCard
                  icon={Receipt}
                  label="Expenses"
                  value={formatCurrency(summary.expenses)}
                />
                <StatCard
                  icon={Wallet}
                  label="Net profit"
                  value={formatCurrency(summary.netProfit)}
                  hint={`${summary.netMarginPct.toFixed(1)}% margin`}
                  accent
                />
              </div>

              <p className="text-xs text-[#64717a] font-sans mb-8">
                Net profit = product revenue − cost of goods + shipping profit + taxes
                collected − affiliate fees − expenses. Shipping profit counts US orders
                only ($15 collected − $6 cost each); international shipping is charged at
                the carrier rate and passes through with no profit. Total charged in this
                period: {formatCurrency(summary.totalCollected)}.
              </p>

              {summary.untrackedProducts.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-8 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    No purchase entries yet for{" "}
                    <strong>{summary.untrackedProducts.join(", ")}</strong> — their cost
                    counts as $0 in this report. Add a purchase under the Purchases tab to
                    include their real cost.
                  </span>
                </div>
              )}

              <SectionTitle eyebrow="Breakdown" title="Profit by product" />
              {summary.products.length === 0 ? (
                <EmptyState
                  icon={Calculator}
                  title="No paid orders in this period"
                  description="Pick a wider period to see revenue and profit."
                />
              ) : (
                <div className="glass-surface rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                          <th className="px-5 py-3.5 font-medium">Product</th>
                          <th className="px-5 py-3.5 font-medium text-right">Units sold</th>
                          <th className="px-5 py-3.5 font-medium text-right">Revenue</th>
                          <th className="px-5 py-3.5 font-medium text-right">COGS</th>
                          <th className="px-5 py-3.5 font-medium text-right">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#242526]/6">
                        {summary.products.map((row) => (
                          <tr key={row.wooProductId}>
                            <td className="px-5 py-3.5 text-[#20282c] font-medium">
                              {row.name}
                              {!row.tracked && (
                                <span className="ml-2 align-middle">
                                  <Pill tone="warn">no cost data</Pill>
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-sans">{row.unitsSold}</td>
                            <td className="px-5 py-3.5 text-right font-sans">
                              {formatCurrency(row.revenue)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-sans">
                              {formatCurrency(row.cogs)}
                            </td>
                            <td className="px-5 py-3.5 text-right font-sans font-medium">
                              {formatCurrency(row.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ------------------------------ INSIGHTS ---------------------------- */}
      {tab === "insights" && (
        <div>
          {trendsLoading || !trends ? (
            <div className="glass-surface rounded-lg p-14 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#64717a]" />
            </div>
          ) : totalWindowUnits === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No sales in the last 12 months"
              description="Once orders come in, you'll see demand trends, best sellers, and revenue share here."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
                <StatCard
                  icon={Package}
                  label="Units sold · 12 mo"
                  value={totalWindowUnits.toLocaleString()}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Revenue · 12 mo"
                  value={formatCurrency(totalWindowRevenue)}
                />
                <StatCard
                  icon={BarChart3}
                  label="Best seller"
                  value={trends.byProduct[0]?.name ?? "—"}
                  hint={
                    trends.byProduct[0]
                      ? `${trends.byProduct[0].totalUnits} units`
                      : undefined
                  }
                />
                <StatCard
                  icon={PieChart}
                  label="Products sold"
                  value={String(trends.byProduct.filter((p) => p.totalUnits > 0).length)}
                />
              </div>

              {/* Demand over time (with product selector) */}
              <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
                <SectionTitle
                  eyebrow="Demand"
                  title="Units sold per month"
                  right={
                    <select
                      value={demandProductId}
                      onChange={(e) => setDemandProductId(e.target.value)}
                      className="rounded-xl border border-[#242526]/12 bg-white/70 px-3 py-2 text-sm text-[#20282c] outline-none focus:border-[#242526]/40 max-w-[60vw]"
                    >
                      <option value="all">All products</option>
                      {trends.byProduct
                        .filter((p) => p.totalUnits > 0)
                        .map((p) => (
                          <option key={p.wooProductId} value={p.wooProductId}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  }
                />
                <AreaChart
                  data={demandChartData}
                  granularity="month"
                  primaryLabel="Units sold"
                  formatValue={(n) => Math.round(n).toLocaleString()}
                />
              </div>

              {/* Revenue over time */}
              <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
                <SectionTitle eyebrow="Sales" title="Revenue per month" />
                <AreaChart
                  data={revenueChartData}
                  granularity="month"
                  primaryLabel="Revenue"
                  formatValue={formatCurrency}
                />
              </div>

              {/* Most sold + revenue share */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-surface rounded-lg p-5 sm:p-6">
                  <SectionTitle eyebrow="Ranking" title="Most sold products" />
                  {mostSoldData.length === 0 ? (
                    <p className="text-sm text-[#64717a]">No units sold yet.</p>
                  ) : (
                    <BarChart
                      data={mostSoldData}
                      formatValue={(n) => `${Math.round(n).toLocaleString()} units`}
                    />
                  )}
                </div>
                <div className="glass-surface rounded-lg p-5 sm:p-6">
                  <SectionTitle eyebrow="Mix" title="Revenue share" />
                  {revenueShareData.length === 0 ? (
                    <p className="text-sm text-[#64717a]">No revenue yet.</p>
                  ) : (
                    <Donut
                      slices={revenueShareData}
                      centerLabel={formatCurrency(totalWindowRevenue)}
                      centerSubLabel="12-month revenue"
                      formatValue={formatCurrency}
                    />
                  )}
                </div>
              </div>

              <p className="text-xs text-[#64717a] font-sans mt-6">
                Trends cover the trailing 12 months of paid orders.
                {trends.truncated &&
                  " Note: the order scan hit its safety cap — figures may be slightly under."}
              </p>
            </>
          )}
        </div>
      )}

      {/* ------------------------------ INVENTORY --------------------------- */}
      {tab === "inventory" && (
        <div>
          {lowRows.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>Time to reorder:</strong>{" "}
                {lowRows.map((r) => `${r.name} (${r.unitsOnHand} left)`).join(", ")}
              </span>
            </div>
          )}

          {inventoryLoading ? (
            <div className="glass-surface rounded-lg p-14 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#64717a]" />
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No inventory tracked yet"
              description="Record your first stock purchase under the Purchases tab — the product starts being tracked automatically."
            />
          ) : (
            <div className="glass-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                      <th className="px-5 py-3.5 font-medium">Product</th>
                      <th className="px-5 py-3.5 font-medium text-right">Cost / unit</th>
                      <th className="px-5 py-3.5 font-medium text-right">Purchased</th>
                      <th className="px-5 py-3.5 font-medium text-right">Sold</th>
                      <th className="px-5 py-3.5 font-medium text-right">Adjusted</th>
                      <th className="px-5 py-3.5 font-medium text-right">On hand</th>
                      <th className="px-5 py-3.5 font-medium text-right">Alert at</th>
                      <th className="px-5 py-3.5 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242526]/6">
                    {inventory.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => openHistory(row)}
                        className={`cursor-pointer transition-colors hover:bg-[#20282c]/[0.03] ${
                          row.low ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-[#20282c] font-medium">{row.name}</span>
                          {row.trackingSince && (
                            <span className="block text-[11px] text-[#64717a] mt-0.5">
                              tracking since {formatShortDate(row.trackingSince)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {formatCurrency(row.avgCostPerUnit)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">{row.unitsPurchased}</td>
                        <td className="px-5 py-3.5 text-right font-sans">{row.unitsSold}</td>
                        <td
                          className={`px-5 py-3.5 text-right font-sans ${
                            row.unitsAdjusted < 0
                              ? "text-red-600"
                              : row.unitsAdjusted > 0
                                ? "text-emerald-700"
                                : "text-[#64717a]"
                          }`}
                        >
                          {row.unitsAdjusted > 0 ? `+${row.unitsAdjusted}` : row.unitsAdjusted || "—"}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-sans font-semibold ${
                            row.low ? "text-amber-700" : "text-[#20282c]"
                          }`}
                        >
                          {row.unitsOnHand}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min={0}
                            defaultValue={row.lowStockThreshold}
                            onBlur={(e) => {
                              const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                              if (v !== row.lowStockThreshold) saveThreshold(row.id, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            className="w-16 rounded-lg border border-[#242526]/12 bg-white/70 px-2 py-1 text-right font-sans text-sm outline-none focus:border-[#242526]/40"
                          />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {row.low ? (
                            <Pill tone="warn" icon={AlertTriangle}>
                              order more
                            </Pill>
                          ) : (
                            <Pill tone="success">in stock</Pill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-[#64717a] font-sans mt-4">
            Sold units count paid WooCommerce orders placed since each product&apos;s first
            purchase entry, so stock you record depletes automatically as orders come in.
            Click any product to see its day-by-day stock trend and the orders behind it.
            {inventoryTruncated &&
              " Note: the order scan hit its safety cap — counts may be slightly under."}
          </p>

          {/* ---------------------- Stock adjustments ----------------------- */}
          <div className="glass-surface rounded-lg p-5 sm:p-6 mt-8 mb-6">
            <SectionTitle eyebrow="Corrections" title="Adjust stock" />
            <p className="text-xs text-[#64717a] -mt-3 mb-5 max-w-2xl leading-relaxed">
              Physical count doesn&apos;t match the numbers? Deduct units that are
              missing (lost, damaged, or never recorded) or add units you found.
              Every adjustment lands in the report below so you can chase down
              where the discrepancies come from.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Product</label>
                <select
                  value={aProductId}
                  onChange={(e) => setAProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Pick a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.pending ? " (coming soon)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Direction</label>
                <div className="inline-flex w-full rounded-xl border border-[#242526]/12 bg-white/70 p-1">
                  {(
                    [
                      { id: "deduct", label: "Deduct" },
                      { id: "add", label: "Add" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setADirection(opt.id)}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors ${
                        aDirection === opt.id
                          ? opt.id === "deduct"
                            ? "bg-red-600 text-white"
                            : "bg-emerald-700 text-white"
                          : "text-[#64717a] hover:text-[#20282c]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Units</label>
                <input
                  type="number"
                  min={1}
                  value={aUnits}
                  onChange={(e) => setAUnits(e.target.value)}
                  placeholder="e.g. 2"
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={labelCls}>Reason (recommended)</label>
                <input
                  value={aReason}
                  onChange={(e) => setAReason(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    aDirection === "deduct"
                      ? "e.g. physical count short 2 — possibly unrecorded giveaway"
                      : "e.g. found a box that was never entered"
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button onClick={addAdjustment} disabled={aSaving} className={primaryBtnCls}>
                {aSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {aDirection === "deduct" ? "Deduct from stock" : "Add to stock"}
              </button>
              {aError && <span className="text-sm text-red-600">{aError}</span>}
            </div>
          </div>

          {adjustments.length > 0 && (
            <div>
              <SectionTitle eyebrow="Report" title="Adjustments & missing stock" />
              {(() => {
                const missingTotal = adjustments
                  .filter((a) => a.delta < 0)
                  .reduce((acc, a) => acc + Math.abs(a.delta), 0);
                return missingTotal > 0 ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>Missing {missingTotal} unit{missingTotal === 1 ? "" : "s"} total</strong>{" "}
                      — these were either lost or not recorded correctly. Review the
                      entries below and figure out where they&apos;re coming from
                      (unlogged giveaways, damaged stock, miscounted deliveries…).
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="glass-surface rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                        <th className="px-5 py-3.5 font-medium">Date</th>
                        <th className="px-5 py-3.5 font-medium">Product</th>
                        <th className="px-5 py-3.5 font-medium text-right">Units</th>
                        <th className="px-5 py-3.5 font-medium">Reason</th>
                        <th className="px-5 py-3.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242526]/6">
                      {adjustments.map((a) => (
                        <tr key={a.id}>
                          <td className="px-5 py-3.5 font-sans text-[#64717a] whitespace-nowrap">
                            {formatShortDate(a.adjustedAt)}
                          </td>
                          <td className="px-5 py-3.5 text-[#20282c] font-medium">
                            {a.productName}
                          </td>
                          <td
                            className={`px-5 py-3.5 text-right font-sans font-semibold ${
                              a.delta < 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {a.delta < 0 ? `missing ${Math.abs(a.delta)}` : `+${a.delta}`}
                          </td>
                          <td className="px-5 py-3.5 text-[#64717a] max-w-[280px] truncate">
                            {a.reason ?? "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => removeAdjustment(a.id)}
                              className="text-[#64717a] hover:text-red-600 transition-colors p-1"
                              aria-label="Delete adjustment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------ PURCHASES --------------------------- */}
      {tab === "purchases" && (
        <div>
          {reconciledNote && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-5 text-sm text-emerald-900">
              <strong>Linked to the store:</strong> {reconciledNote} — the
              stock and purchase history you recorded before launch now counts
              against the live WooCommerce product, and every sale deducts
              automatically.
            </div>
          )}

          <div className="mb-5 inline-flex rounded-full border border-[#242526]/10 bg-white/60 p-1">
            {(
              [
                { id: "single", label: "Single purchase" },
                { id: "order", label: "Full order (multiple products)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setPMode(opt.id);
                  setPError(null);
                  setOError(null);
                }}
                className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors ${
                  pMode === opt.id
                    ? "bg-[#242526] text-white"
                    : "text-[#64717a] hover:text-[#20282c]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Placeholder products: orderable before they exist in Woo */}
          <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
            <SectionTitle eyebrow="New product" title="Ordering something not in the store yet?" />
            <p className="text-xs text-[#64717a] -mt-3 mb-4 max-w-2xl leading-relaxed">
              Add it here and it shows up in every product picker (marked
              &ldquo;coming soon&rdquo;) so you can include it in purchases and
              supplier orders right away. When you later publish it in
              WooCommerce under the same name, everything links up on its own:
              recorded stock carries over and store sales start deducting
              automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                value={npName}
                onChange={(e) => setNpName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Semaglutide 10mg"
                className={`${inputCls} sm:max-w-xs`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addPendingProduct();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void addPendingProduct()}
                disabled={npSaving}
                className={primaryBtnCls}
              >
                {npSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add to product list
              </button>
              {npError && <span className="text-sm text-red-600">{npError}</span>}
              {npSuccess && !npError && (
                <span className="text-sm text-emerald-700">
                  {npSuccess} added — pick it in the forms below.
                </span>
              )}
            </div>
          </div>

          {pMode === "order" && (
            <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
              <SectionTitle eyebrow="New order" title="Record a supplier order" />
              <p className="text-xs text-[#64717a] -mt-3 mb-5 max-w-2xl leading-relaxed">
                Bought several peptides together? Add one line per product. New
                orders start as <strong>in transit</strong> — the units are added
                to stock only when you hit &ldquo;Arrived&rdquo; under
                &ldquo;Past orders.&rdquo; Nothing is recorded until you press{" "}
                <strong>Save order</strong>; what you type here is kept as a draft on this device.
              </p>

              {oDraftRestored && (
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span>
                    Restored an order you started but never saved. Check it and press
                    &ldquo;Save order&rdquo;, or discard it.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOLines([newOrderLine()]);
                      setOSupplier("");
                      setONote("");
                      setOArrived(false);
                      setODraftRestored(false);
                      try {
                        window.localStorage.removeItem(ORDER_DRAFT_KEY);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="ml-auto text-[10px] uppercase tracking-[0.16em] font-sans text-amber-900/70 hover:text-amber-900"
                  >
                    Discard draft
                  </button>
                </div>
              )}

              <div className="space-y-3 mb-5">
                {oLines.map((line, idx) => {
                  const units = Number(line.units);
                  const cost = Number(line.cost);
                  const valid =
                    Number.isFinite(units) && units > 0 && Number.isFinite(cost) && cost > 0;
                  const lineTotal = valid
                    ? line.costMode === "perUnit"
                      ? cost * units
                      : cost
                    : null;
                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-3 items-end rounded-lg border border-[#242526]/8 bg-white/40 p-3.5"
                    >
                      <div>
                        <label className={labelCls}>Product {idx + 1}</label>
                        <ProductCombobox
                          products={products}
                          value={line.productId}
                          onChange={(productId) => setOrderLine(line.key, { productId })}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Units</label>
                        <input
                          type="number"
                          min={1}
                          value={line.units}
                          onChange={(e) => setOrderLine(line.key, { units: e.target.value })}
                          placeholder="e.g. 10"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                            {line.costMode === "perUnit" ? "Cost / unit ($)" : "Line cost ($)"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setOrderLine(line.key, {
                                costMode: line.costMode === "total" ? "perUnit" : "total",
                              })
                            }
                            className="text-[10px] font-sans text-[#64717a] underline underline-offset-2 hover:text-[#20282c] transition-colors"
                          >
                            {line.costMode === "total" ? "unit price?" : "total?"}
                          </button>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.cost}
                          onChange={(e) => setOrderLine(line.key, { cost: e.target.value })}
                          placeholder={line.costMode === "perUnit" ? "e.g. 28" : "e.g. 280"}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex items-center gap-2 pb-1.5">
                        {lineTotal != null && (
                          <span className="text-xs font-sans text-[#64717a] whitespace-nowrap text-right leading-snug">
                            = {formatCurrency(lineTotal)}
                            <span className="block text-[11px] text-[#20282c]">
                              {formatCurrency(lineTotal / units)} / unit
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setOLines((prev) =>
                              prev.length > 1
                                ? prev.filter((l) => l.key !== line.key)
                                : [newOrderLine()]
                            )
                          }
                          className="text-[#64717a] hover:text-red-600 transition-colors p-1"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setOLines((prev) => [...prev, newOrderLine()])}
                className="inline-flex items-center gap-2 rounded-full border border-[#242526]/15 bg-white/60 px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white transition-colors mb-6"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another product
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Supplier (optional)</label>
                  <input
                    value={oSupplier}
                    onChange={(e) => setOSupplier(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Swiss lab"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Order date</label>
                  <input
                    type="date"
                    value={oDate}
                    onChange={(e) => setODate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Note (optional)</label>
                  <input
                    value={oNote}
                    onChange={(e) => setONote(e.target.value)}
                    maxLength={1000}
                    placeholder="e.g. July restock, invoice #1042"
                    className={inputCls}
                  />
                </div>
              </div>

              <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none max-w-2xl">
                <input
                  type="checkbox"
                  checked={oArrived}
                  onChange={(e) => setOArrived(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#242526]/25 accent-[#20282c]"
                />
                <span className="text-xs text-[#64717a] leading-relaxed">
                  <strong className="text-[#20282c]">Already arrived</strong> — add
                  the units to stock right away (for restocks you&apos;re entering
                  after the fact). Leave unchecked for orders still on the way.
                </span>
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button onClick={addOrder} disabled={oSaving} className={primaryBtnCls}>
                  {oSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  )}
                  Save order
                </button>
                {orderTotalPreview != null && (
                  <span className="text-sm font-sans text-[#64717a]">
                    Order total: {formatCurrency(orderTotalPreview.total)} ·{" "}
                    {orderTotalPreview.units} units
                    {orderTotalPreview.units > 0 && (
                      <> · avg {formatCurrency(orderTotalPreview.total / orderTotalPreview.units)} / unit</>
                    )}
                  </span>
                )}
                {oError && <span className="text-sm text-red-600">{oError}</span>}
              </div>
            </div>
          )}

          {pMode === "single" && (
          <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
            <SectionTitle eyebrow="New entry" title="Record a stock purchase" />
            <p className="text-xs text-[#64717a] -mt-3 mb-5 max-w-2xl leading-relaxed">
              Don&apos;t have the old invoice? For stock you already hold (e.g. CJC),
              just enter the <strong>units you have now</strong>, switch the cost field to
              &ldquo;unit price,&rdquo; and leave the date as today — it&apos;ll start
              depleting as new orders arrive, without touching past sales.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Product</label>
                <select
                  value={pProductId}
                  onChange={(e) => setPProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Pick a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.pending ? " (coming soon)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Units</label>
                <input
                  type="number"
                  min={1}
                  value={pUnits}
                  onChange={(e) => setPUnits(e.target.value)}
                  placeholder="e.g. 10"
                  className={inputCls}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                    {pCostMode === "perUnit" ? "Cost per unit ($)" : "Total cost ($)"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPCostMode((m) => (m === "total" ? "perUnit" : "total"))
                    }
                    className="text-[10px] font-sans text-[#64717a] underline underline-offset-2 hover:text-[#20282c] transition-colors"
                  >
                    {pCostMode === "total" ? "know unit price?" : "know total?"}
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pCost}
                  onChange={(e) => setPCost(e.target.value)}
                  placeholder={pCostMode === "perUnit" ? "e.g. 28" : "e.g. 280"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Purchase date</label>
                <input
                  type="date"
                  value={pDate}
                  onChange={(e) => setPDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Note (optional)</label>
                <input
                  value={pNote}
                  onChange={(e) => setPNote(e.target.value)}
                  maxLength={1000}
                  placeholder="e.g. 1 box of NAD+ from supplier X"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button onClick={addPurchase} disabled={pSaving} className={primaryBtnCls}>
                {pSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add purchase
              </button>
              {costPreview != null && (
                <span className="text-sm font-sans text-[#64717a]">
                  = {formatCurrency(costPreview.value)} {costPreview.label}
                </span>
              )}
              {pError && <span className="text-sm text-red-600">{pError}</span>}
            </div>
          </div>
          )}

          {ordersLoadError && (
            <div className="mb-4 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
              {ordersLoadError}{" "}
              <button type="button" onClick={() => loadOrders()} className="underline">
                Retry
              </button>
            </div>
          )}
          {orderActionError && (
            <div className="mb-4 rounded-lg border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
              {orderActionError}
            </div>
          )}

          {orders.length > 0 && (
            <div className="mb-6">
              <SectionTitle eyebrow="History" title="Past orders" />
              <div className="space-y-3">
                {orders.map((o) => {
                  const expanded = expandedOrderId === o.id;
                  return (
                    <div key={o.id} className="glass-surface rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(expanded ? null : o.id)}
                        className="w-full flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4 text-left hover:bg-[#20282c]/[0.03] transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4 text-[#64717a] shrink-0" />
                        <span className="font-sans text-[#64717a] text-sm">
                          {formatShortDate(o.orderedAt)}
                        </span>
                        <span className="text-[#20282c] font-medium text-sm">
                          {o.lines.length} product{o.lines.length === 1 ? "" : "s"} ·{" "}
                          {o.totalUnits} units
                        </span>
                        {o.supplier && <Pill tone="neutral">{o.supplier}</Pill>}
                        {o.arrivedAt ? (
                          <Pill tone="success">
                            Arrived {formatShortDate(o.arrivedAt)}
                          </Pill>
                        ) : (
                          <Pill tone="warn">In transit</Pill>
                        )}
                        <span className="ml-auto font-sans font-semibold text-sm text-[#20282c]">
                          {formatCurrency(o.totalCost)}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">
                          {expanded ? "hide" : "view"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="border-t border-[#242526]/8 overflow-x-auto">
                          <table className="w-full min-w-[480px] text-sm">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                                <th className="px-5 py-3 font-medium">Product</th>
                                <th className="px-5 py-3 font-medium text-right">Units</th>
                                <th className="px-5 py-3 font-medium text-right">Cost</th>
                                <th className="px-5 py-3 font-medium text-right">Cost / unit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#242526]/6">
                              {o.lines.map((l) => (
                                <tr key={l.id}>
                                  <td className="px-5 py-3 text-[#20282c] font-medium">
                                    {l.productName}
                                  </td>
                                  <td className="px-5 py-3 text-right font-sans">{l.units}</td>
                                  <td className="px-5 py-3 text-right font-sans">
                                    {formatCurrency(l.totalCost)}
                                  </td>
                                  <td className="px-5 py-3 text-right font-sans">
                                    {formatCurrency(l.costPerUnit)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-[#242526]/8">
                            <span className="text-xs text-[#64717a] max-w-[55%] truncate">
                              {o.note ?? ""}
                            </span>
                            <div className="flex items-center gap-4">
                              {!o.arrivedAt && (
                                <button
                                  onClick={() => markOrderArrived(o.id)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#20282c] text-white px-4 py-2 text-[10px] uppercase tracking-[0.16em] font-sans hover:bg-[#242526] transition-colors"
                                >
                                  <PackageCheck className="h-3.5 w-3.5" />
                                  Arrived — add to stock
                                </button>
                              )}
                              <button
                                onClick={() => removeOrder(o.id)}
                                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete order
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <SectionTitle eyebrow="All entries" title="Purchase lines" />
          {purchases.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No purchases recorded"
              description="Add your first stock order above — e.g. $280 for 1 box of NAD+ (10 units) → $28.00 per unit."
            />
          ) : (
            <div className="glass-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                      <th className="px-5 py-3.5 font-medium">Date</th>
                      <th className="px-5 py-3.5 font-medium">Product</th>
                      <th className="px-5 py-3.5 font-medium text-right">Units</th>
                      <th className="px-5 py-3.5 font-medium text-right">Total cost</th>
                      <th className="px-5 py-3.5 font-medium text-right">Cost / unit</th>
                      <th className="px-5 py-3.5 font-medium">Note</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242526]/6">
                    {purchases.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3.5 font-sans text-[#64717a]">
                          {formatShortDate(p.purchasedAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[#20282c] font-medium">
                          {p.productName}
                          {p.orderId && (
                            <span className="ml-2 align-middle">
                              <Pill tone="neutral">order</Pill>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">{p.units}</td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {formatCurrency(p.totalCost)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {formatCurrency(p.costPerUnit)}
                        </td>
                        <td className="px-5 py-3.5 text-[#64717a] max-w-[240px] truncate">
                          {p.note ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => removePurchase(p.id)}
                            className="text-[#64717a] hover:text-red-600 transition-colors"
                            aria-label="Delete purchase"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------- OFFLINE SALES -------------------------- */}
      {tab === "sales" && (
        <div>
          <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
            <SectionTitle eyebrow="New entry" title="Record an offline sale or free shipment" />
            <p className="text-xs text-[#64717a] -mt-3 mb-5 max-w-2xl leading-relaxed">
              Offline sales (cash, direct, in person) count as revenue and deduct stock,
              just like a WooCommerce order. Free shipments (e.g. product sent to an
              affiliate) only deduct stock — no revenue, but the unit cost still counts
              in cost of goods.
            </p>
            <div className="mb-5 inline-flex rounded-full border border-[#242526]/10 bg-white/60 p-1">
              {(
                [
                  { id: "sale", label: "Offline sale" },
                  { id: "giveaway", label: "Free shipment" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSKind(opt.id);
                    setSError(null);
                  }}
                  className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors ${
                    sKind === opt.id
                      ? "bg-[#242526] text-white"
                      : "text-[#64717a] hover:text-[#20282c]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Product</label>
                <select
                  value={sProductId}
                  onChange={(e) => setSProductId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Pick a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.pending ? " (coming soon)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Units</label>
                <input
                  type="number"
                  min={1}
                  value={sUnits}
                  onChange={(e) => setSUnits(e.target.value)}
                  placeholder="e.g. 2"
                  className={inputCls}
                />
              </div>
              {sKind === "sale" && (
                <div>
                  <label className={labelCls}>Amount collected ($)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={sAmount}
                    onChange={(e) => setSAmount(e.target.value)}
                    placeholder="e.g. 240"
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>{sKind === "giveaway" ? "Shipped date" : "Sale date"}</label>
                <input
                  type="date"
                  value={sDate}
                  onChange={(e) => setSDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Note (optional)</label>
                <input
                  value={sNote}
                  onChange={(e) => setSNote(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    sKind === "giveaway"
                      ? "e.g. Free units shipped to affiliate PRI"
                      : "e.g. Cash sale to John, paid via Zelle"
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button onClick={addSale} disabled={sSaving} className={primaryBtnCls}>
                {sSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {sKind === "giveaway" ? "Record shipment" : "Add sale"}
              </button>
              {(() => {
                if (sKind === "giveaway") return null;
                const u = Number(sUnits);
                const a = Number(sAmount);
                if (Number.isFinite(u) && u > 0 && Number.isFinite(a) && a > 0) {
                  return (
                    <span className="text-sm font-sans text-[#64717a]">
                      = {formatCurrency(a / u)} per unit
                    </span>
                  );
                }
                return null;
              })()}
              {sError && <span className="text-sm text-red-600">{sError}</span>}
            </div>
          </div>

          {sales.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No offline sales or free shipments recorded"
              description="Log sales made outside the website and free product shipped to affiliates so revenue, profit, and inventory stay accurate."
            />
          ) : (
            <div className="glass-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                      <th className="px-5 py-3.5 font-medium">Date</th>
                      <th className="px-5 py-3.5 font-medium">Product</th>
                      <th className="px-5 py-3.5 font-medium">Type</th>
                      <th className="px-5 py-3.5 font-medium text-right">Units</th>
                      <th className="px-5 py-3.5 font-medium text-right">Amount</th>
                      <th className="px-5 py-3.5 font-medium text-right">Per unit</th>
                      <th className="px-5 py-3.5 font-medium">Note</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242526]/6">
                    {sales.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3.5 font-sans text-[#64717a]">
                          {formatShortDate(s.soldAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[#20282c] font-medium">{s.productName}</td>
                        <td className="px-5 py-3.5">
                          {s.kind === "giveaway" ? (
                            <Pill tone="warn">Free shipment</Pill>
                          ) : (
                            <Pill tone="neutral">Sale</Pill>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">{s.units}</td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {s.kind === "giveaway" ? (
                            <span className="text-[#64717a]">Free</span>
                          ) : (
                            formatCurrency(s.totalAmount)
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {s.kind === "giveaway" ? (
                            <span className="text-[#64717a]">—</span>
                          ) : (
                            formatCurrency(s.pricePerUnit)
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[#64717a] max-w-[240px] truncate">
                          {s.note ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => removeSale(s.id)}
                            className="text-[#64717a] hover:text-red-600 transition-colors"
                            aria-label="Delete sale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------ EXPENSES ---------------------------- */}
      {tab === "expenses" && (
        <div>
          <div className="glass-surface rounded-lg p-5 sm:p-6 mb-6">
            <SectionTitle eyebrow="New entry" title="Add an expense" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Description</label>
                <input
                  value={eLabel}
                  onChange={(e) => setELabel(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Shipping supplies, ads, software"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Category (optional)</label>
                <input
                  value={eCategory}
                  onChange={(e) => setECategory(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Shipping"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Amount ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={eAmount}
                  onChange={(e) => setEAmount(e.target.value)}
                  placeholder="e.g. 120"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={eDate}
                  onChange={(e) => setEDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Note (optional)</label>
                <input
                  value={eNote}
                  onChange={(e) => setENote(e.target.value)}
                  maxLength={1000}
                  placeholder="Anything worth remembering about this cost"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button onClick={addExpense} disabled={eSaving} className={primaryBtnCls}>
                {eSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add expense
              </button>
              {eError && <span className="text-sm text-red-600">{eError}</span>}
            </div>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              description="Log operating costs (packaging, ads, software, fees) so net profit reflects reality."
            />
          ) : (
            <div className="glass-surface rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                      <th className="px-5 py-3.5 font-medium">Date</th>
                      <th className="px-5 py-3.5 font-medium">Description</th>
                      <th className="px-5 py-3.5 font-medium">Category</th>
                      <th className="px-5 py-3.5 font-medium text-right">Amount</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242526]/6">
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-3.5 font-sans text-[#64717a]">
                          {formatShortDate(e.incurredAt)}
                        </td>
                        <td className="px-5 py-3.5 text-[#20282c] font-medium">
                          {e.label}
                          {e.note && (
                            <span className="block text-[11px] text-[#64717a] mt-0.5 max-w-[320px] truncate">
                              {e.note}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {e.category ? <Pill tone="neutral">{e.category}</Pill> : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => removeExpense(e.id)}
                            className="text-[#64717a] hover:text-red-600 transition-colors"
                            aria-label="Delete expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------- STOCK HISTORY MODAL ----------------------- */}
      {historyItem && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#20282c]/40 backdrop-blur-sm p-4 sm:p-8"
          onClick={closeHistory}
        >
          <div
            className="w-full max-w-3xl rounded-lg bg-[#F7F6F2] shadow-2xl my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[#242526]/8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
                  Stock history · last 90 days
                </p>
                <h2 className="text-xl font-medium text-[#20282c] mt-1">
                  {historyItem.name}
                </h2>
                <p className="text-xs text-[#64717a] font-sans mt-1">
                  {historyItem.unitsOnHand} on hand · {historyItem.unitsSold} sold ·{" "}
                  {historyItem.unitsPurchased} purchased
                </p>
              </div>
              <button
                onClick={closeHistory}
                className="rounded-full p-2 text-[#64717a] hover:bg-[#20282c]/[0.06] hover:text-[#20282c] transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {historyLoading || !history ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[#64717a]" />
                </div>
              ) : (
                <>
                  <AreaChart
                    data={historyChartData}
                    granularity="day"
                    primaryLabel="Units deducted"
                    secondaryLabel="On hand"
                    height={240}
                    formatValue={(n) => Math.round(n).toLocaleString()}
                  />

                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mb-3">
                      Deductions &amp; restocks
                    </p>
                    {history.events.length === 0 ? (
                      <p className="text-sm text-[#64717a] py-4">
                        No activity recorded for this product yet.
                      </p>
                    ) : (
                      <div className="rounded-lg border border-[#242526]/8 overflow-hidden">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-[#F7F6F2]">
                              <tr className="text-left text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a] border-b border-[#242526]/8">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">What</th>
                                <th className="px-4 py-3 font-medium">Who / note</th>
                                <th className="px-4 py-3 font-medium text-right">Units</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#242526]/6">
                              {history.events.map((e, i) => (
                                <tr key={`${e.date}-${e.reference}-${i}`}>
                                  <td className="px-4 py-3 font-sans text-[#64717a] whitespace-nowrap">
                                    {formatShortDate(e.date)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {e.type === "purchase" ? (
                                      <Pill tone="success">{e.reference}</Pill>
                                    ) : e.type === "offline" ? (
                                      <Pill tone="neutral">{e.reference}</Pill>
                                    ) : e.type === "giveaway" ? (
                                      <Pill tone="warn">{e.reference}</Pill>
                                    ) : e.type === "adjustment" ? (
                                      <Pill tone={e.adds ? "success" : "warn"}>
                                        {e.reference}
                                      </Pill>
                                    ) : (
                                      <span className="text-[#20282c] font-medium">
                                        {e.reference}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-[#64717a] max-w-[200px] truncate">
                                    {e.detail ?? "—"}
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-right font-sans font-medium ${
                                      e.type === "purchase" || e.adds
                                        ? "text-emerald-700"
                                        : "text-[#20282c]"
                                    }`}
                                  >
                                    {e.type === "purchase" || e.adds
                                      ? `+${e.units}`
                                      : `−${e.units}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-[#64717a] font-sans mt-3">
                      The line shows units deducted per day; the dashed line is stock on
                      hand at the end of each day. Orders, offline sales, free
                      shipments, and restocks since tracking began are listed newest
                      first.
                      {history.truncated &&
                        " Note: the order scan hit its safety cap — counts may be slightly under."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
