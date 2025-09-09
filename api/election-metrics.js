import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const proxyUrl = process.env.FIXIE_URL;
    const agent = new HttpsProxyAgent(proxyUrl);

    const query = `
      SELECT
        count() AS total_voters,
        round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 1) AS turnout_pct,
        countIf(toYear(registrationdate) = 2024) AS new_regs,
        uniqExact(legislativedistrict) AS active_legis,
        countDistinct(legislativedistrict) AS total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
      FORMAT JSON
    `;

    const clickhouseRes = await fetch(
      "https://pod38uxp1w.us-west-2.aws.clickhouse.cloud:8443/?database=default",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              process.env.CLICKHOUSE_USER + ":" + process.env.CLICKHOUSE_PASSWORD
            ).toString("base64"),
          "Content-Type": "text/plain",
        },
        body: query,
        agent,
      }
    );

    const raw = await clickhouseRes.json();

    // ✅ Normalize result for frontend
    res.status(200).json({
      data: raw.data || [],       // always an array
      meta: raw.meta || [],
      stats: raw.statistics || {}
    });
  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
