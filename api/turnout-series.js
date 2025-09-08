// api/turnout-series.js
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

export default async function handler(req, res) {
  try {
    const rows = await client.query({
      query: `
        SELECT * FROM (
          SELECT 'Aug 2024' AS label,
                 round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 0) AS pct
          FROM ${TABLE} WHERE ${COHORT}
          UNION ALL
          SELECT 'Nov 2024' AS label,
                 round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct
          FROM ${TABLE} WHERE ${COHORT}
        )
        ORDER BY label
      `,
      format: 'JSONEachRow',
    }).then(r => r.json());

    res.status(200).json({
      labels: rows.map(r => r.label),
      data: rows.map(r => Number(r.pct)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
