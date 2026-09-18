import {nativeMutationFetch} from './native-mutation-fetch';
/** A complete canonical DTO, not HTTP headers, acknowledges accounting writes.
 * Reuses UUID-only persistence; an unreadable response must not clear forms.
 */
export async function accountingMutationFetch(url:string,init:RequestInit,options:Parameters<typeof nativeMutationFetch>[2]={}):Promise<Response>{
 const response=await nativeMutationFetch(url,init,options);
 if(response.ok){
  const value=await response.clone().json();
  if(value?.ok!==true)throw Error('Accounting acknowledgement unavailable; retry the unchanged operation.');
 }
 return response;
}
