"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Menu, Search, ShoppingBag } from "lucide-react";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { type Category, type Product } from "@/lib/catalog";
import { departmentHome, departmentShop, formatHref, formatLabel, formatOrder } from "@/lib/departments";

export function DepartmentSwitch({department, onSelect}:{department:Category;onSelect?:(department:Category)=>void}) {
  return <nav className="department-switch" aria-label="Choose department">{(["supplements","skincare"] as const).map(item=><Link key={item} href={departmentHome(item)} className={department===item?"is-active":""} aria-current={department===item?"true":undefined} onClick={()=>onSelect?.(item)}>{item}</Link>)}</nav>;
}

type Props = {department:Category;setDepartment:(department:Category)=>void;products:Product[];currency:string;count:number;logo:ReactNode;openSearch:()=>void;openBag:()=>void};

export function StoreNavigation({department,setDepartment,products,currency,count,logo,openSearch,openBag}:Props) {
  const [activeMenu,setActiveMenu]=useState("");
  const [mobileOpen,setMobileOpen]=useState(false);
  const skin=department==="skincare";
  const collection=products.filter(p=>p.category===department);
  const formats=[...new Set(collection.map(p=>p.type))].sort((a,b)=>formatOrder.indexOf(a)-formatOrder.indexOf(b));
  const featured=collection.slice(0,2);
  const shop=departmentShop(department);
  const guide=skin?"/skincare#routine":`${shop}#formats`;
  const close=()=>{setActiveMenu("");setMobileOpen(false);};
  const switchDepartment=(next:Category)=>{setDepartment(next);close();};
  const menuLink=(label:string,href:string,className="")=><NavigationMenuLink asChild key={href}><Link className={className} href={href} onClick={close}>{label}<ArrowUpRight size={17}/></Link></NavigationMenuLink>;
  return <>
    <header className="store-header department-header">
      <div className="department-header-main">
        <div className="department-header-start"><button className="icon-button department-mobile-trigger" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu size={22}/></button><DepartmentSwitch department={department} onSelect={switchDepartment}/></div>
        <Link href={departmentHome(department)} className="brand" aria-label={`IQON ${department} home`} onClick={close}>{logo}</Link>
        <div className="header-tools"><span className="currency">{currency}</span><button className="icon-button" aria-label="Search products" onClick={()=>{close();openSearch();}}><Search size={21} strokeWidth={1.4}/></button><button className="bag-button" aria-label={`Open shopping bag, ${count} items`} onClick={()=>{close();openBag();}}><ShoppingBag size={22} strokeWidth={1.35}/><span className="bag-count">{count}</span></button></div>
      </div>
      <div className="department-mobile-bar"><DepartmentSwitch department={department} onSelect={switchDepartment}/><Link href={shop} onClick={close}>Shop all<ArrowUpRight size={13}/></Link></div>
      <div className="department-nav-row">
        <span className="department-caption">IQON / {department}</span>
        <NavigationMenu viewport={false} className="department-navigation" value={activeMenu} onValueChange={setActiveMenu} delayDuration={120} skipDelayDuration={200} aria-label={`${department} navigation`}>
          <NavigationMenuList>
            <NavigationMenuItem value="shop"><NavigationMenuTrigger>Shop</NavigationMenuTrigger><NavigationMenuContent className="department-panel">
              <div className="department-mega shop-mega">
                <div className="department-large-links"><p className="eyebrow">THE COLLECTION</p>{menuLink("Shop all",shop)}{menuLink(skin?"The skincare routine":"Compare formats",guide)}{menuLink("All IQON products","/collections/all")}<div className="department-cross-link">{menuLink(skin?"Discover supplements":"Discover skincare",departmentHome(skin?"supplements":"skincare"))}</div></div>
                <div className="department-small-links"><p className="eyebrow">{skin?"BY CATEGORY":"BY FORMAT"}</p>{formats.map(format=>menuLink(formatLabel(format),formatHref(department,format)))}<p className="department-menu-note">{skin?"Cleanse. Treat. Moisturize.":"Find the format that fits your day."}</p></div>
                <div className="department-featured">{featured.map(p=><NavigationMenuLink asChild key={p.id}><Link className={`department-product ${p.category}`} href={`/products/${p.id}`} onClick={close}><div><img src={p.image} alt={`IQON ${p.name}`} width={380} height={460}/></div><span>{p.name}<ArrowUpRight size={17}/></span><small>{p.type} · {p.size}</small></Link></NavigationMenuLink>)}</div>
              </div>
              <div className="department-panel-bottom"><span>{skin?"Skincare, with a place for every step.":"Your daily routine, in every format."}</span><Link href={shop} onClick={close}>Explore {department} <ArrowRight size={15}/></Link></div>
            </NavigationMenuContent></NavigationMenuItem>
            <NavigationMenuItem value="explore"><NavigationMenuTrigger>Explore</NavigationMenuTrigger><NavigationMenuContent className="department-panel"><div className="department-mega editorial-mega"><div className="department-large-links"><p className="eyebrow">GET TO KNOW IQON</p>{menuLink(skin?"Your skincare routine":"Find your format",guide)}{menuLink("The IQON approach","/approach")}{menuLink("Product details",shop)}{menuLink("Questions & care","/help")}</div><NavigationMenuLink asChild><Link className="department-editorial" href={guide} onClick={close}><img src={skin?"/images/store/campaign-skincare.webp":"/images/supplements/22_group_powders_row.webp"} alt={skin?"IQON skincare collection":"IQON powder collection"}/><span>{skin?"Three steps, one routine":"Powders, capsules & more"}<ArrowUpRight size={18}/></span><small>{skin?"Meet the collection":"Explore the formats"}</small></Link></NavigationMenuLink><NavigationMenuLink asChild><Link className="department-editorial" href="/approach" onClick={close}><img src="/images/store/precision.webp" alt="IQON silver and serum material study"/><span>A closer look at IQON<ArrowUpRight size={18}/></span><small>Our approach</small></Link></NavigationMenuLink></div></NavigationMenuContent></NavigationMenuItem>
            <NavigationMenuItem value="about"><NavigationMenuTrigger>About IQON</NavigationMenuTrigger><NavigationMenuContent className="department-panel"><div className="department-mega about-mega"><div className="department-large-links"><p className="eyebrow">IQON</p>{menuLink("Our approach","/approach")}{menuLink("Questions & care","/help")}{menuLink("Your bag","/checkout")}</div><div className="department-about-copy"><p className="eyebrow">SUPPLEMENTS & SKINCARE</p><h2>One point of view.<br/>Every day.</h2><p>The details matter. Get to know the products, compare their formats and build a routine at your own pace.</p></div><NavigationMenuLink asChild><Link className="department-editorial" href="/approach" onClick={close}><img src="/images/store/campaign-lifestyle.webp" alt="An unhurried moment in natural daylight"/><span>Made to fit your day<ArrowUpRight size={18}/></span></Link></NavigationMenuLink></div></NavigationMenuContent></NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <Link className="department-shop-link" href={shop} onClick={close}>Shop all <ArrowUpRight size={14}/></Link>
      </div>
    </header>
    {activeMenu&&<div className="department-menu-backdrop" aria-hidden="true" onClick={()=>setActiveMenu("")}/>}
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="department-mobile-sheet"><SheetTitle>{logo}</SheetTitle><SheetDescription>Explore IQON {department}</SheetDescription><DepartmentSwitch department={department} onSelect={switchDepartment}/><Link className="mobile-shop-all" href={shop} onClick={close}>Shop all {department}<ArrowUpRight size={20}/></Link><Accordion type="multiple" defaultValue={["shop"]}><AccordionItem value="shop"><AccordionTrigger>{skin?"Shop by category":"Shop by format"}</AccordionTrigger><AccordionContent><nav>{formats.map(format=><Link href={formatHref(department,format)} onClick={close} key={format}>{formatLabel(format)}<ArrowUpRight size={15}/></Link>)}</nav></AccordionContent></AccordionItem><AccordionItem value="explore"><AccordionTrigger>Explore</AccordionTrigger><AccordionContent><nav><Link href={guide} onClick={close}>{skin?"Your skincare routine":"Compare formats"}<ArrowUpRight size={15}/></Link><Link href="/collections/all" onClick={close}>All IQON products<ArrowUpRight size={15}/></Link></nav></AccordionContent></AccordionItem><AccordionItem value="about"><AccordionTrigger>About IQON</AccordionTrigger><AccordionContent><nav><Link href="/approach" onClick={close}>Our approach<ArrowUpRight size={15}/></Link><Link href="/help" onClick={close}>Questions & care<ArrowUpRight size={15}/></Link></nav></AccordionContent></AccordionItem></Accordion><Link className="mobile-menu-editorial" href={guide} onClick={close}><img src={skin?"/images/store/campaign-skincare.webp":"/images/supplements/22_group_powders_row.webp"} alt={`IQON ${department} collection`}/><span>{skin?"A place for every step":"Find your daily essentials"}<ArrowUpRight size={17}/></span></Link></SheetContent></Sheet>
  </>;
}
