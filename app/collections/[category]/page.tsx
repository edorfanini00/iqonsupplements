import { notFound } from "next/navigation";
import { CollectionPage } from "../../shop-pages";
export default async function CollectionRoute({params}:{params:Promise<{category:string}>}){const {category}=await params;if(!["all","supplements","skincare"].includes(category))notFound();return <CollectionPage key={category} category={category as "all"|"supplements"|"skincare"}/>;}
