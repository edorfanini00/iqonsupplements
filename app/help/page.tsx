import type { Metadata } from "next";
import { HelpQuestions } from "./help-questions";
import { publicPageMetadata } from "@/lib/seo.server";
// The answers describe live ordering; the preview/unavailable copy must not be indexed.
export async function generateMetadata():Promise<Metadata>{return publicPageMetadata({path:"/help",title:"Questions & care | IQON",description:"Answers about ordering, shipping, product information and your saved bag at IQON.",requiresLiveCatalog:true});}
export default function HelpPage(){return <HelpQuestions/>;}
