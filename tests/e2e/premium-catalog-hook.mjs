// Synthetic commerce with actual repository imagery, served normally by Next.
// No production credentials, external mutations or browser asset substitutions.
import '../seo/fake-shopify-hook.mjs';
import {products} from '../../lib/catalog.ts';
const fakeFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const response=await fakeFetch(input,init);
 let body;try{body=JSON.parse(init?.body||'{}');}catch{return response;}
 if(!/IQON(Catalog|Cart)/.test(body.query||''))return response;
 const data=await response.json();
 for(const node of data.data?.products?.nodes||[]){
  const original=products.find(p=>p.id===node.handle);
  if(!original)continue;
  node.title=original.name;
  node.images={nodes:original.images?.map(i=>({url:i.src,altText:i.alt}))||[{url:original.image,altText:original.name}]};
 }
 // The synthetic cart must deliver the same real asset as its catalog product.
 const visit=value=>{
  if(!value||typeof value!=="object")return;
  const handle=value.merchandise?.product?.handle;
  const original=products.find(p=>p.id===handle);
  if(original){value.merchandise.image={url:original.image,altText:original.name};value.merchandise.product.title=original.name;}
  for(const child of Object.values(value))visit(child);
 };
 visit(data);
 return Response.json(data);
};
