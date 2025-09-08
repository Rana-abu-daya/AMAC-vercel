// api/turnout-series.js
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const FIXIE_URL = process.env.FIXIE_URL;

export default async function handler(req, res) {
  try {
    const query = `
      SELECT 1 FORMAT JSONEachRow
    `;

    const response = await fetch(
      'https://pod38uxp1w.us-west-2.aws.clickhouse.cloud:8443/?database=default',
      {
        method: 'POST',
        body: query,
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.CLICKHOUSE_USER + ':' + process.env.CLICKHOUSE_PASSWORD
            ).toString('base64'),
        },
        agent: new HttpsProxyAgent(FIXIE_URL), // 👈 Route via Fixie
      }
    );

    if (!response.ok) {
      throw new Error(`ClickHouse error: ${await response.text()}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
