"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PRIVACY_PURPOSES, effectiveChoices, restrictChoices, type PrivacyChoices, type PrivacyPurpose, type PrivacyRestriction, type PrivacySnapshot } from "@/lib/privacy";

export type PrivacyLinks={policy:string;optOut:string};
// Withdrawals not yet confirmed by the server survive refresh and failed requests.
const PENDING_KEY="iqon-privacy-pending-withdrawal";
const SYNC_KEY="iqon-privacy-sync";
const purposeCopy:Record<PrivacyPurpose,{label:string;detail:string}>={
  preferences:{label:"Preferences",detail:"Remember settings that personalize your visit."},
  analytics:{label:"Analytics",detail:"Help us understand how the store is used."},
  marketing:{label:"Advertising",detail:"Personalized ads and ad measurement with partners such as Meta."},
  saleOfData:{label:"Sale or sharing of data",detail:"Share personal information with advertising partners. Turn this off to opt out of sale or sharing."},
};

const subscribeNever=()=>()=>{};
function readPending():PrivacyRestriction {
  try {
    const value=JSON.parse(localStorage.getItem(PENDING_KEY)||"{}");
    return Object.fromEntries(PRIVACY_PURPOSES.filter(p=>value?.[p]===false).map(p=>[p,false]));
  } catch {return {};}
}
function writePending(restriction:PrivacyRestriction) {
  try {if(Object.keys(restriction).length)localStorage.setItem(PENDING_KEY,JSON.stringify(restriction));else localStorage.removeItem(PENDING_KEY);}catch {}
}

export function usePrivacy(initial:PrivacySnapshot) {
  const [snapshot,setSnapshotState]=useState(initial);
  const browserGpc=useSyncExternalStore(subscribeNever,()=>(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true,()=>false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null);
  const revision=useRef(initial.revision);
  const choicesRef=useRef(initial.choices);
  // Changes whenever the decision this page would send to checkout may have changed.
  const epoch=useRef(0);
  // purpose -> save sequence that requested the withdrawal
  const pending=useRef(new Map<PrivacyPurpose,number>());
  const [pendingRestriction,setPendingRestriction]=useState<PrivacyRestriction>({});
  const sequence=useRef(0);
  const queue=useRef<Promise<void>>(Promise.resolve());
  const gpc=snapshot.gpc||browserGpc;

  const restriction=():PrivacyRestriction=>Object.fromEntries([...pending.current.keys()].map(p=>[p,false]));
  const syncPending=()=>{const current=restriction();writePending(current);setPendingRestriction(current);};
  const apply=(next:PrivacySnapshot)=>{
    if(next.revision!==revision.current||PRIVACY_PURPOSES.some(p=>next.choices[p]!==choicesRef.current[p]))epoch.current++;
    revision.current=next.revision;choicesRef.current=next.choices;setSnapshotState(next);
  };
  const refresh=async()=>{
    const started=epoch.current;
    try {
      const response=await fetch("/api/privacy",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      // A save that started or finished meanwhile is newer than this read.
      if(response.ok&&data.privacy&&started===epoch.current)apply(data.privacy);
    } catch {}
  };
  const send=(choices:PrivacyChoices, seq:number, retried=false):Promise<void>=>{
    queue.current=queue.current.then(async()=>{
      setSaving(true);
      try {
        const response=await fetch("/api/privacy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({choices,expectedRevision:revision.current}),signal:AbortSignal.timeout(15000)});
        const data=await response.json();
        if(data.privacy)apply(data.privacy);
        if(!response.ok){
          setNotice({text:data.error||"We couldn’t save your privacy choices. Please try again.",error:true});
          // A rejected grant never discards a withdrawal made in the same save.
          if(!retried&&pending.current.size&&(response.status===409||response.status===422))void send(restrictChoices(choicesRef.current,restriction()),seq,true);
          return;
        }
        for(const [purpose,requested] of pending.current) if(requested<=seq) pending.current.delete(purpose);
        syncPending();epoch.current++;
        try {localStorage.setItem(SYNC_KEY,`${data.privacy.revision}:${Date.now()}`);}catch {}
        if(seq===sequence.current)setNotice({text:"Your privacy choices are saved.",error:false});
      } catch {
        setNotice({text:"We couldn’t save your privacy choices. Advertising and sharing stay off on this visit until they are saved.",error:true});
      } finally {setSaving(false);}
    });
    return queue.current;
  };
  const save=(choices:PrivacyChoices)=>{
    const seq=++sequence.current;
    for(const p of PRIVACY_PURPOSES){
      if(choices[p]===false&&choicesRef.current[p]!==false)pending.current.set(p,seq);
      // A new grant replaces an older unsaved withdrawal only once the server confirms it.
    }
    syncPending();epoch.current++;setNotice(null);
    return send(choices,seq);
  };

  useEffect(()=>{
    const stored=readPending();
    const seq=++sequence.current;
    for(const p of Object.keys(stored) as PrivacyPurpose[]) if(choicesRef.current[p]!==false)pending.current.set(p,seq);
    if(pending.current.size){syncPending();epoch.current++;void send(restrictChoices(choicesRef.current,restriction()),seq);}
    else writePending({});
    const onStorage=(event:StorageEvent)=>{if(event.key===SYNC_KEY)void refresh();};
    // Returning from Shopify's opt out page or checkout, or restoring from the back cache,
    // reloads the saved decision. A Shopify side opt out is not visible to this site.
    const onShow=(event:PageTransitionEvent)=>{if(event.persisted)void refresh();};
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
    window.addEventListener("storage",onStorage);window.addEventListener("pageshow",onShow);document.addEventListener("visibilitychange",onVisible);
    return ()=>{window.removeEventListener("storage",onStorage);window.removeEventListener("pageshow",onShow);document.removeEventListener("visibilitychange",onVisible);};
  },[]);

  const displayed=effectiveChoices(restrictChoices(snapshot.choices,pendingRestriction),gpc);
  return {
    snapshot,displayed,gpc,saving,notice,save,refresh,
    epoch:()=>epoch.current,revision:()=>revision.current,
    // Sent with checkout. It can only remove permissions the server has saved.
    checkoutContext:()=>({restrict:restriction(),gpc}),
  };
}
export type PrivacyControls=ReturnType<typeof usePrivacy>;

export function PrivacyChoicesSheet({open,onOpenChange,privacy,links,returnFocus}:{open:boolean;onOpenChange:(open:boolean)=>void;privacy:PrivacyControls;links:PrivacyLinks;returnFocus:RefObject<HTMLElement|null>}) {
  const {gpc,saving,notice,snapshot}=privacy;
  const undecided=PRIVACY_PURPOSES.every(p=>snapshot.choices[p]===null);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="bag-sheet privacy-sheet" onCloseAutoFocus={event=>{if(returnFocus.current?.isConnected){event.preventDefault();returnFocus.current.focus();}}}>
    <div className="sheet-heading"><SheetTitle>Your Privacy Choices</SheetTitle><SheetDescription>Choose how IQON may use your data on this site and when you check out.</SheetDescription></div>
    <div className="privacy-body">
      {gpc&&<p className="privacy-gpc" role="note">Global Privacy Control is on in this browser. We treat it as your choice to turn off advertising and the sale or sharing of your data.</p>}
      <p className="privacy-state">{undecided?"You haven’t made a choice yet. Optional uses stay off until you do.":"Your saved choices apply to this browser."}</p>
      <PrivacyForm privacy={privacy}/>
      <p className="privacy-notice" role={notice?.error?"alert":"status"} aria-live="polite">{saving?"Saving your choices…":notice?.text||""}</p>
      <div className="privacy-links">
        <p>Checkout is hosted by Shopify. Your current choices are sent to Shopify each time you start checkout. You can also opt out of sale or sharing on Shopify’s form. That form keeps its own record and does not change the choices saved here.</p>
        <a className="under-link" href={links.policy}>Privacy policy</a>
        <a className="under-link" href={links.optOut}>Shopify opt out form</a>
      </div>
    </div>
  </SheetContent></Sheet>;
}
// Mounted only while the panel is open, so each opening starts from the saved choices.
function PrivacyForm({privacy}:{privacy:PrivacyControls}) {
  const {displayed,gpc,saving,snapshot}=privacy;
  const [draft,setDraft]=useState<Record<PrivacyPurpose,boolean>>(()=>Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,displayed[p]===true])) as Record<PrivacyPurpose,boolean>);
  const id=useId();
  const locked=(p:PrivacyPurpose)=>gpc&&(p==="marketing"||p==="saleOfData");
  const submit=(values:Record<PrivacyPurpose,boolean>)=>{
    const choices=Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,locked(p)?false:values[p]])) as PrivacyChoices;
    setDraft(choices as Record<PrivacyPurpose,boolean>);void privacy.save(choices);
  };
  return <form onSubmit={event=>{event.preventDefault();submit(draft);}}>
    <ul className="privacy-purposes">{PRIVACY_PURPOSES.map(p=><li key={p}>
      <div><label htmlFor={`${id}-${p}`}>{purposeCopy[p].label}</label><p id={`${id}-${p}-detail`}>{purposeCopy[p].detail}{locked(p)?" Off because of Global Privacy Control.":snapshot.choices[p]===null?" Not chosen yet.":""}</p></div>
      <Switch id={`${id}-${p}`} aria-describedby={`${id}-${p}-detail`} checked={!locked(p)&&draft[p]} disabled={locked(p)} onCheckedChange={checked=>setDraft(current=>({...current,[p]:checked}))}/>
    </li>)}</ul>
    <div className="privacy-actions">
      <button type="submit" className="button button-dark full-width" disabled={saving}>Save choices</button>
      <div><button type="button" className="quiet-button" disabled={saving} onClick={()=>submit({analytics:true,marketing:true,preferences:true,saleOfData:true})}>Allow all</button><button type="button" className="quiet-button" disabled={saving} onClick={()=>submit({analytics:false,marketing:false,preferences:false,saleOfData:false})}>Decline all</button></div>
    </div>
  </form>;
}
