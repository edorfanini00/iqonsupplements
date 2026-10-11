import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db/prisma";
import { isDatabaseConfigured } from "./db/database";
import { PRIVACY_PURPOSES, type PrivacyChoices, type PrivacyPurpose } from "./privacy";

// The authoritative record of each anonymous visitor's privacy decision. Ordering comes
// from PostgreSQL alone: every change is one conditional UPDATE that increments revision,
// and Postgres re-checks its WHERE clause after taking the row lock, so concurrent saves
// on any number of serverless instances apply one at a time against the current row.
export type LedgerRecord={choices:PrivacyChoices;revision:number};
export type LedgerChange=
  |{kind:"withdraw";purposes:PrivacyPurpose[]}
  // A grant applies only if the visitor was shown expectedRevision, or if the change adds
  // no grant to the current row. purposes in `forbidden` (GPC) may never be newly granted.
  |{kind:"choices";choices:PrivacyChoices;expectedRevision:number;forbidden:PrivacyPurpose[]};
export type PrivacyLedger={
  read(visitorKey:string):Promise<LedgerRecord|null>;
  save(visitorKey:string, change:LedgerChange):Promise<{applied:boolean;record:LedgerRecord}>;
};

// Rows not changed for this long are removed, a few at a time, after saves.
export const RETENTION_DAYS=400;
type Row={analytics:boolean|null;marketing:boolean|null;preferences:boolean|null;sale_of_data:boolean|null;revision:number};
const toRecord=(row:Row):LedgerRecord=>({choices:{analytics:row.analytics,marketing:row.marketing,preferences:row.preferences,saleOfData:row.sale_of_data},revision:row.revision});
const flags=(purposes:PrivacyPurpose[])=>PRIVACY_PURPOSES.map(p=>purposes.includes(p));

export function prismaPrivacyLedger(client:PrismaClient):PrivacyLedger {
  const read=async(visitorKey:string)=>{
    const rows=await client.$queryRaw<Row[]>`SELECT analytics, marketing, preferences, sale_of_data, revision FROM storefront_privacy_consents WHERE visitor_key = ${visitorKey}`;
    return rows[0]?toRecord(rows[0]):null;
  };
  // Withdraws the listed purposes. Only rows where something actually changes get a new revision.
  const withdraw=async(visitorKey:string, purposes:PrivacyPurpose[])=>{
    const [a,m,p,s]=flags(purposes);
    await client.$executeRaw`
      UPDATE storefront_privacy_consents SET
        analytics = CASE WHEN ${a}::boolean THEN false ELSE analytics END,
        marketing = CASE WHEN ${m}::boolean THEN false ELSE marketing END,
        preferences = CASE WHEN ${p}::boolean THEN false ELSE preferences END,
        sale_of_data = CASE WHEN ${s}::boolean THEN false ELSE sale_of_data END,
        revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE visitor_key = ${visitorKey}
        AND ((${a}::boolean AND analytics IS DISTINCT FROM false) OR (${m}::boolean AND marketing IS DISTINCT FROM false)
          OR (${p}::boolean AND preferences IS DISTINCT FROM false) OR (${s}::boolean AND sale_of_data IS DISTINCT FROM false))`;
  };
  return {
    read,
    async save(visitorKey,change) {
      await client.$executeRaw`INSERT INTO storefront_privacy_consents (visitor_key) VALUES (${visitorKey}) ON CONFLICT (visitor_key) DO NOTHING`;
      let applied=true;
      if(change.kind==="withdraw") await withdraw(visitorKey,change.purposes);
      else {
        const c=change.choices;
        const [ga,gm,gp,gs]=flags(PRIVACY_PURPOSES.filter(p=>c[p]===true));
        const [fa,fm,fp,fs]=flags(change.forbidden.filter(p=>c[p]===true));
        const count=await client.$executeRaw`
          UPDATE storefront_privacy_consents SET
            analytics = ${c.analytics}::boolean, marketing = ${c.marketing}::boolean,
            preferences = ${c.preferences}::boolean, sale_of_data = ${c.saleOfData}::boolean,
            revision = revision + 1, updated_at = CURRENT_TIMESTAMP
          WHERE visitor_key = ${visitorKey}
            AND (revision = ${change.expectedRevision}
              OR ((NOT ${ga}::boolean OR analytics IS TRUE) AND (NOT ${gm}::boolean OR marketing IS TRUE)
                AND (NOT ${gp}::boolean OR preferences IS TRUE) AND (NOT ${gs}::boolean OR sale_of_data IS TRUE)))
            AND (NOT ${fa}::boolean OR analytics IS TRUE) AND (NOT ${fm}::boolean OR marketing IS TRUE)
            AND (NOT ${fp}::boolean OR preferences IS TRUE) AND (NOT ${fs}::boolean OR sale_of_data IS TRUE)`;
        if(count!==1) {
          // The grants are refused, but any withdrawal in the same request still applies.
          applied=false;
          const withdrawals=PRIVACY_PURPOSES.filter(p=>c[p]===false);
          if(withdrawals.length) await withdraw(visitorKey,withdrawals);
        }
      }
      const record=await read(visitorKey);
      if(!record) throw new Error("privacy ledger row missing after save");
      try {
        await client.$executeRaw`DELETE FROM storefront_privacy_consents WHERE visitor_key IN (
          SELECT visitor_key FROM storefront_privacy_consents WHERE updated_at < CURRENT_TIMESTAMP - ${RETENTION_DAYS}::int * interval '1 day' LIMIT 50)`;
      } catch {}
      return {applied,record};
    },
  };
}

// The application's ledger, or null when no database is configured for this deployment.
export const privacyLedger:PrivacyLedger|null=isDatabaseConfigured()?prismaPrivacyLedger(prisma):null;
