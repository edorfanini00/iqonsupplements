"use client";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { CartLine, useStore } from "../store-shell";
import { lineKey, money } from "@/lib/catalog";

export default function CheckoutPage(){
  const {cart,subtotal,count,mode,currency,busy,ready,error,checkout,retryCart}=useStore();
  const live=mode==="live";
  return <main id="main">
    <div className="checkout-heading section-pad"><h1>Your selection.</h1><p>{live?"Review your essentials before continuing to secure checkout.":"Checkout is not available yet. You can explore the collection and its prices."}</p></div>
    {error&&<div className="commerce-message section-pad" role="alert"><p>{error}</p><button disabled={busy} className="under-link" onClick={()=>retryCart()}>Refresh bag</button></div>}
    {!ready?<p className="section-pad" role="status">Loading your bag…</p>:cart.length?<div className="checkout-layout section-pad">
      <div className="checkout-lines">{cart.map(item=><CartLine key={lineKey(item)} item={item}/>)}</div>
      <aside className="checkout-summary"><h2>Order summary</h2><dl>
        <div><dt>Products ({count})</dt><dd>{money(subtotal,currency)}</dd></div>
        <div><dt>Shipping</dt><dd>{live?"Calculated at checkout":"Confirmed at launch"}</dd></div>
        <div><dt>Tax</dt><dd>{live?"Calculated at checkout":"Confirmed at launch"}</dd></div>
        <div><dt>Subtotal</dt><dd>{money(subtotal,currency)}</dd></div>
      </dl>{live?<><p><LockKeyhole size={14}/> Payment is completed securely with Shopify.</p><button className="button button-dark full-width" disabled={busy||!ready} onClick={()=>checkout()}>{busy?"Please wait…":"Continue to checkout"}<ArrowRight size={17}/></button></>:<p>Payment is not enabled for this store preview. Your bag stays in this browser so you can continue exploring the collection.</p>}
      <Link href="/collections/all" className={live?"under-link":"button button-dark full-width"}>Continue shopping <ArrowRight size={17}/></Link>
      </aside></div>:<div className="section-pad checkout-empty"><h2>Your bag is waiting for its first essential.</h2><Link href="/collections/all" className="button button-dark">Explore the collection <ArrowRight size={17}/></Link></div>}
  </main>;
}
