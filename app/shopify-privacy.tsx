"use client";
import {ShopifyScripts} from "@shopify/hydrogen/react";
// Shopify renders the banner and preferences UI; IQON owns no consent state.
export function ShopifyPrivacy(){
  // No Hydrogen analytics storefront: omit its optional performance beacon.
  return <ShopifyScripts shop={{shopId:"100386242855",storefrontId:"",myshopifyDomain:"nr9zd0-t5.myshopify.com"}}
    consent={{mode:"default-banner"}} shopifyAnalytics={false} webMcp={false} />;
}
