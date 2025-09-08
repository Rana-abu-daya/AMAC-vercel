// api/election-metrics.js
import { createClient } from '@clickhouse/client';

const client = createClient({
  host: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'default',
  tls: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  try {
    const election = req.body?.election || 'Nov 2024';

    const whereClause = election === 'Aug 2024'
      ? "lower(Aug_2024_Status) = 'voted'"
      : "lower(ballot_status) = 'accepted'";

    const query = `
      SELECT
        count() AS total_voters,
        round(100 * countIf(${whereClause}) / count(), 1) AS turnout_pct,
        countIf(is_new_reg = 1) AS new_regs,
        uniq(legis_district) AS active_legis,
        uniq(legis_district) AS total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
    `;

    const rows = await client.query({ query, format: 'JSONEachRow' }).then(r => r.json());
    const m = rows[0] || {};

    res.status(200).json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

