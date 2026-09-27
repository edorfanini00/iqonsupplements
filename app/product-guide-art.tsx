import { Moon, Sun, ArrowDown, Droplets } from "lucide-react";
import type { GalleryGuide } from "@/lib/product-gallery-content";

/** Native vector format diagrams: sharp at every size, with real selectable text. */
export function ProductGuideArt({ data }: { data: GalleryGuide }) {
  return <div className={`product-guide-art guide-${data.design}`}>
    <p className="guide-eyebrow">{data.eyebrow}</p>
    <h3>{data.title}</h3>
    <div className="guide-center">
      {data.design === "mix" && <div className="mix-graphic">
        <svg viewBox="0 0 200 190" aria-hidden="true"><path d="M61 43h78l-9 125H70Z" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M65 92c18-7 44 7 70 0l-5 76H70Z" fill="currentColor" opacity=".1"/><path d="M65 92c18-7 44 7 70 0" fill="none" stroke="currentColor" strokeWidth="1"/><path d="m124 16-18 117" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M49 44H31m18 124H31m9-119v114" fill="none" stroke="currentColor" opacity=".4"/></svg>
        <div><strong>{data.main}</strong><span>{data.unit}</span></div>
      </div>}
      {data.design === "capsule" && <div className="dose-graphic"><svg viewBox="0 0 200 120" aria-hidden="true"><g transform="rotate(-28 100 60)"><rect x="32" y="29" width="136" height="62" rx="31" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M100 30h37a30 30 0 0 1 0 60h-37Z" fill="currentColor" opacity=".13"/><path d="M100 30v60" stroke="currentColor" strokeWidth="1"/></g></svg><div><strong>{data.main}</strong><span>{data.unit}</span></div></div>}
      {data.design === "gummy" && <div className="dose-graphic"><svg viewBox="0 0 200 120" aria-hidden="true"><path d="M34 74c0-22 14-43 31-43s31 21 31 43c0 24-62 24-62 0ZM109 74c0-22 14-43 31-43s31 21 31 43c0 24-62 24-62 0Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.3"/></svg><div><strong>{data.main}</strong><span>{data.unit}</span></div></div>}
      {data.design === "amounts" && <div className="guide-major-amount"><strong>{data.main}</strong><span>{data.unit}</span></div>}
      {data.design === "daynight" && <div className="daynight-graphic" aria-hidden="true">{data.items.map((item,i)=><span key={item.value}>{item.value === "PM" ? <Moon strokeWidth={.9}/> : <Sun strokeWidth={.9}/>}<i className={i ? undefined : "daynight-connector"}/></span>)}</div>}
      {data.design === "eye" && <svg className="eye-graphic" viewBox="0 0 280 130" aria-hidden="true"><path d="M40 62q100-70 200 0-100 65-200 0Z" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M119 37a28 28 0 1 0 42 0" fill="none" stroke="currentColor" strokeWidth="1.1"/><circle cx="140" cy="58" r="11" fill="currentColor" opacity=".18"/><path d="M51 94q90 51 178 0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 15" opacity=".6"/></svg>}
      {data.design === "routine" && <div className="routine-graphic" aria-hidden="true"><Droplets strokeWidth={.85}/><ArrowDown strokeWidth={1}/><span>{data.main}</span></div>}
      {data.design === "pairing" && <div className="pairing-graphic" aria-hidden="true">{data.items.map(item=><span key={item.label}>{item.value}</span>)}</div>}
      <dl className="guide-values">{data.items.map((item,i)=><div key={item.label}><dt className={data.design === "pairing" ? "sr-only" : undefined}>{item.value}</dt><dd>{item.label}</dd>{data.design === "routine" && <span aria-hidden="true">{String(i+1).padStart(2,"0")}</span>}</div>)}</dl>
    </div>
    <p className="guide-note">{data.note}</p>
  </div>;
}
