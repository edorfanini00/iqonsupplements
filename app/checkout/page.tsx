"use client";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { BundleNudge, CartLine, DiscountCodes, useStore } from "../store-shell";
import { bagSummary } from "@/lib/bundle-offer";
import { lineKey, money } from "@/lib/catalog";

export default function CheckoutPage(){
  const {cart,subtotal,count,mode,currency,busy,ready,error,checkout,retryCart,costs}=useStore();
  const live=mode==="live";
  // Every amount below is Shopify's; discount rows appear only when they reconcile to its subtotal and total.
  const {showLineDiscounts,showOrderDiscounts}=bagSummary({...costs,subtotal});
  return <main id="main">
    <div className="checkout-heading section-pad"><h1>Your selection.</h1><p>{live?"Review your essentials before continuing to secure checkout.":"Checkout is not available yet. You can explore the collection and its prices."}</p></div>
    {error&&<div className="commerce-message section-pad" role="alert"><p>{error}</p><button disabled={busy} className="under-link" onClick={()=>retryCart()}>Refresh bag</button></div>}
    {!ready?<p className="section-pad" role="status">{error?"Refresh your bag to continue.":"Loading your bag…"}</p>:cart.length?<div className="checkout-layout section-pad">
      <div className="checkout-lines">{cart.map(item=><CartLine key={lineKey(item)} item={item}/>)}</div>
      <aside className="checkout-summary"><h2>Order summary</h2>{live&&<DiscountCodes/>}<BundleNudge/><dl>
        <div><dt>Products ({count})</dt><dd>{money(showLineDiscounts?costs.merchandise:subtotal,currency)}</dd></div>
        {showLineDiscounts&&costs.lineDiscounts.map(line=><div key={line.title} className="bag-discount"><dt>{line.title}</dt><dd>−{money(line.amount,currency)}</dd></div>)}
        {showOrderDiscounts&&costs.orderDiscounts.map(line=><div key={line.title} className="bag-discount"><dt>{line.title}</dt><dd>−{money(line.amount,currency)}</dd></div>)}
        <div><dt>Shipping</dt><dd>{live?"Calculated at checkout":"Confirmed at launch"}</dd></div>
        <div><dt>Tax</dt><dd>{live?"Calculated at checkout":"Confirmed at launch"}</dd></div>
        <div><dt>{showOrderDiscounts?"Total before shipping and tax":"Subtotal"}</dt><dd>{money(showOrderDiscounts?costs.total:subtotal,currency)}</dd></div>
      </dl>{live?<><p><LockKeyhole size={14}/> Payment is completed securely with Shopify.</p><p>Enter your delivery address and choose shipping on the next step.</p><button className="button button-dark full-width" disabled={busy||!ready} onClick={()=>checkout()}>{busy?"Please wait…":"Continue to checkout"}<ArrowRight size={17}/></button></>:<p>Payment is not enabled for this store preview. Your bag stays in this browser so you can continue exploring the collection.</p>}
      <Link href="/collections/all" className={live?"under-link":"button button-dark full-width"}>Continue shopping <ArrowRight size={17}/></Link>
      </aside></div>:<div className="section-pad checkout-empty"><h2>Your bag is waiting for its first essential.</h2><Link href="/collections/all" className="button button-dark">Explore the collection <ArrowRight size={17}/></Link></div>}
  </main>;
}
