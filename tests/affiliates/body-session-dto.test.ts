import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBodySession} from '../../lib/affiliates/body-session-dto';
const valid={version:1,session:{wpUserId:7,email:'existing@example.test',role:'admin',wpRoles:['administrator'],profile:{id:'p1',status:'active',firstName:'Test',lastName:'User',promoCode:'TEST',onboardedAt:null}}};
test('minimal versioned canonical session never invents full profile or leaks extra fields',()=>{
 const result=parseBodySession({...valid,session:{...valid.session,token:'secret',profile:{...valid.session.profile,bankInfo:'private'}}});
 assert.ok(result);assert.equal(result.wpUserId,7);assert.equal(result.portalUserId,7);assert.equal('token' in result,false);assert.equal('bankInfo' in result.profile!,false);
});
test('full and polling principal rejects invalid version identity role approval',()=>{
 for(const value of [{...valid,version:2},{session:valid.session},...[-1,0,1.5,'7'].map(wpUserId=>({...valid,session:{...valid.session,wpUserId}})),...['pending','disabled'].map(status=>({...valid,session:{...valid.session,profile:{...valid.session.profile,status}}})),{...valid,session:{...valid.session,role:'affiliate',profile:null}},{...valid,session:{...valid.session,email:null}},{...valid,session:{...valid.session,wpRoles:'administrator'}}])assert.equal(parseBodySession(value),null);
});
test('current resolved role wins over historical roles and staff can have no profile',()=>{
 assert.equal(parseBodySession({...valid,session:{...valid.session,role:'affiliate'}})?.role,'affiliate');
 assert.equal(parseBodySession({...valid,session:{...valid.session,profile:null}})?.role,'admin');
});
