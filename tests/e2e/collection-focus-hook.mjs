// Extend the existing isolated catalog. Real repository images, synthetic inventory.
// Gut Health deliberately remains discoverable while unavailable to purchase.
import './premium-catalog-hook.mjs';
import {products} from '../../lib/catalog.ts';
const fixtureFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const response=await fixtureFetch(input,init);
 if(!String(init?.body||'').includes('IQONCatalog'))return response;
 const data=await response.clone().json();
 // Exclude the generic kit/redirect fixtures, whose placeholder CDN images do not exist.
 if(data.data?.products?.nodes)data.data.products.nodes=data.data.products.nodes.filter(p=>products.some(original=>original.id===p.handle));
 const gut=data.data?.products?.nodes?.find(p=>p.handle==='gut-health');
 if(gut){gut.availableForSale=false;gut.variants.nodes.forEach(v=>v.availableForSale=false);}
 return Response.json(data,{status:response.status});
};
