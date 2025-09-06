// /api/turnout-series.js
export const config = { runtime: 'edge' };
import { createClient } from '@clickhouse/client-web';

const ch = createClient({
  host: process.env.CLICKHOUSE_HOST,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASS,
  database: process.env.CLICKHOUSE_DB,
});

const TBL = 'silver_sos_2024_09_voters_llama2_3_4';
const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

export default async function handler() {
  try {
    const rows = await ch.query({
      query: `
        SELECT * FROM (
          SELECT 'Aug 24' AS label,
                 round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 0) AS pct
          FROM ${TBL} WHERE ${COHORT}
          UNION ALL
          SELECT 'Nov 24' AS label,
                 round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct
          FROM ${TBL} WHERE ${COHORT}
        )
        ORDER BY label
      `,
      format: 'JSONEachRow'
    }).then(r => r.json());

    return new Response(JSON.stringify({
      labels: rows.map(r => r.label),
      data: rows.map(r => Number(r.pct))
    }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch {
    return new Response(JSON.stringify({ labels: [], data: [] }), { status: 500 });
  }
}
