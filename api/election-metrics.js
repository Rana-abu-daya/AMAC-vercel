import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const proxyUrl = process.env.FIXIE_URL;
    const agent = new HttpsProxyAgent(proxyUrl);

    const TABLE = "silver_sos_2024_09_voters_llama2_3_4";
    const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

    // ✅ Single SQL query to return all KPI metrics at once
    const query = `
      SELECT
        count() AS total_voters,
        -- turnout: Aug 2024
        round(100 * countIf(lower(Aug_2024_Status) = 'voted') / nullIf(count(),0), 0) AS turnout_pct,
        -- new regs in 2024
        countIf(toYear(registrationdate) = 2024) AS new_regs,
        -- active districts
        uniqExact(legislativedistrict) AS active_legis,
        49 AS total_legis
      FROM ${TABLE}
      WHERE ${COHORT}
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
          "Content-Type": "text/plain", // 👈 raw SQL
        },
        body: query,
        agent,
      }
    );

    if (!clickhouseRes.ok) {
      throw new Error(
        `ClickHouse HTTP ${clickhouseRes.status}: ${await clickhouseRes.text()}`
      );
    }

    // ✅ Parse JSON response from ClickHouse
    const data = await clickhouseRes.json();

    // ClickHouse JSON has "data" array, we want the first row
    res.status(200).json(data.data[0] || {});
  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
