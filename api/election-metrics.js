import { ClickHouse } from '@clickhouse/client';
import { HttpsProxyAgent } from 'https-proxy-agent';

export default async function handler(req, res) {
  if (req.method !== 'POST') {

    return res.status(405).json({ error: 'Method not allowed'+req.method });
  }

  try {
    const { election } = req.body;

    // Proxy agent (Fixie or another HTTPS proxy)
    const proxyAgent = new HttpsProxyAgent(process.env.FIXIE_URL);

    const client = new ClickHouse({
      host: process.env.CLICKHOUSE_HOST,  // e.g. https://podxxxx.clickhouse.cloud:8443
      username: 'default',
      password: process.env.CLICKHOUSE_PASSWORD,
      tls: { rejectUnauthorized: true },
      request_timeout: 10000,
      httpAgent: proxyAgent
    });

    // Example query
    const rows = await client.query({
      query: `
        SELECT
          sum(total_voters) AS total_voters,
          avg(turnout_pct) AS turnout_pct,
          sum(new_regs) AS new_regs,
          countDistinct(district_id) AS active_legis,
          49 AS total_legis
        FROM voter_metrics
        WHERE election = {election: String}
      `,
      query_params: { election },
      format: 'JSONEachRow'
    });

    const data = await rows.json();
    res.status(200).json(data[0] || {});
  } catch (err) {
    console.error('Election metrics error:', err);
    res.status(500).json({ error: err.message });
  }
}
