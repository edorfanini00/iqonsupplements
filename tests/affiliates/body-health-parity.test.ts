import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/health-original-parity.json',import.meta.url),'utf8'));
for(const [path,expected] of Object.entries(fixture.files)) {
 test(`Body preserves restored Health behavior and full reporting: ${path}`,()=>{
  const file=new URL('../../'+path,import.meta.url);
  assert.ok(existsSync(file),`Missing restored source ${path}`);
  let source=readFileSync(file,'utf8');
  const native=JSON.parse(readFileSync(new URL('./fixtures/native-account-reviewed-adaptation.json',import.meta.url),'utf8'))[path];
  if(native)for(const hunk of native.hunks){
    assert.equal(source.split(hunk.canonical).length,2,'Exact reviewed account action adaptation');
    source=source.replace(hunk.canonical,hunk.original);
  }
  if(path==='app/affiliates/admin/page.tsx'){
   const adaptation=JSON.parse(readFileSync(new URL('./fixtures/bulk-reviewed-adaptation.json',import.meta.url),'utf8'));
   for(const hunk of adaptation.hunks){
    assert.equal(source.split(hunk.canonical).length,2,'Exact native bulk-only adaptation');
    source=source.replace(hunk.canonical,hunk.original);
   }
  }
  if(path==='app/affiliates/admin/payouts/page.tsx'){
   const adaptation=JSON.parse(readFileSync(new URL('./fixtures/payout-outstanding-reviewed-adaptation.json',import.meta.url),'utf8'));
   for(const hunk of adaptation.hunks){
    assert.equal(source.split(hunk.canonical).length,2,'Reviewed settlement-only adaptation must match exactly once');
    source=source.replace(hunk.canonical,hunk.original);
   }
  }
  if(path==='app/affiliates/admin/affiliates/page.tsx'){
   const adaptation=JSON.parse(readFileSync(new URL('./fixtures/admin-create-reviewed-adaptation.json',import.meta.url),'utf8'));
   for(const hunk of adaptation.hunks){
    assert.equal(source.split(hunk.canonical).length,2,'Reviewed canonical identity adaptation must match exactly once');
    source=source.replace(hunk.canonical,hunk.original);
   }
  }
  source=source.replace('\n      // BODY COMMAND REJECTION STATE\n      else { const data = await res.json(); setError(data.error || "Command not confirmed complete. Check Command recovery."); }', '');
  source=source.replace(/\/\/ BODY CATEGORY CONTROLS\nimport \{ CanonicalAffiliateControls \} from "@\/components\/affiliates\/shared\/CanonicalAffiliateControls";\n/, '')
   .replace(/      \{\/\* BODY CATEGORY CONTROLS \*\/\}\n      <CanonicalAffiliateControls affiliateId=\{id\} \/>\n\n/, '');
  // Strip only the two explicitly reviewed additive category mounts/imports.
  // The original Health fixture remains untouched; all existing bytes still hash.
  source=source.replace(/\/\/ BODY COMMAND ADAPTER\nimport \{ canonicalActionFetch as fetch \} from "@\/lib\/affiliates\/canonical-action-fetch";\n/, '').replace(/\/\/ BODY CATEGORY ADDITION\nimport \{ CategoryRevenue \} from "@\/components\/affiliates\/shared\/CategoryRevenue";\n/, '')
    .replace(/      \{\/\* BODY CATEGORY ADDITION \*\/\}\n      <CategoryRevenue preset=\{preset\} audience="(?:admin|affiliate)" \/>\n\n/, '');
  assert.equal(createHash('sha256').update(source).digest('hex'),expected,'Original source must remain exact outside reviewed additive mounts');
 });
}
