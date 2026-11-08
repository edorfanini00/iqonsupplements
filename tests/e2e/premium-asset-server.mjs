// Loopback HTTPS delivery for actual public assets in the isolated Shopify fixture.
// Certificates are generated under ignored work/, never bundled or committed.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('public');
const server=https.createServer({key:fs.readFileSync(process.env.QA_ASSET_KEY||'work/qa-assets-key.pem'),cert:fs.readFileSync(process.env.QA_ASSET_CERT||'work/qa-assets-cert.pem')},(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'https://localhost').pathname));}catch{res.writeHead(400);res.end();return;}
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const mime={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime,'Content-Length':fs.statSync(file).size});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.QA_ASSET_PORT||3991),'127.0.0.1',()=>console.log('QA assets on loopback HTTPS port '+server.address().port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
