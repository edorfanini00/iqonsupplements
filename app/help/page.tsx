import type { Metadata } from "next";
import { HelpQuestions } from "./help-questions";
export const metadata:Metadata={title:"Questions & care | IQON",description:"Answers about ordering, shipping, product information and your saved bag at IQON."};
export default function HelpPage(){return <HelpQuestions/>;}
