// api/turnout-series.js
export const config = { runtime: 'edge' };
import { createClient } from '@clickhouse/client-web';

const client = createClient({
  host: process.env.CLICKHOUSE_HOST,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
});

const TABLE = 'silver_sos_2024_09_voters_llama2_3_4';
const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

export default async function handler() {
  try {
    const result = await client.query({
      query: `
        SELECT *
        FROM (
          SELECT 'Aug 2024' AS label,
                 round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 0) AS pct,
                 202408 AS sort_key
          FROM ${TABLE} WHERE ${COHORT}

          UNION ALL

          SELECT 'Nov 2024' AS label,
                 round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct,
                 202411 AS sort_key
          FROM ${TABLE} WHERE ${COHORT}
        )
        ORDER BY sort_key
      `,
      format: 'JSONEachRow',
    });

    const rows = await result.json();

    return new Response(
      JSON.stringify({
        labels: rows.map(r => r.label),
        data: rows.map(r => Number(r.pct)),
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
