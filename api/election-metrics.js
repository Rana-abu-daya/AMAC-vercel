// api/election-metrics.js
import { createClient } from '@clickhouse/client';

const client = createClient({
  host: process.env.CLICKHOUSE_URL,  // e.g. https://<cluster>.clickhouse.cloud:8443
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'default',
  tls: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { election } = req.body;

    const query = `
      SELECT count() as total_voters,
             round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 1) as turnout_pct,
             countIf(registration_date >= '2024-01-01') as new_regs,
             uniq(legislative_district) as active_legis,
             49 as total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
    `;

    const result = await client.query({
      query,
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    res.status(200).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
