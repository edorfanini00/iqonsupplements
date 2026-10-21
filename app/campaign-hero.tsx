import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { localSrcSet, shopifySrcSet } from "@/lib/responsive-images";

const MOBILE_HERO = "/images/editorial/iqon-coastal-mobile-v32.webp";
// The mobile frame is inset 8px and 660px tall; below 388px the portrait photograph is cropped by
// its height, so it still needs 372px of width.
const MOBILE_HERO_SIZES = "(max-width:388px) 372px, calc(100vw - 16px)";

/** Shared dimensions keep the two departments steady when switching. */
export function CampaignHero({ skincare = false, featured }: { skincare?: boolean; featured?: Product }) {
  return <section className={`campaign-hero ${skincare ? "campaign-hero-skin" : ""}`}>
    <picture className="campaign-image">{!skincare&&<source media="(max-width:760px)" srcSet={localSrcSet(MOBILE_HERO)} sizes={MOBILE_HERO_SIZES}/>}<img
      src={skincare ? "/images/editorial/iqon-skincare-hero-v29.webp" : "/images/editorial/iqon-coastal-hero-v32.webp"}
      alt={skincare ? "An everyday moment of skincare in soft window light" : "A shared moment beside the ocean after a run"}
      width={skincare ? 1536 : 1672} height={skincare ? 1024 : 941} fetchPriority="high" />
    </picture>
    <div className="campaign-copy">
      <p className="eyebrow">IQON / {skincare ? "SKINCARE / COMING SOON" : "DAILY ESSENTIALS"}</p>
      <h1>{skincare ? <>A little care.{" "}<br />A lot of you.</> : <>For the life{" "}<br />you want to live.</>}</h1>
      <p>{skincare ? "Cleanse. Treat. Moisturize. A routine that’s yours." : "Everyday essentials, made to fit your life."}</p>
      <Link href={`/collections/${skincare ? "skincare" : "supplements"}`} className="button button-light">Explore {skincare ? "skincare" : "supplements"}<ArrowRight size={18}/></Link>
    </div>
    {featured && <Link className="campaign-feature" href={`/products/${featured.id}`}>
      <img src={featured.image} srcSet={shopifySrcSet(featured.image)} sizes="66px" alt="" width={100} height={125} loading="lazy"/>
      <span><small>MEET THE COLLECTION</small><strong>{featured.name}</strong><span>{featured.type} · {featured.size}</span></span><ArrowUpRight size={19}/>
    </Link>}
    <span className="campaign-index" aria-hidden="true">{skincare ? "02" : "01"} / IQON</span>
  </section>;
}
