import { notFound } from "next/navigation";
import { CollectionPage } from "../../shop-pages";
export default async function CollectionRoute({params,searchParams}:{params:Promise<{category:string}>;searchParams:Promise<{format?:string;sort?:string}>}){const {category}=await params;const query=await searchParams;if(!["all","supplements","skincare"].includes(category))notFound();return <CollectionPage category={category as "all"|"supplements"|"skincare"} initialFormat={typeof query.format==="string"?query.format:"all"} initialSort={typeof query.sort==="string"?query.sort:"featured"}/>;}
