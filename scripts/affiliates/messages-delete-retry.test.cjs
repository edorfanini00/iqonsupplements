// Bounded source-handler regression: no React server, database or provider.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const file = 'app/affiliates/admin/messages/page.tsx';
const source = fs.readFileSync(path.join(root, file), 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(n) {
  if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'removeMessage') handler = n.initializer.arguments[0].getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast);
assert.ok(handler, 'extract actual mounted removeMessage callback');
function loadTs(relative) {
  const filename = path.resolve(root, relative + '.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',output)(name => loadTs(path.relative(root,path.resolve(path.dirname(filename),name))),module,module.exports);
  return module.exports;
}
const {nonproviderMutationFetch} = loadTs('lib/affiliates/nonprovider-mutation-fetch');
for (const outcome of ['lost','truncated','negative-dto','negative-http','unconfirmed-dto','confirmed','cancel']) {
  test(`actual Messages handler: ${outcome} preserves retry until confirmed`, async () => {
    const original = [{id:'owned'},{id:'other'}];
    let messages = original, active = original[0], calls = [], release;
    const values = new Map();
    const storage = {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    const key = 'b825f948-44f4-4a70-8741-51d4f1957ca2';
    const transport = async (url,init) => {
      calls.push({url,method:init.method,key:init.headers.get('idempotency-key')});
      if(calls.length > 1) return Response.json({ok:true});
      await new Promise(resolve=>{release=resolve;});
      if(outcome==='lost') throw Error('synthetic response lost after commit');
      if(outcome==='truncated') return new Response('{"ok":', {status:200});
      if(outcome==='negative-http') return Response.json({ok:false},{status:409});
      return Response.json(outcome==='unconfirmed-dto'?{}:{ok:outcome==='confirmed'});
    };
    const js = ts.transpileModule(`const callback = ${handler};`, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const fn = new Function('window','nonproviderMutationFetch','setMessages','setActive',`${js}; return callback;`)(
      {confirm:()=>outcome!=='cancel'}, (url,init)=>nonproviderMutationFetch(url,init,{storage,randomUUID:()=>key,fetch:transport}),
      update=>{messages=update(messages);},update=>{active=update(active);});
    const pending = fn('owned');
    assert.deepEqual(messages,original,'row/retry control stays visible while acknowledgement is pending');
    assert.equal(active,original[0],'original message panel stays open');
    if(outcome==='cancel') {await pending;assert.equal(calls.length,0);assert.equal(values.size,0);return;}
    release(); await pending;
    if(outcome!=='confirmed') {
      assert.deepEqual(messages,original,'failed acknowledgement must retain row');
      assert.equal(active,original[0],'failed acknowledgement must retain panel');
      assert.equal(values.get('iqon-native-operation:/api/affiliates/admin/messages/owned'),key);
      await fn('owned');
      assert.equal(calls.length,2);
      assert.equal(calls[1].key,calls[0].key,'retry uses exact original UUID');
      assert.deepEqual(calls[1],calls[0],'retry preserves method and target');
    }
    assert.deepEqual(messages,[original[1]]);
    assert.equal(active,null);
    assert.equal(values.size,0,'confirmed DTO releases UUID');
  });
}
function jsx(text) {
  const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), result=[];
  function walk(n){if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n)){result.push(n.getText(tree));return;}ts.forEachChild(n,walk);}
  walk(tree);return result;
}
test('Messages JSX equals pinned pre-fix source',()=>{
  const base = fs.existsSync(path.join(root,'tsconfig.next.json')) ? 'e0162d2a95fd9a7e657fe34c0d32a95302c71ac9' : '09e221256e941f2447a5a9626fb2ec4927630be6';
  assert.deepEqual(jsx(source),jsx(cp.execFileSync('git',['show',`${base}:${file}`],{cwd:root,encoding:'utf8'})));
});
