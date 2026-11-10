import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache=new Map();
export function sourceModuleUrl(file){
 file=path.resolve(file);
 if(cache.has(file))return cache.get(file);
 let source=file.endsWith('.json')?'export default '+fs.readFileSync(file,'utf8')+';':ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
 source=source.replace(/from (["'])(\.[^"']+)\1/g,(match,quote,name)=>{
  const base=path.resolve(path.dirname(file),name);
  const target=[base,base+'.ts',base+'.json'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
  if(!target)throw new Error('Unresolved source '+base);
  return 'from '+JSON.stringify(sourceModuleUrl(target));
 });
 const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');cache.set(file,url);return url;
}
