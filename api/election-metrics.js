// api/election-metrics.js
import { createClient } from '@clickhouse/client';

const client = createClient({
  host: process.env.CLICKHOUSE_URL,       // must be https://...:8443
  username: process.env.CLICKHOUSE_USER,  // usually "default"
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'default',
  // Force secure TLS connection
  tls: {
    rejectUnauthorized: false, // try false if Vercel blocks CA, or true if you uploaded CA cert
  }
});

console.log("Connecting to", process.env.CLICKHOUSE_URL);
const TABLE = 'silver_sos_2024_09_voters_llama2_3_4';
const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

export default async function handler(req) {
  try {
    const { election = 'Nov 2024' } =
      req.method === 'POST' ? await req.json() : {};

    // --- Base metrics: total voters, new regs, active districts
    const baseResult = await client.query({
      query: `
        SELECT
          count() AS total_voters,
          countIf(toYear(registrationdate) = 2024) AS new_regs,
          uniqExact(legislativedistrict) AS active_legis
        FROM ${TABLE}
        WHERE ${COHORT}
      `,
      format: 'JSONEachRow',
    });
    const base = await baseResult.json();
    const { total_voters = 0, new_regs = 0, active_legis = 0 } = base[0] || {};

    // --- Turnout
    let turnoutQuery = '';
    if (election === 'Nov 2024') {
      turnoutQuery = `
        SELECT round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 1) AS turnout_pct
        FROM ${TABLE}
        WHERE ${COHORT}
      `;
    } else if (election === 'Aug 2024') {
      turnoutQuery = `
        SELECT round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 1) AS turnout_pct
        FROM ${TABLE}
        WHERE ${COHORT}
      `;
    }

    let turnout_pct = 0;
    if (turnoutQuery) {
      const turnoutResult = await client.query({
        query: turnoutQuery,
        format: 'JSONEachRow',
      });
      const turnout = await turnoutResult.json();
      turnout_pct = turnout[0]?.turnout_pct || 0;
    }

    // --- Response
    return new Response(
      JSON.stringify({
        total_voters,
        new_regs,
        active_legis,
        total_legis: 49, // hardcoded total
        turnout_pct,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
