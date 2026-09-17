"use client";
import {useCallback,useRef,useState} from 'react';
/** Request failures remain distinct from a successfully loaded empty original table. */
export function useOriginalRequest(){
 const failures=useRef(new Set<string>());
 const [requestError,setRequestError]=useState('');
 const request=useCallback(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const key=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const isRead=!init?.method||init.method==='GET';
  const update=(failed:boolean)=>{if(!isRead)return;if(failed)failures.current.add(key);else failures.current.delete(key);setRequestError(failures.current.size?'Unable to load records. Your existing data has not been removed.':'');};
  try{const response=await globalThis.fetch(input,init);update(!response.ok);return response;}
  catch{update(true);return new Response(JSON.stringify({error:'Request failed'}),{status:503,headers:{'Content-Type':'application/json'}});}
 },[]);
 return{request,requestError};
}
export function OriginalRequestError({message}:{message:string}){
 return <div role="alert" className="glass-surface rounded-lg p-6 mb-8 text-sm text-[#64717a]">{message} <button type="button" className="underline" onClick={()=>window.location.reload()}>Retry</button></div>;
}
