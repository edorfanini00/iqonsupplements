"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronRight, Menu, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@/components/ui/navigation-menu";
import { products, findProduct, money, unitPrice, lineKey, validateCart, type CartItem, type Purchase, type Product } from "@/lib/catalog";

type StoreContextType = {cart: CartItem[]; add: (id:string,quantity?:number,purchase?:Purchase,frequency?:string)=>void; update:(key:string,quantity:number)=>void; openBag:()=>void; closeBag:()=>void; subtotal:number; count:number};
const StoreContext = createContext<StoreContextType | null>(null);
export function useStore() {const value=useContext(StoreContext); if(!value) throw new Error("Store context missing"); return value;}
export function Wordmark({large=false}:{large?:boolean}) {return <span className={`wordmark ${large?"wordmark-large":""}`} aria-label="IQON">IQON</span>;}

export function StoreShell({children}:{children:ReactNode}) {
  const pathname=usePathname();
  const [cart,setCart]=useState<CartItem[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [bag,setBag]=useState(false);
  const [search,setSearch]=useState(false);
  const [menu,setMenu]=useState(false);
  const [query,setQuery]=useState("");
  useEffect(()=>{try {setCart(validateCart(JSON.parse(localStorage.getItem("iqon-store-bag-v2")||"[]")));} catch {} setHydrated(true);},[]);
  useEffect(()=>{if(hydrated)try{localStorage.setItem("iqon-store-bag-v2",JSON.stringify(cart));}catch{}},[cart,hydrated]);
  useEffect(()=>{setBag(false);setSearch(false);setMenu(false);},[pathname]);
  const subtotal=useMemo(()=>cart.reduce((sum,item)=>sum+unitPrice(findProduct(item.id)!,item.purchase)*item.quantity,0),[cart]);
  const count=cart.reduce((sum,item)=>sum+item.quantity,0);
  const add=(id:string,quantity=1,purchase:Purchase="once",frequency="once")=>{
    if(!findProduct(id))return;
    const item={id,quantity:Math.max(1,Math.min(20,Math.floor(quantity))),purchase,frequency:purchase==="once"?"once":frequency};
    setCart(current=>{const key=lineKey(item); const exists=current.some(i=>lineKey(i)===key);return exists?current.map(i=>lineKey(i)===key?{...i,quantity:Math.min(20,i.quantity+item.quantity)}:i):[...current,item];}); setBag(true);
  };
  const update=(key:string,quantity:number)=>setCart(current=>current.map(i=>lineKey(i)===key?{...i,quantity:Math.min(20,Math.max(0,Math.floor(quantity)))}:i).filter(i=>i.quantity>0));
  const value={cart,add,update,openBag:()=>setBag(true),closeBag:()=>setBag(false),subtotal,count};
  const results=products.filter(p=>`${p.name} ${p.type} ${p.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <StoreContext.Provider value={value}>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="preview-ribbon">PRIVATE STORE PREVIEW <span>Sample products & pricing · Orders are not enabled</span></div>
    <header className="store-header">
      <div className="header-row">
        <button className="icon-button mobile-nav-trigger" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu size={22}/></button>
        <nav className="category-switch" aria-label="Collections"><Link className={pathname.includes("supplements")?"selected":""} href="/collections/supplements">Supplements</Link><Link className={pathname.includes("skincare")?"selected":""} href="/collections/skincare">Skincare</Link></nav>
        <Link href="/" className="brand" aria-label="IQON home"><Wordmark/></Link>
        <div className="header-tools"><span className="currency">US / USD</span><button className="icon-button" aria-label="Search products" onClick={()=>setSearch(true)}><Search size={21} strokeWidth={1.4}/></button><button className="bag-button" aria-label={`Open shopping bag, ${count} items`} onClick={()=>setBag(true)}><ShoppingBag size={22} strokeWidth={1.35}/><span className="bag-count">{count}</span></button></div>
      </div>
      <div className="nav-row"><NavigationMenu className="shop-navigation"><NavigationMenuList><NavigationMenuItem><NavigationMenuTrigger className="shop-trigger">Shop</NavigationMenuTrigger><NavigationMenuContent><div className="mega-menu"><div className="mega-links"><p className="eyebrow">THE COLLECTIONS</p>{[["All products","/collections/all"],["Supplements","/collections/supplements"],["Skincare","/collections/skincare"]].map(([label,href])=><NavigationMenuLink asChild key={href}><Link href={href}>{label}<ArrowRight size={16}/></Link></NavigationMenuLink>)}</div>{[products[0],products[3]].map(p=><NavigationMenuLink asChild key={p.id}><Link className="mega-product" href={`/products/${p.id}`}><img src={p.image} alt={p.name}/><span>{p.name}</span><small>{money(p.price)}</small></Link></NavigationMenuLink>)}</div></NavigationMenuContent></NavigationMenuItem></NavigationMenuList></NavigationMenu><Link href="/collections/all">All products</Link><Link href="/approach">The IQON approach</Link><Link href="/help">Questions & care</Link></div>
    </header>
    {children}
    <Footer/>
    <Sheet open={bag} onOpenChange={setBag}><SheetContent className="bag-sheet"><div className="sheet-heading"><SheetTitle>Your bag <span>({count})</span></SheetTitle><SheetDescription>A little more intention, every day.</SheetDescription></div>{cart.length?<><div className="bag-lines">{cart.map(item=><CartLine key={lineKey(item)} item={item}/>)}</div><div className="bag-recommend"><p className="eyebrow">COMPLETE YOUR ROUTINE</p>{(()=>{const p=products.find(p=>!cart.some(i=>i.id===p.id));return p?<div><img src={p.image} alt={p.name}/><span><strong>{p.name}</strong><small>{money(p.price)}</small></span><button aria-label={`Add ${p.name} to bag`} className="icon-button" onClick={()=>add(p.id)}><Plus size={20}/></button></div>:null;})()}</div><div className="bag-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Sample pricing. No payment or order will be taken.</p><Link className="button button-dark full-width" href="/checkout" onClick={()=>setBag(false)}>Review your bag <ArrowRight size={18}/></Link><button className="quiet-button" onClick={()=>setBag(false)}>Continue shopping</button></div></>:<div className="empty-bag"><ShoppingBag size={42} strokeWidth={1}/><h3>Your daily ritual starts here.</h3><p>Explore supplements and skincare, made for a more considered routine.</p><Link className="button button-dark" href="/collections/all" onClick={()=>setBag(false)}>Explore the collection <ArrowRight size={17}/></Link></div>}</SheetContent></Sheet>
    <Sheet open={search} onOpenChange={setSearch}><SheetContent side="top" className="search-sheet"><SheetTitle>Find your essential.</SheetTitle><SheetDescription>Search the IQON collection</SheetDescription><div className="search-field"><Search size={22}/><input aria-label="Search the collection" placeholder="Search products, formats, collections…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery("")}><X size={18}/></button>}</div><div className="search-results">{results.map(p=><Link href={`/products/${p.id}`} key={p.id} onClick={()=>setSearch(false)}><img src={p.image} alt={p.name}/><span>{p.name}<small>{p.type} · {money(p.price)}</small></span><ArrowRight size={18}/></Link>)}{!results.length&&<p className="no-results">No products match “{query}”. Try “serum”, “minerals” or “skincare”.</p>}</div></SheetContent></Sheet>
    <Sheet open={menu} onOpenChange={setMenu}><SheetContent side="left" className="mobile-sheet"><SheetTitle><Wordmark/></SheetTitle><SheetDescription>Supplements & skincare</SheetDescription><nav>{[["Shop all","/collections/all"],["Supplements","/collections/supplements"],["Skincare","/collections/skincare"],["The IQON approach","/approach"],["Questions & care","/help"]].map(([label,href])=><Link href={href} key={href} onClick={()=>setMenu(false)}>{label}<ChevronRight size={18}/></Link>)}</nav><img src="/images/store/campaign-skincare.webp" alt="The IQON skincare collection"/></SheetContent></Sheet>
  </StoreContext.Provider>;
}

export function CartLine({item}:{item:CartItem}) {const {update}=useStore(); const p=findProduct(item.id)!;return <article className="cart-line"><Link href={`/products/${p.id}`}><img src={p.image} alt={p.name}/></Link><div className="cart-line-info"><Link href={`/products/${p.id}`}><h3>{p.name}</h3></Link><p>{p.size}</p><small>{item.purchase==="subscription"?`Subscribe · Every ${item.frequency} days`:"One-time purchase"}</small><div className="cart-line-bottom"><Quantity value={item.quantity} setValue={n=>update(lineKey(item),n)} min={0} label={p.name}/><strong>{money(unitPrice(p,item.purchase)*item.quantity)}</strong></div><button className="remove-item" onClick={()=>update(lineKey(item),0)}>Remove {p.name}</button></div></article>;}
export function Quantity({value,setValue,min=1,label="product"}:{value:number;setValue:(n:number)=>void;min?:number;label?:string}) {return <div className="quantity"><button aria-label={`Decrease ${label} quantity`} disabled={value<=min} onClick={()=>setValue(value-1)}><Minus size={15}/></button><span aria-live="polite">{value}</span><button aria-label={`Increase ${label} quantity`} disabled={value>=20} onClick={()=>setValue(value+1)}><Plus size={15}/></button></div>;}
export function ProductCard({product:p,compact=false}:{product:Product;compact?:boolean}) {const {add}=useStore();return <article className={`product-card ${compact?"compact-card":""}`}><Link className="product-visual" href={`/products/${p.id}`}><span className="product-tag">{p.category==="skincare"?"SKINCARE":"SUPPLEMENTS"}</span><img src={p.image} alt={`IQON ${p.name}`} loading="lazy" width={1200} height={1200}/><span className="product-hover">Discover the details <ArrowRight size={16}/></span></Link><div className="product-card-title"><Link href={`/products/${p.id}`}><h3>{p.name}</h3></Link><span>{money(p.price)}</span></div><p>{p.descriptor}</p><div className="product-card-meta"><span>{p.type} <b>·</b> {p.size}</span><button aria-label={`Add ${p.name} to bag`} onClick={()=>add(p.id)}><Plus size={18}/><span>Add to bag</span></button></div></article>;}
function Footer(){return <footer className="store-footer"><div className="footer-main"><div className="footer-brand"><Link href="/" aria-label="IQON home"><Wordmark large/></Link><p>A considered approach to<br/>the everyday.</p></div><div><p className="eyebrow">DISCOVER</p><Link href="/collections/supplements">Supplements</Link><Link href="/collections/skincare">Skincare</Link><Link href="/collections/all">Shop all</Link></div><div><p className="eyebrow">IQON</p><Link href="/approach">Our approach</Link><Link href="/help">Questions & care</Link><Link href="/checkout">Your bag</Link></div><div className="footer-note"><p className="eyebrow">THE NEXT CHAPTER</p><p>Supplements and skincare.<br/>One point of view.</p><span>Precision. Clarity. Care.</span></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} IQON</span><p>Private design preview. Product concepts and prices are provisional.</p><span>US / USD</span></div></footer>;}
