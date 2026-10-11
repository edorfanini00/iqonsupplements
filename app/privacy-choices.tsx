"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PRIVACY_PURPOSES, effectiveChoices, restrictChoices, type PrivacyChoices, type PrivacyPurpose, type PrivacyRestriction, type PrivacySnapshot } from "@/lib/privacy";

export type PrivacyLinks={policy:string;optOut:string};
// Withdrawals not yet confirmed by the server are shared by every open tab, one key per
// purpose, and survive refresh and failed requests. Values are "<ms>:<random>" tokens.
const PENDING_PREFIX="iqon-privacy-pending:";
const SYNC_KEY="iqon-privacy-sync";
const purposeCopy:Record<PrivacyPurpose,{label:string;detail:string}>={
  preferences:{label:"Preferences",detail:"Remember settings that personalize your visit."},
  analytics:{label:"Analytics",detail:"Help us understand how the store is used."},
  marketing:{label:"Advertising",detail:"Personalized ads and ad measurement with partners such as Meta."},
  saleOfData:{label:"Sale or sharing of data",detail:"Share personal information with advertising partners. Turn this off to opt out of sale or sharing."},
};

const subscribeNever=()=>()=>{};
const tokenTime=(token:string)=>Number(token.split(":")[0])||0;
function sharedPending():Map<PrivacyPurpose,string> {
  const found=new Map<PrivacyPurpose,string>();
  try {for(const p of PRIVACY_PURPOSES){const token=localStorage.getItem(PENDING_PREFIX+p);if(token)found.set(p,token);}} catch {}
  return found;
}
function addShared(purpose:PrivacyPurpose, token:string) {try {localStorage.setItem(PENDING_PREFIX+purpose,token);} catch {}}
// Removes a pending withdrawal only if no tab has recorded a newer one since it was read.
function removeShared(purpose:PrivacyPurpose, token:string) {try {if(localStorage.getItem(PENDING_PREFIX+purpose)===token)localStorage.removeItem(PENDING_PREFIX+purpose);} catch {}}

type SaveIntent={kind:"withdraw"}|{kind:"choices";choices:PrivacyChoices;baseVersion:string;basedAt:number};

export function usePrivacy(initial:PrivacySnapshot) {
  const [snapshot,setSnapshotState]=useState(initial);
  const browserGpc=useSyncExternalStore(subscribeNever,()=>(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true,()=>false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState<{text:string;error:boolean}|null>(null);
  const version=useRef(initial.version);
  // Changes whenever the decision this page would send to checkout may have changed.
  const epoch=useRef(0);
  // This tab's own unconfirmed withdrawals, kept even if storage is unavailable.
  const own=useRef(new Map<PrivacyPurpose,string>());
  const [pending,setPending]=useState<PrivacyRestriction>({});
  const pendingRef=useRef<PrivacyRestriction>({});
  // When this tab last saw the pending set change: a form showing it was based on that moment.
  const [pendingSeenAt,setPendingSeenAt]=useState(0);
  const sequence=useRef(0);
  const reads=useRef({issued:0,applied:0});
  const queue=useRef<Promise<void>>(Promise.resolve());
  const gpc=snapshot.gpc||browserGpc;

  const pendingTokens=()=>{const all=sharedPending();for(const [p,token] of own.current) if(!all.has(p)||tokenTime(all.get(p)!)<tokenTime(token))all.set(p,token);return all;};
  const restriction=():PrivacyRestriction=>Object.fromEntries([...pendingTokens().keys()].map(p=>[p,false]));
  const syncPending=()=>{
    const next=restriction();
    if(PRIVACY_PURPOSES.every(p=>pendingRef.current[p]===next[p]))return;
    epoch.current++;pendingRef.current=next;setPending(next);setPendingSeenAt(Date.now());
  };
  const apply=(next:PrivacySnapshot)=>{
    if(next.version!==version.current)epoch.current++;
    version.current=next.version;setSnapshotState(next);
  };
  // Reads the decision the browser actually holds. Results are applied in the order the
  // reads were sent, so an older read can never replace a newer one.
  const read=async()=>{
    const seq=++reads.current.issued;
    const response=await fetch("/api/privacy",{cache:"no-store",signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok||!data.privacy)throw new Error("unavailable");
    if(seq>reads.current.applied){reads.current.applied=seq;apply(data.privacy);}
    return data.privacy as PrivacySnapshot;
  };
  const refresh=async()=>{try {await read();} catch {} syncPending();};

  const run=(intent:SaveIntent, seq:number)=>{
    queue.current=queue.current.then(async()=>{
      const tokens=pendingTokens();
      if(intent.kind==="withdraw"&&!tokens.size)return;
      setSaving(true);
      try {
        let response:Response;let data:{error?:string}={};
        try {
          response=await fetch("/api/privacy",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(15000),
            body:JSON.stringify(intent.kind==="withdraw"?{withdraw:[...tokens.keys()]}:{choices:intent.choices,expectedVersion:intent.baseVersion})});
          data=await response.json().catch(()=>({}));
        } catch {
          setNotice({text:tokens.size?"We couldn’t save your privacy choices. Anything you turned off stays off in this browser, and we will try again.":"We couldn’t save your privacy choices. Please try again.",error:true});
          await refresh();
          return;
        }
        let saved:PrivacySnapshot;
        try {saved=await read();} catch {setNotice({text:"We couldn’t confirm your privacy choices. Please try again.",error:true});return;}
        // A withdrawal stays pending until the saved decision shows it, or until the visitor
        // grants that purpose again from a form that already showed the withdrawal.
        for(const [p,token] of tokens) {
          const regranted=intent.kind==="choices"&&response.ok&&intent.choices[p]===true&&saved.choices[p]===true&&tokenTime(token)<=intent.basedAt;
          if(saved.choices[p]===false||regranted){removeShared(p,token);if(own.current.get(p)===token)own.current.delete(p);}
        }
        syncPending();
        try {localStorage.setItem(SYNC_KEY,`${saved.version}:${Date.now()}`);} catch {}
        if(!response.ok){
          setNotice({text:data.error||"We couldn’t save your privacy choices. Please try again.",error:true});
          if(pendingTokens().size)run({kind:"withdraw"},seq);
        } else if(seq===sequence.current)setNotice({text:"Your privacy choices are saved.",error:false});
      } finally {setSaving(false);}
    });
    return queue.current;
  };
  const save=(choices:PrivacyChoices, base:{version:string;basedAt:number})=>{
    const seq=++sequence.current;
    const shown=restrictChoices(snapshot.choices,restriction());
    for(const p of PRIVACY_PURPOSES) if(choices[p]===false&&shown[p]!==false){
      const token=`${Date.now()}:${Math.random().toString(36).slice(2)}`;
      own.current.set(p,token);addShared(p,token);
    }
    syncPending();setNotice(null);
    return run({kind:"choices",choices,baseVersion:base.version,basedAt:base.basedAt},seq);
  };

  useEffect(()=>{
    syncPending();
    // Any open tab retries withdrawals that have not been saved yet.
    const retry=()=>{if(pendingTokens().size)void run({kind:"withdraw"},sequence.current);};
    retry();
    const onStorage=(event:StorageEvent)=>{
      if(event.key===null||event.key.startsWith(PENDING_PREFIX))syncPending();
      if(event.key===null||event.key===SYNC_KEY)void refresh();
    };
    // Returning from Shopify's opt out page or checkout, or restoring from the back cache,
    // reloads the saved decision. A Shopify side opt out is not visible to this site.
    const onShow=(event:PageTransitionEvent)=>{if(event.persisted)void refresh();};
    const onVisible=()=>{if(document.visibilityState==="visible")void refresh();};
    window.addEventListener("storage",onStorage);window.addEventListener("pageshow",onShow);window.addEventListener("online",retry);document.addEventListener("visibilitychange",onVisible);
    return ()=>{window.removeEventListener("storage",onStorage);window.removeEventListener("pageshow",onShow);window.removeEventListener("online",retry);document.removeEventListener("visibilitychange",onVisible);};
  },[]);

  const displayed=effectiveChoices(restrictChoices(snapshot.choices,pending),gpc);
  return {
    snapshot,displayed,pending,pendingSeenAt,gpc,saving,notice,save,refresh,
    epoch:()=>epoch.current,version:()=>version.current,
    // Read at the moment checkout starts, including withdrawals pending in other tabs. It
    // can only remove permissions; the version binds the link to the decision shown here.
    checkoutContext:()=>{syncPending();return {restrict:restriction(),gpc,version:version.current};},
  };
}
export type PrivacyControls=ReturnType<typeof usePrivacy>;

export function PrivacyChoicesSheet({open,onOpenChange,privacy,links,returnFocus}:{open:boolean;onOpenChange:(open:boolean)=>void;privacy:PrivacyControls;links:PrivacyLinks;returnFocus:RefObject<HTMLElement|null>}) {
  const {gpc,saving,notice,snapshot}=privacy;
  const undecided=PRIVACY_PURPOSES.every(p=>snapshot.choices[p]===null&&privacy.pending[p]!==false);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="bag-sheet privacy-sheet" onCloseAutoFocus={event=>{if(returnFocus.current?.isConnected){event.preventDefault();returnFocus.current.focus();}}}>
    <div className="sheet-heading"><SheetTitle>Your Privacy Choices</SheetTitle><SheetDescription>Choose how IQON may use your data on this site and when you check out.</SheetDescription></div>
    <div className="privacy-body">
      {gpc&&<p className="privacy-gpc" role="note">Global Privacy Control is on in this browser. We treat it as your choice to turn off advertising and the sale or sharing of your data.</p>}
      <p className="privacy-state">{undecided?"You haven’t saved a choice yet. Until you do, no preference is recorded and the standard privacy settings for your region apply.":"Your saved choices apply to this browser."}</p>
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
const switchesFrom=(choices:PrivacyChoices)=>Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,choices[p]===true])) as Record<PrivacyPurpose,boolean>;
const pendingKey=(pending:PrivacyRestriction)=>PRIVACY_PURPOSES.map(p=>pending[p]===false?"0":"n").join("");
// Mounted only while the panel is open. The switches belong to the decision they were
// filled from. If that decision changes elsewhere, they are reset and the visitor is told,
// and a save always names the version the switches came from.
function PrivacyForm({privacy}:{privacy:PrivacyControls}) {
  const {displayed,gpc,saving,snapshot,pending}=privacy;
  const [draft,setDraft]=useState(()=>switchesFrom(displayed));
  const [base,setBase]=useState(()=>({version:snapshot.version,pending:pendingKey(pending),basedAt:Date.now(),shown:switchesFrom(displayed)}));
  const [changedElsewhere,setChangedElsewhere]=useState(false);
  // While this form's own save runs, its switches are kept; afterwards they show the saved result.
  const [own,setOwn]=useState<"idle"|"saving"|"done">("idle");
  const id=useId();
  if(own==="done") {setOwn("idle");setDraft(switchesFrom(displayed));setBase({...base,shown:switchesFrom(displayed)});}
  if(base.version!==snapshot.version||base.pending!==pendingKey(pending)) {
    // Edits are kept unless the decision the form was showing actually changed.
    const next=switchesFrom(displayed);
    setBase({version:snapshot.version,pending:pendingKey(pending),basedAt:Math.max(base.basedAt,privacy.pendingSeenAt),shown:next});
    if(own==="idle"&&PRIVACY_PURPOSES.some(p=>next[p]!==base.shown[p])){setDraft(next);setChangedElsewhere(true);}
  }
  const locked=(p:PrivacyPurpose)=>gpc&&(p==="marketing"||p==="saleOfData");
  const submit=(values:Record<PrivacyPurpose,boolean>)=>{
    const choices=Object.fromEntries(PRIVACY_PURPOSES.map(p=>[p,locked(p)?false:values[p]])) as PrivacyChoices;
    setDraft(choices as Record<PrivacyPurpose,boolean>);setChangedElsewhere(false);setOwn("saving");
    void privacy.save(choices,{version:base.version,basedAt:base.basedAt}).finally(()=>setOwn("done"));
  };
  return <form onSubmit={event=>{event.preventDefault();submit(draft);}}>
    {changedElsewhere&&<p className="privacy-gpc" role="alert">Your privacy choices were changed in another window. Review them before saving.</p>}
    <ul className="privacy-purposes">{PRIVACY_PURPOSES.map(p=><li key={p}>
      <div><label htmlFor={`${id}-${p}`}>{purposeCopy[p].label}</label><p id={`${id}-${p}-detail`}>{purposeCopy[p].detail}{locked(p)?" Off because of Global Privacy Control.":snapshot.choices[p]===null&&pending[p]!==false?" Not chosen yet.":""}</p></div>
      <Switch id={`${id}-${p}`} aria-describedby={`${id}-${p}-detail`} checked={!locked(p)&&draft[p]} disabled={locked(p)} onCheckedChange={checked=>setDraft(current=>({...current,[p]:checked}))}/>
    </li>)}</ul>
    <div className="privacy-actions">
      <button type="submit" className="button button-dark full-width" disabled={saving}>Save choices</button>
      <div><button type="button" className="quiet-button" disabled={saving} onClick={()=>submit({analytics:true,marketing:true,preferences:true,saleOfData:true})}>Allow all</button><button type="button" className="quiet-button" disabled={saving} onClick={()=>submit({analytics:false,marketing:false,preferences:false,saleOfData:false})}>Decline all</button></div>
    </div>
  </form>;
}
