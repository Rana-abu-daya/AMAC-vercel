// /api/election-metrics.js
export const config = { runtime: 'edge' };
import { createClient } from '@clickhouse/client-web';

const ch = createClient({
  host: process.env.CLICKHOUSE_HOST,     // https://<cluster>.clickhouse.cloud:8443
  username: process.env.CLICKHOUSE_USER, // read-only user
  password: process.env.CLICKHOUSE_PASS,
  database: process.env.CLICKHOUSE_DB,   // optional
});

const TBL = 'silver_sos_2024_09_voters_llama2_3_4';
const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

function parseElection(label) {
  // "Nov 2024" -> { y: 2024, key: '2024-11' }
  const [mon, yearStr] = label.split(' ');
  const months = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
                   Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
  return { y: Number(yearStr), key: `${yearStr}-${months[mon]}` };
}

export default async function handler(req) {
  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const electionLabel = body?.election || 'Nov 2024';
    const { y, key } = parseElection(electionLabel);

    // 1) Total / NewRegs / ActiveLegis in one pass
    const baseQ = await ch.query({
      query: `
        SELECT
          count()                                                    AS total_voters,
          countIf(toYear(registrationdate) = {yr:UInt16})            AS new_regs,
          uniqExact(legislativedistrict)                             AS active_legis
        FROM ${TBL}
        WHERE ${COHORT}
      `,
      query_params: { yr: y },
      format: 'JSONEachRow'
    }).then(r => r.json());

    const { total_voters = 0, new_regs = 0, active_legis = 0 } = baseQ?.[0] || {};

    // 2) Current Turnout depends on selected election
    let turnoutQ;
    if (key === '2024-11') {
      turnoutQ = await ch.query({
        query: `
          SELECT round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 1) AS turnout_pct
          FROM ${TBL}
          WHERE ${COHORT}
        `,
        format: 'JSONEachRow'
      }).then(r => r.json());
    } else if (key === '2024-08') {
      turnoutQ = await ch.query({
        query: `
          SELECT round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 1) AS turnout_pct
          FROM ${TBL}
          WHERE ${COHORT}
        `,
        format: 'JSONEachRow'
      }).then(r => r.json());
    } else {
      turnoutQ = [{ turnout_pct: 0 }]; // future/unsupported elections
    }

    const turnout_pct = turnoutQ?.[0]?.turnout_pct ?? 0;

    return new Response(JSON.stringify({
      total_voters,
      turnout_pct,
      new_regs,
      active_legis,
      total_legis: 49,
    }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=30, stale-while-revalidate=300'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'election-metrics failed' }), { status: 500 });
  }
}
