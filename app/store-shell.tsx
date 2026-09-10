"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { ArrowRight, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StoreNavigation } from "./store-navigation";
import { departmentHome } from "@/lib/departments";
import type { Category } from "@/lib/catalog";
import { money, productPrice, unitPrice, lineKey, validateCart, type CartItem, type Purchase, type Product, type StoreCatalog } from "@/lib/catalog";

type StoreContextType = {department:Category; products:Product[]; mode:StoreCatalog["mode"]; currency:string; busy:boolean; ready:boolean; error:string; checkout:()=>void; retryCart:()=>void; cart: CartItem[]; add: (id:string,quantity?:number,purchase?:Purchase,frequency?:string,variantId?:string)=>void; update:(key:string,quantity:number)=>void; openBag:()=>void; closeBag:()=>void; subtotal:number; count:number};
const StoreContext = createContext<StoreContextType | null>(null);
export function useStore() {const value=useContext(StoreContext); if(!value) throw new Error("Store context missing"); return value;}
// The supplied logo is used verbatim. The viewBox removes only its transparent canvas.
export function Wordmark({large=false}:{large?:boolean}) {return <svg className={`wordmark wordmark-artwork ${large?"wordmark-large":""}`} viewBox="172 64 265 97" role="img" aria-label="IQON" focusable="false"><image href="/images/brand/iqon-logo.png" width="600" height="225"/></svg>;}

export function StoreShell({children,catalog}:{children:ReactNode;catalog:StoreCatalog}) {
  const {products,mode}=catalog; const router=useRouter(); const findProduct=(id:string)=>products.find(p=>p.id===id);
  const pathname=usePathname();
  const [cart,setCart]=useState<CartItem[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [bag,setBag]=useState(false);
  const [search,setSearch]=useState(false);
  const [preferredDepartment,setPreferredDepartment]=useState<Category>("supplements");
  const routeDepartment:Category|undefined=pathname==="/"?"supplements":pathname.startsWith("/skincare")||pathname.startsWith("/collections/skincare")?"skincare":pathname.startsWith("/collections/supplements")?"supplements":products.find(p=>pathname===`/products/${p.id}`)?.category;
  const department=routeDepartment||preferredDepartment;
  if(routeDepartment&&preferredDepartment!==routeDepartment)setPreferredDepartment(routeDepartment);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [error,setError]=useState("");
  const [shopSubtotal,setShopSubtotal]=useState(0);
  const [shopCurrency,setShopCurrency]=useState(catalog.currency);
  const live=mode==="live";
  const currency=live?shopCurrency:catalog.currency;
  const applySnapshot=(data:{items:CartItem[];subtotal:number;currency:string;notice?:string})=>{
    setCart(data.items);setShopSubtotal(data.subtotal);setShopCurrency(data.currency);setError(data.notice||"");
  };
  async function requestCart(input?:Record<string,unknown>) {
    const response=await fetch("/api/cart",input?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}:{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"We couldn’t update your bag. Please try again.");
    applySnapshot(data);
  }
  const retryCart=async()=>{
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");
    try {await requestCart();setHydrated(true);}catch(e){setError(e instanceof Error?e.message:"Your bag is temporarily unavailable.");}
    finally {lock.current=false;setBusy(false);}
  };
  useEffect(()=>{
    if(live){void retryCart();return;}
    if(mode==="preview")try{setCart(validateCart(JSON.parse(localStorage.getItem("iqon-store-bag-v2")||"[]")));}catch{}
    setHydrated(true);
  },[mode]);
  useEffect(()=>{if(hydrated&&mode==="preview")try{localStorage.setItem("iqon-store-bag-v2",JSON.stringify(cart));}catch{}},[cart,hydrated,mode]);
  useEffect(()=>{setBag(false);setSearch(false);},[pathname]);
  const subtotal=useMemo(()=>live?shopSubtotal:cart.reduce((sum,item)=>{const p=findProduct(item.id);return sum+(p?unitPrice(p,item.purchase)*item.quantity:0);},0),[cart,products,live,shopSubtotal]);
  const count=cart.reduce((sum,item)=>sum+item.quantity,0);
  const transact=async(input:Record<string,unknown>)=>{
    if(lock.current||!hydrated)return;
    lock.current=true;setBusy(true);setError("");
    try {await requestCart(input);}catch(e){setError(e instanceof Error?e.message:"We couldn’t update your bag. Please try again.");}
    finally{lock.current=false;setBusy(false);}
  };
  const add=(id:string,quantity=1,purchase:Purchase="once",frequency="once",variantId?:string)=>{
    const p=findProduct(id);if(!p||p.pricePending||mode==="unavailable")return;
    if(live){
      if(p.variants&&p.variants.length>1&&!variantId){router.push(`/products/${id}`);return;}
      const variant=p.variants?.find(v=>v.id===variantId)||p.variants?.find(v=>v.available);
      if(!variant||!p.available)return;
      setBag(true);void transact({action:"add",id,quantity,variantId:variant.id});return;
    }
    const item={id,quantity:Math.max(1,Math.min(20,Math.floor(quantity))),purchase,frequency:purchase==="once"?"once":frequency};
    setCart(current=>{const key=lineKey(item);const exists=current.some(i=>lineKey(i)===key);return exists?current.map(i=>lineKey(i)===key?{...i,quantity:Math.min(20,i.quantity+item.quantity)}:i):[...current,item];});setBag(true);
  };
  const update=(key:string,quantity:number)=>{
    if(live){void transact({action:"update",lineId:key,quantity});return;}
    setCart(current=>current.map(i=>lineKey(i)===key?{...i,quantity:Math.min(20,Math.max(0,Math.floor(quantity)))}:i).filter(i=>i.quantity>0));
  };
  const checkout=async()=>{
    if(!live||lock.current||!hydrated)return;
    lock.current=true;setBusy(true);setError("");
    try{
      const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Checkout is temporarily unavailable.");
      window.location.assign(data.checkoutUrl);
    }catch(e){setError(e instanceof Error?e.message:"Checkout is temporarily unavailable.");lock.current=false;setBusy(false);}
  };
  const value={department,products,mode,currency,busy,ready:hydrated,error,checkout,retryCart,cart,add,update,openBag:()=>setBag(true),closeBag:()=>setBag(false),subtotal,count};
  const results=products.filter(p=>`${p.name} ${p.type} ${p.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <StoreContext.Provider value={value}>
    <a className="skip-link" href="#main">Skip to content</a>
    {mode==="preview"&&<div className="preview-ribbon">STORE PREVIEW <span className="preview-review-notice">Illustrative ratings &amp; review counts</span><span>Orders are not enabled · Skincare concepts & sample pricing</span></div>}{mode==="unavailable"&&<div className="preview-ribbon" role="status">The collection is temporarily unavailable. Please try again shortly.</div>}
    <StoreNavigation key={`${pathname}:${department}`} department={department} setDepartment={setPreferredDepartment} products={products} currency={currency} count={count} logo={<Wordmark/>} openSearch={()=>setSearch(true)} openBag={()=>setBag(true)}/>
    {children}
    <Footer/>
    <Sheet open={bag} onOpenChange={setBag}><SheetContent className="bag-sheet"><div className="sheet-heading"><SheetTitle>Your bag <span>({count})</span></SheetTitle><SheetDescription>A little more intention, every day.</SheetDescription></div>{error&&<div className="commerce-message" role="alert"><p>{error}</p><button className="under-link" disabled={busy} onClick={()=>void retryCart()}>Refresh bag</button></div>}{busy&&<p className="commerce-message" role="status">Updating your bag…</p>}{cart.length?<><div className="bag-lines">{cart.map(item=><CartLine key={lineKey(item)} item={item}/>)}</div><div className="bag-recommend"><p className="eyebrow">COMPLETE YOUR ROUTINE</p>{(()=>{const p=products.find(p=>p.available!==false&&!cart.some(i=>i.id===p.id));return p?<div><img src={p.image} alt={p.name}/><span><strong>{p.name}</strong><small>{productPrice(p)}</small></span><button aria-label={`Add ${p.name} to bag`} className="icon-button" onClick={()=>add(p.id)}><Plus size={20}/></button></div>:null;})()}</div><div className="bag-summary"><div><span>Subtotal</span><strong>{money(subtotal,currency)}</strong></div><p>{live?"Shipping and tax calculated at checkout.":"Sample pricing. No payment or order will be taken."}</p><Link className="button button-dark full-width" href="/checkout" onClick={()=>setBag(false)}>{live?"Review & checkout":"Review your bag"} <ArrowRight size={18}/></Link><button className="quiet-button" onClick={()=>setBag(false)}>Continue shopping</button></div></>:<div className="empty-bag"><ShoppingBag size={42} strokeWidth={1}/><h3>Your daily ritual starts here.</h3><p>Explore supplements and skincare, made for a more considered routine.</p><Link className="button button-dark" href="/collections/all" onClick={()=>setBag(false)}>Explore the collection <ArrowRight size={17}/></Link></div>}</SheetContent></Sheet>
    <Sheet open={search} onOpenChange={setSearch}><SheetContent side="top" className="search-sheet"><SheetTitle>Find your essential.</SheetTitle><SheetDescription>Search the IQON collection</SheetDescription><div className="search-field"><Search size={22}/><input aria-label="Search the collection" placeholder="Search products, formats, collections…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery("")}><X size={18}/></button>}</div><div className="search-results">{results.map(p=><Link href={`/products/${p.id}`} key={p.id} onClick={()=>setSearch(false)}><img src={p.image} alt={p.name}/><span>{p.name}<small>{p.type} · {productPrice(p)}</small></span><ArrowRight size={18}/></Link>)}{!results.length&&<p className="no-results">No products match “{query}”. Try “collagen”, “creatine” or “skincare”.</p>}</div></SheetContent></Sheet>

  </StoreContext.Provider>;
}

export function CartLine({item}:{item:CartItem}) {
 const {update,products,busy}=useStore();const p=products.find(p=>p.id===item.id);const name=item.name||p?.name||"Product";
 const image=item.image||p?.image;const total=item.amount??(p?unitPrice(p,item.purchase)*item.quantity:0);
 return <article className="cart-line"><Link href={`/products/${item.id}`}>{image&&<img src={image} alt={name}/>}</Link><div className="cart-line-info"><Link href={`/products/${item.id}`}><h3>{name}</h3></Link><p>{item.variantTitle&&item.variantTitle!=="Default Title"?item.variantTitle:p?.size}</p><small>{item.purchase==="subscription"?`Subscribe · Every ${item.frequency} days`:"One-time purchase"}</small><div className="cart-line-bottom"><Quantity value={item.quantity} setValue={n=>update(lineKey(item),n)} min={0} label={name} disabled={busy}/><strong>{money(total,item.currency||p?.currency)}</strong></div><button className="remove-item" disabled={busy} onClick={()=>update(lineKey(item),0)}>Remove {name}</button></div></article>;
}
export function Quantity({value,setValue,min=1,label="product",disabled=false}:{value:number;setValue:(n:number)=>void;min?:number;label?:string;disabled?:boolean}) {return <div className="quantity"><button aria-label={`Decrease ${label} quantity`} disabled={disabled||value<=min} onClick={()=>setValue(value-1)}><Minus size={15}/></button><span aria-live="polite">{value}</span><button aria-label={`Increase ${label} quantity`} disabled={disabled||value>=20} onClick={()=>setValue(value+1)}><Plus size={15}/></button></div>;}
export function ProductCard({product:p,compact=false}:{product:Product;compact?:boolean}) {
 const {add,busy,ready}=useStore();
 return <article className={`product-card ${p.pricePending?"supplied-product":""} ${compact?"compact-card":""}`}>
  <Link className="product-visual" href={`/products/${p.id}`}><img src={p.image} alt={`IQON ${p.name}`} loading="lazy" width={1122} height={1402}/></Link>
  <div className="product-card-title"><Link href={`/products/${p.id}`}><h3>{p.name}</h3></Link></div>
  <p>{p.descriptor}</p>
  <div className="product-card-info"><span className={p.pricePending?"price-pending":""}>{productPrice(p)}</span><span>{p.size}</span></div>
  {p.pricePending?<Link className="button button-dark product-card-action" aria-label={`View ${p.name}`} href={`/products/${p.id}`}>View product<ArrowRight size={18}/></Link>:<button className="button button-dark product-card-action" disabled={busy||!ready||p.available===false} aria-label={p.variants&&p.variants.length>1?`Choose options for ${p.name}`:`Add ${p.name} to bag`} onClick={()=>add(p.id)}>{p.available===false?"Unavailable":p.variants&&p.variants.length>1?"Choose options":"Add to bag"}<Plus size={18}/></button>}
 </article>;
}
function Footer(){const {mode,currency,department}=useStore();return <footer className="store-footer"><div className="footer-main"><div className="footer-brand"><Link href={departmentHome(department)} aria-label="IQON home"><Wordmark large/></Link><p>A considered approach to<br/>the everyday.</p></div><div><p className="eyebrow">DISCOVER</p><Link href="/collections/supplements">Supplements</Link><Link href="/collections/skincare">Skincare</Link><Link href="/collections/all">Shop all</Link></div><div><p className="eyebrow">IQON</p><Link href="/approach">Our approach</Link><Link href="/journal">Latest News</Link><Link href="/reviews">Customer reviews</Link><Link href="/help">Questions & care</Link><Link href="/checkout">Your bag</Link></div><div className="footer-note"><p className="eyebrow">THE NEXT CHAPTER</p><p>Supplements and skincare.<br/>One point of view.</p><span>Precision. Clarity. Care.</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} IQON</span>{mode==="preview"&&<p>Store preview. Supplement pricing and skincare concepts are to be confirmed.</p>}<span>{currency}</span></div></footer>;}
