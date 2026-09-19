import {nativeMutationFetch} from './native-mutation-fetch';
import {nonproviderTarget} from './nonprovider-target';
/** Preserve controls/DTOs, but never acknowledge headers without the full DTO. */
export async function nonproviderMutationFetch(url:string,init:RequestInit={},options:Parameters<typeof nativeMutationFetch>[2]={}):Promise<Response>{
 if(!nonproviderTarget(url,(init.method??'GET').toUpperCase()))return (options.fetch??fetch)(url,init);
 const response=await nativeMutationFetch(url,init,options);
 if(response.ok && (await response.clone().json())?.ok!==true)throw Error('Acknowledgement unavailable; retry the unchanged operation.');
 return response;
}
