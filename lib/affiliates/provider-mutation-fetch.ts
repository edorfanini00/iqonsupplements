type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Options={storage?:StorageLike;randomUUID?:()=>string;fetch?:(url:string,init?:RequestInit)=>Promise<Response>};
/** UUID-only recovery, no retry loop or payload/recipient browser persistence.
 * Throw on unreadable success so original forms cannot clear after response loss.
 */
export async function providerMutationFetch(url:string,init:RequestInit,options:Options={}):Promise<Response>{
 const storage=options.storage??sessionStorage;const slot='iqon-provider-operation:'+url;
 let key=storage.getItem(slot);if(!key){key=(options.randomUUID??(()=>crypto.randomUUID()))();storage.setItem(slot,key);}
 const headers=new Headers(init.headers);headers.set('idempotency-key',key);
 const response=await(options.fetch??fetch)(url,{...init,headers});
 if(response.ok){const value=await response.clone().json();if(value?.ok!==true)throw Error('Acknowledgement unavailable; retain the unchanged operation.');if(storage.getItem(slot)===key)storage.removeItem(slot);}
 return response;
}
