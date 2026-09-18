type KeyStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Options={storage?:KeyStorage;randomUUID?:()=>string;fetch?:(url:string,init?:RequestInit)=>Promise<Response>};
/** Only operation UUIDs persist. Never store bodies, passwords, tokens or hashes.
 * There is no retry loop. An uncertain attempt retains its key across reloads.
 */
export async function nativeMutationFetch(url:string,init:RequestInit,options:Options={}):Promise<Response>{
 const storage=options.storage??sessionStorage;
 const slot='iqon-native-operation:'+url;
 let key=storage.getItem(slot);
 if(!key){key=(options.randomUUID??(()=>crypto.randomUUID()))();storage.setItem(slot,key);}
 const headers=new Headers(init.headers);headers.set('idempotency-key',key);
 const response=await (options.fetch??fetch)(url,{...init,headers});
 // Public recovery deliberately conceals delivery; a 200 is not send confirmation.
 // HTTP headers alone do not acknowledge an operation: a response body can be
 // truncated after commit. Inspect a clone so original callers keep their DTO.
 if(response.ok && url!=='/api/affiliates/forgot-password') {
  try {
   const result=await response.clone().json();
   if(result?.ok===true && storage.getItem(slot)===key)storage.removeItem(slot);
  } catch { /* Unreadable acknowledgement retains the original UUID. */ }
 }
 return response;
}
