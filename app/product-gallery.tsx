"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type Product } from "@/lib/catalog";
import { packageContents, productArt } from "@/lib/product-art";
import { productPresentation } from "@/lib/product-presentation";
import { ProductFactArt } from "./product-fact-art";

export const galleryChapters = ["The packaging", "The daily ritual", "Formula focus", "The detail"];

export function ProductGalleryPanel({ product: p, index }: { product: Product; index: number }) {
  const art = productArt[p.id];
  const presentation = productPresentation[p.id];
  const contents = packageContents(p);
  if (art && index === 1) return <figure className="visual-panel visual-editorial">
    <div className="visual-image-frame"><img src={art.scene} alt={art.sceneAlt} width={1254} height={1254} fetchPriority="high" /></div>
    <figcaption><p>{art.caption}</p></figcaption>
  </figure>;
  if (presentation && index === 2) return <figure className="visual-panel visual-formula-fact"><ProductFactArt data={presentation}/></figure>;
  if (presentation && index === 3) return <figure className="visual-panel visual-detail">
    <div className="visual-image-frame"><img src={presentation.detail} alt={presentation.detailAlt} width={1024} height={1280} loading="lazy" /></div>
    <figcaption><p>{presentation.detailLabel}</p></figcaption>
  </figure>;
  const extra = index > 3 ? p.images?.slice(2).filter(image => image.src !== p.image && image.src !== art?.scene && image.src !== presentation?.detail)[index - 4] : undefined;
  return <figure className="visual-panel visual-pack">
    <div className="visual-image-frame"><img src={extra?.src || p.image} alt={extra?.alt || `IQON ${p.name} packaging, ${contents}`} width={1122} height={1402} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : undefined} /></div>
    <figcaption className="sr-only">{extra ? extra.alt : contents}</figcaption>
  </figure>;
}

export function ProductGallery({ product }: { product: Product }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const extras = product.images?.slice(2).filter(image => image.src !== product.image && image.src !== productArt[product.id]?.scene && image.src !== productPresentation[product.id]?.detail) || [];
  const chapters = productPresentation[product.id] ? [...galleryChapters, ...extras.map((_, i) => `Product detail ${i + 2}`)] : ["The packaging"];
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
    <Dialog open={zoom !== null} onOpenChange={open => { if (!open) setZoom(null); }}><DialogContent className="visual-gallery-dialog"><DialogTitle className="sr-only">{product.name} — {chapters[zoom || 0]}</DialogTitle><DialogDescription className="sr-only">Expanded product photograph and information</DialogDescription><ProductGalleryPanel product={product} index={zoom || 0} /></DialogContent></Dialog>
  </div>;
}
