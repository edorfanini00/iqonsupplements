"use client";
import {useEffect,useState} from 'react';
export function SupplementsCode(){
 const [result,setResult]=useState<{state:string;code:string|null}|null>(null),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch('/api/affiliates/supplements-code',{credentials:'include',cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!controller.signal.aborted)setResult(data);}).catch(()=>{if(!controller.signal.aborted)setResult({state:'unavailable',code:null});});return()=>controller.abort();},[]);
 const active=result?.state==='active'&&!!result.code;
 return <section aria-label="Supplements code" className="glass-surface rounded-lg p-5 mb-8">
  <p className="text-xs uppercase tracking-widest">Supplements code</p>
  <p className="text-sm mt-2">10% off supplements and skincare at iqondaily.com</p>
  {active?<><p className="text-2xl font-mono mt-3">{result.code}</p><button className="rounded-full border px-4 py-2 mt-3 text-xs" onClick={async()=>{try{await navigator.clipboard.writeText(result.code!);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}}>{copied?'Copied':'Copy supplements code'}</button>{copyError&&<p role="alert">Could not copy. Select the code above to copy it.</p>}<p className="text-xs opacity-70 mt-3">Combines with bundle offers: 19% total off Buy 2, 32.5% total off Buy 3 on eligible bundle items. One-time merchandise purchases; excludes shipping and tax.</p></>:<p role="status" className="text-sm opacity-70 mt-3">{!result?'Checking code…':result.state==='unavailable'?'Code verification unavailable. No active code confirmed.':'Not active yet. Your code will appear after Shopify confirms it.'}</p>}
 </section>;
}
