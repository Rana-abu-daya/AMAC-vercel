import { createClient } from '@clickhouse/client';
import { HttpsProxyAgent } from 'https-proxy-agent';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { election } = req.body;
    if (!election) {
      return res.status(400).json({ error: 'Missing election parameter' });
    }

    // ✅ Fixie proxy agent
    const proxy = process.env.FIXIE_URL
      ? new HttpsProxyAgent(process.env.FIXIE_URL)
      : undefined;

    const client = createClient({
      host: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: 'default',
      tls: { rejectUnauthorized: false },
      http_agent: proxy   // <<--- this makes all traffic go via Fixie
    });

    const query = `
      SELECT
        count() as total_voters,
        round(100 * countIf(ballot_status = 'accepted') / count(), 1) as turnout_pct,
        countIf(new_registration = 1) as new_regs,
        uniq(district_id) as active_legis,
        49 as total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE election_period = {election:String}
    `;

    const result = await client.query({
      query,
      format: 'JSONEachRow',
      query_params: { election }
    });

    const rows = await result.json();
    res.status(200).json(rows[0] || {});
  } catch (err) {
    console.error('Election metrics error:', err);
    res.status(500).json({ error: err.message });
  }
}
