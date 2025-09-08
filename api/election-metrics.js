// api/election-metrics.js
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import { createClient } from "@clickhouse/client";

// Create Fixie proxy agent
const proxyAgent = new HttpsProxyAgent(process.env.FIXIE_URL);

// Proxy-enabled ClickHouse client
const client = createClient({
  host: process.env.CLICKHOUSE_URL,       // https://...:8443
  username: process.env.CLICKHOUSE_USER,  // usually "default"
  password: process.env.CLICKHOUSE_PASSWORD,
  database: "default",
  tls: { rejectUnauthorized: true },
  fetch: (url, opts) => fetch(url, { ...opts, agent: proxyAgent })
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { election } = req.body || {};
    if (!election) {
      return res.status(400).json({ error: "Missing election parameter" });
    }

    // Example query — replace with your real one
    const query = `
      SELECT
        count() AS total_voters,
        round(100 * countIf(ballot_status = 'accepted') / count(), 0) AS turnout_pct,
        countIf(new_registration = 1) AS new_regs,
        uniq(legislative_district) AS active_legis,
        49 AS total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE election = {election:String}
    `;

    const response = await client.query({
      query,
      format: "JSONEachRow",
      query_params: { election }
    });

    const rows = await response.json();
    res.status(200).json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
