import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const adaptations=JSON.parse(readFileSync(new URL('./fixtures/native-account-reviewed-adaptation.json',import.meta.url),'utf8'));
for(const [path,value] of Object.entries(adaptations))test(`native account action preserves original UI bytes: ${path}`,()=>{
 const adaptation=value as {originalSha256:string;hunks:{original:string;canonical:string}[]};
 let source=readFileSync(new URL('../../'+path,import.meta.url),'utf8');
 for(const hunk of adaptation.hunks){assert.equal(source.split(hunk.canonical).length,2);source=source.replace(hunk.canonical,hunk.original);}
 assert.equal(createHash('sha256').update(source).digest('hex'),adaptation.originalSha256);
});
