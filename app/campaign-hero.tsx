import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/catalog";

/** Shared dimensions keep the two departments steady when switching. */
export function CampaignHero({ skincare = false, featured }: { skincare?: boolean; featured?: Product }) {
  return <section className={`campaign-hero ${skincare ? "campaign-hero-skin" : ""}`}>
    <picture className="campaign-image">{!skincare&&<source media="(max-width:760px)" srcSet="/images/editorial/iqon-coastal-mobile.webp"/>}<img
      src={skincare ? "/images/editorial/iqon-skincare-hero.webp" : "/images/editorial/iqon-coastal-hero.webp"}
      alt={skincare ? "An everyday moment of skincare in soft window light" : "A shared moment beside the ocean after a run"}
      width={skincare ? 1536 : 3840} height={skincare ? 1024 : 2160} fetchPriority="high" />
    </picture>
    <div className="campaign-copy">
      <p className="eyebrow">IQON / {skincare ? "SKINCARE" : "DAILY ESSENTIALS"}</p>
      <h1>{skincare ? <>A little care.<br />A lot of you.</> : <>For the life<br />you want to live.</>}</h1>
      <p>{skincare ? "Cleanse. Treat. Moisturize. A routine that’s yours." : "Everyday essentials, made to fit your life."}</p>
      <Link href={`/collections/${skincare ? "skincare" : "supplements"}`} className="button button-light">Explore {skincare ? "skincare" : "supplements"}<ArrowRight size={18}/></Link>
    </div>
    {featured && <Link className="campaign-feature" href={`/products/${featured.id}`}>
      <img src={featured.image} alt="" width={100} height={125}/>
      <span><small>MEET THE COLLECTION</small><strong>{featured.name}</strong><span>{featured.type} · {featured.size}</span></span><ArrowUpRight size={19}/>
    </Link>}
    <span className="campaign-index" aria-hidden="true">{skincare ? "02" : "01"} / IQON</span>
  </section>;
}
