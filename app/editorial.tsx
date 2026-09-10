import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { journalArticles } from "@/lib/journal";

export function HumanStory({skincare=false,compact=false,movement=false}:{skincare?:boolean;compact?:boolean;movement?:boolean}) {
  return <section className={`human-story ${skincare?"human-story-skin":""} ${compact?"human-story-compact":""}`}>
    <div className="human-story-image"><picture>{skincare&&<source media="(max-width:760px)" srcSet="/images/editorial/skin-ritual.webp"/>}<img src={skincare?"/images/editorial/skin-ritual-desktop.webp":movement?"/images/editorial/iqon-pilates-editorial.webp":"/images/editorial/everyday-movement.webp"} alt={skincare?"A woman taking a moment for her skincare routine":movement?"A woman tying her shoes before Pilates":"Two adults talking during a coastal walk"} width={skincare?3840:1800} height={skincare?2160:1200} loading="lazy"/></picture></div>
    <div className="human-story-copy"><p className="eyebrow">{skincare?"A MOMENT THAT’S YOURS":movement?"MAKE TIME FOR YOU":"FOR THE LIFE YOU LIVE"}</p><h2>{skincare?<>A little care.<br/>Every day.</>:movement?<>Small rituals.<br/>A fuller life.</>:<>More room<br/>for living.</>}</h2><p>{skincare?"At the beginning of the day. At the end of the evening. A few familiar steps, and a moment to come back to yourself.":movement?"Making it to the class. Getting outside. Taking a moment before the day begins. A routine is more than the products on your shelf.":"The walk you look forward to. The people you make time for. The everyday moments that make a routine worth keeping."}</p><Link className="under-link" href={skincare?"/journal/a-simple-skincare-routine":"/approach"}>{skincare?"Find your skincare rhythm":"Our point of view"}<ArrowUpRight size={17}/></Link></div>
  </section>;
}

export function EverydayNote({skincare=false}:{skincare?:boolean}) {
 return <section className="everyday-note section-pad"><p className="eyebrow">{skincare?"IQON / SKINCARE":"IQON / EVERY DAY"}</p><div><h2>{skincare?"Good routines leave room for you.":"Your routine should fit your life."}</h2><p>{skincare?"Start with the essentials. Get to know each product. Keep the steps that work for you.":"A considered collection of supplements and skincare. Clear choices, familiar rituals, and the freedom to find your own rhythm."}</p></div><Link className="under-link" href="/approach">Meet IQON<ArrowUpRight size={16}/></Link></section>;
}

export function JournalPreview({skincare=false}:{skincare?:boolean}) {
 const articles=skincare?[...journalArticles].sort((a,b)=>Number(b.slug==="a-simple-skincare-routine")-Number(a.slug==="a-simple-skincare-routine")):journalArticles;
 return <section className="journal-preview section-pad"><div className="section-heading"><div><p className="eyebrow">LATEST NEWS</p><h2>A little more understanding.</h2></div><Link className="under-link" href="/journal">All stories<ArrowUpRight size={16}/></Link></div><div className="journal-grid">{articles.map(a=><Link className="journal-card" key={a.slug} href={`/journal/${a.slug}`}><div><img src={a.image} alt={a.imageAlt} width={900} height={675} loading="lazy"/></div><p className="eyebrow">{a.category} <span>{a.readTime}</span></p><h3>{a.title}<ArrowUpRight size={21}/></h3><p>{a.dek}</p></Link>)}</div></section>;
}

/** One continuous photograph, with copy positioned inside its natural negative space. */
export function SkincareCampaign({crosslink=false}:{crosslink?:boolean}) {
 return <section className="product-campaign product-campaign-skin">
  <picture><source media="(max-width:760px)" srcSet="/images/editorial/skincare-campaign-mobile.webp"/><img src="/images/editorial/skincare-campaign-desktop.webp" alt="IQON Peptide Serum and Barrier Cream in a silver and glass studio study" width={3168} height={1344} loading="lazy"/></picture>
  <div className="product-campaign-copy"><p className="eyebrow">{crosslink?"ALSO FROM IQON":"THE SKINCARE COLLECTION"}</p><h2>A few essentials.<br/><span>A moment for you.</span></h2><Link className="button button-light" href={crosslink?"/skincare":"/products/peptide-serum"}>{crosslink?"Explore skincare":"Discover Peptide Serum"}<ArrowUpRight size={16}/></Link></div>
 </section>;
}
