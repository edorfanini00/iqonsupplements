import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {GET} from '../../app/api/cron/leaderboard/route';
test('migration command cannot start an independent affiliate database',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts['affiliates:migrate'],'node scripts/disabled-affiliate-migration.mjs');
});
test('bootstrap refuses independent accounts before DB work',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','scripts/bootstrap-affiliates.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,NODE_ENV:'test'}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Independent affiliate bootstrap is disabled/);
});
test('duplicate scheduled ownership is gone even when directly invoked',async()=>{assert.equal((await GET(new Request('https://www.iqonbody.com/api/cron/leaderboard'))).status,410);});
