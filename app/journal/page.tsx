import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { journalArticles } from "@/lib/journal";
import { publicPageMetadata } from "@/lib/seo.server";
export async function generateMetadata():Promise<Metadata>{return publicPageMetadata({path:"/journal",title:"Supplement & skincare guides | IQON",description:"Useful details and everyday routines. A closer look at supplements and skincare from IQON."});}
export default function JournalPage(){return <main id="main"><header className="journal-heading section-pad"><p className="eyebrow">LATEST NEWS</p><h1>A little more{" "}<br/>understanding.</h1><p>Useful details. Everyday routines.{" "}<br/>A closer look at supplements and skincare.</p></header><section className="journal-index section-pad"><div className="journal-grid">{journalArticles.map(a=><Link href={`/journal/${a.slug}`} key={a.slug} className="journal-card"><div><img src={a.image} alt={a.imageAlt} width={900} height={675}/></div><p className="eyebrow">{a.category}<span>{a.readTime}</span></p><h2>{a.title}<ArrowUpRight size={22}/></h2><p>{a.dek}</p></Link>)}</div></section></main>;}
