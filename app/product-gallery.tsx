"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { productVisuals } from "@/lib/product-visuals";

export const galleryChapters = ["The product", "Why choose it", "Formula focus", "Your routine", "Inside the formula"];

export function ProductGalleryPanel({ product: p, index }: { product: Product; index: number }) {
  const v = productVisuals[p.id];
  const c = productContent[p.id];
  if (index > 4 && p.images?.[index - 3]) return <div className="visual-panel visual-pack"><img src={p.images[index - 3].src} alt={p.images[index - 3].alt} width={1122} height={1402} loading="lazy" /></div>;
  if (!v || index === 0) return <div className="visual-panel visual-pack">
    <img src={p.image} alt={`IQON ${p.name} packaging`} width={1122} height={1402} fetchPriority="high" />
    <div className="visual-pack-caption"><span>{p.category === "skincare" ? "DAILY SKINCARE" : "DAILY NUTRITION"}</span><p>{v?.headline || p.descriptor}</p></div>
  </div>;
  if (index === 1) return <div className="visual-panel visual-benefits">
    <span className="visual-kicker">WHY {p.category === "skincare" ? "YOUR SKIN" : "YOUR ROUTINE"} WILL LOVE IT</span>
    <h2>{v.benefitTitle}</h2><ul>{v.benefits.map((b, i) => <li key={b}><span>{String(i + 1).padStart(2, "0")}</span>{b}</li>)}</ul>
    <span className="visual-signature">IQON / {p.type.toUpperCase()}</span>
  </div>;
  if (index === 2) return <div className="visual-panel visual-fact">
    <span className="visual-kicker">THE FORMULA, IN FOCUS</span>
    <strong className={v.fact.value.length > 5 ? "visual-metric is-long" : "visual-metric"}>{v.fact.value}</strong>
    <h2>{v.fact.label}</h2><p>{v.fact.body}</p><span className="visual-signature">{p.name}</span>
  </div>;
  if (index === 3) return <div className="visual-panel visual-ritual">
    <img src={v.image} alt={v.imageAlt} width={1600} height={1000} loading="lazy" />
    <div><span className="visual-kicker">THE EVERYDAY RITUAL</span><h2>{v.ritualTitle}</h2><p>{c?.comparison?.routine}</p></div>
  </div>;
  return <div className="visual-panel visual-formula">
    <img src={p.images?.[1]?.src || p.campaign || p.image} alt={p.images?.[1]?.alt || `IQON ${p.name} studio detail`} width={1122} height={1402} loading="lazy" />
    <div><span className="visual-kicker">INSIDE THE FORMULA</span><p>{c?.ingredients?.map(i => i.name).join(" / ")}</p></div>
  </div>;
}

export function ProductGallery({ product }: { product: Product }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const chapters = productVisuals[product.id] ? [...galleryChapters, ...(product.images?.slice(2).map((_, i) => `Product detail ${i + 2}`) || [])] : [galleryChapters[0]];
  const count = chapters.length;
  const go = (index: number) => {
    const next = Math.min(count - 1, Math.max(0, index));
    const el = rail.current?.children[next] as HTMLElement | undefined;
    if (el && rail.current) rail.current.scrollTo({ left: el.offsetLeft - (rail.current.children[0] as HTMLElement).offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    setActive(next);
  };
  return <div className="product-visual-gallery">
    <div ref={rail} className="product-visual-grid" role="region" aria-label={`${product.name} visual product guide`} tabIndex={0}
      onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(active + (e.key === "ArrowRight" ? 1 : -1)); } }}
      onScroll={() => { const el = rail.current; if (!el || el.scrollWidth <= el.clientWidth) return; const children = Array.from(el.children) as HTMLElement[]; const first = children[0].offsetLeft; const next = children.reduce((best, child, i) => Math.abs(child.offsetLeft - first - el.scrollLeft) < Math.abs(children[best].offsetLeft - first - el.scrollLeft) ? i : best, 0); setActive(next); }}>
      {chapters.map((chapter, index) => <article className={`visual-gallery-item visual-gallery-item-${index}`} key={chapter}>
        <ProductGalleryPanel product={product} index={index} />
        <button className="visual-enlarge" aria-label={`Enlarge ${chapter.toLowerCase()} for ${product.name}`} onClick={() => setZoom(index)}><Plus size={18} /></button>
      </article>)}
    </div>
    <div className="visual-gallery-controls"><button aria-label="Previous product panel" disabled={active === 0} onClick={() => go(active - 1)}><ArrowLeft size={18} /></button><div><span aria-live="polite">{chapters[active]}</span><div className="visual-gallery-dots">{chapters.map((chapter, i) => <button key={chapter} aria-label={`View ${chapter.toLowerCase()}`} aria-current={active === i ? "true" : undefined} onClick={() => go(i)} />)}</div></div><button aria-label="Next product panel" disabled={active === count - 1} onClick={() => go(active + 1)}><ArrowRight size={18} /></button></div>
    <Dialog open={zoom !== null} onOpenChange={open => { if (!open) setZoom(null); }}><DialogContent className="visual-gallery-dialog"><DialogTitle className="sr-only">{product.name} — {chapters[zoom || 0]}</DialogTitle><DialogDescription className="sr-only">Expanded product information panel</DialogDescription><ProductGalleryPanel product={product} index={zoom || 0} /></DialogContent></Dialog>
  </div>;
}
