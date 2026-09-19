"use client";
import {useEffect,useState} from 'react';
import {PageHeader} from '@/components/affiliates/shared/ui';
import {CanonicalAffiliateControls} from '@/components/affiliates/shared/CanonicalAffiliateControls';

type Affiliate={id:string;firstName:string;lastName:string};
/** Existing commands are affiliate scoped; never imply a global default change. */
export default function AdminSettingsPage(){
 const [authorized,setAuthorized]=useState(false);
 const [affiliates,setAffiliates]=useState<Affiliate[]>([]);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void(async()=>{
  try{
   const session=await fetch('/api/affiliates/me',{credentials:'include',cache:'no-store',signal:controller.signal});
   const data=await session.json();
   if(!session.ok||(data.user??data.data?.user)?.role!=='admin'||['disabled','pending'].includes((data.user??data.data?.user)?.status))throw Error('Current administrator access required.');
   const response=await fetch('/api/affiliates/admin/affiliates',{credentials:'include',cache:'no-store',signal:controller.signal});
   const roster=await response.json();
   if(!response.ok||!Array.isArray(roster.affiliates))throw Error('Affiliate scope unavailable. No settings changed.');
   if(!controller.signal.aborted){setAffiliates(roster.affiliates);setAuthorized(true);}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Settings unavailable.');}
 })();return()=>controller.abort();},[]);
 return <>
  <PageHeader eyebrow="Settings" title="Commission & customer discount settings" description="Separate Health peptide and Body supplements/skincare policies. Admins configure rates here; no rates need to be supplied in chat."/>
  {error&&<p role="alert">{error}</p>}
  {authorized&&<>
   <section className="glass-surface rounded-lg p-6 md:p-7 mb-8">
    <p className="text-sm text-[#64717a] mb-4">Existing Health peptide values are preserved unless you explicitly save peptide terms. Body rates are not copied from Health. Shopify terms are inactive until configured and provider-verified.</p>
    <label className="text-sm">Affiliate scope<select value={selected} onChange={e=>setSelected(e.target.value)} className="bg-transparent border-0 border-b border-[#242526]/15 px-0 py-2.5 text-sm w-full"><option value="">Select the affiliate whose agreement you want to edit</option>{affiliates.map(a=><option key={a.id} value={a.id}>{a.firstName} {a.lastName} · {a.id}</option>)}</select></label>
    <p className="text-xs text-[#64717a] mt-3">Applies only to the selected affiliate, not all affiliates or future signups. Unset is not zero. Infrastructure can ship with Shopify terms unconfigured; activation requires complete explicit terms and technical qualification.</p>
   </section>
   {selected&&<CanonicalAffiliateControls key={selected} affiliateId={selected} ratesOnly/>}
  </>}
 </>;
}
