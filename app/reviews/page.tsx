import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CustomerReviews } from "../customer-reviews";
export default function ReviewsPage(){return <main id="main"><header className="content-heading section-pad"><p className="eyebrow">THE IQON COMMUNITY</p><h1>Your experience<br/>has a place here.</h1><p>Customer perspectives on the IQON supplement and skincare collections.</p></header><CustomerReviews/><section className="reviews-care section-pad"><h2>Questions before you choose?</h2><Link className="under-link" href="/help">Visit questions & care<ArrowUpRight size={17}/></Link></section></main>;}
