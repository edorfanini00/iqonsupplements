/** Local HTTP adapter for the real BFF; no DB, .env loading or external service. */
import { createServer } from 'node:http';
import { relayAffiliateRequest } from '../../../lib/affiliates/shared-relay';
const server=createServer(async(req,res)=>{
  try {
    const chunks:Buffer[]=[]; for await(const chunk of req) chunks.push(Buffer.from(chunk));
    const body=Buffer.concat(chunks);
    const request=new Request(process.env.SHARED_AFFILIATE_PORTAL_ORIGIN+req.url!,{method:req.method,headers:req.headers as Record<string,string>,...(body.length?{body}: {})});
    const result=await relayAffiliateRequest(request);
    res.statusCode=result.status;
    result.headers.forEach((v,k)=>{if(k!=='set-cookie')res.setHeader(k,v);});
    const cookies=result.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
    res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.statusCode=500;res.end('fixture error');}
});
server.listen(0,'127.0.0.1',()=>{
  const address=server.address();if(!address||typeof address==='string')throw Error('address');
  process.env.SHARED_AFFILIATE_PORTAL_ORIGIN=`http://127.0.0.1:${address.port}`;
  process.send?.({port:address.port});
});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
