import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { election } = req.body;

  try {
    let query;

    if (election === "Nov 2024") {
      query = `
       SELECT
         count() AS total_voters,
         round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS turnout_pct,
         countIf(toYear(registrationdate) = 2024) AS new_regs,
         uniqExact(legislative_district) AS active_legis,
         (SELECT uniqExact(legislative_district) FROM silver_sos_2024_09_voters_llama2_3_4) AS total_legis
       FROM silver_sos_2024_09_voters_llama2_3_4
       WHERE lower(llama_names) IN ('muslim', 'revert')
       FORMAT JSON

      `;
    } else if (election === "Aug 2024") {
      query = `
      SELECT
        count() AS total_voters,
        round(100 * countIf(upper(Aug_2024_Status) = 'VOTED') / count(), 0) AS turnout_pct,
        countIf(toYear(registrationdate) = 2024) AS new_regs,
        uniqExact(legislative_district) AS active_legis,
        (SELECT uniqExact(legislative_district) FROM silver_sos_2024_09_voters_llama2_3_4) AS total_legis
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE lower(llama_names) IN ('muslim', 'revert')
      FORMAT JSON

      `;
    } else {
      return res.status(400).json({ error: "Unsupported election period" });
    }

    const proxyUrl = process.env.FIXIE_URL;
    const agent = new HttpsProxyAgent(proxyUrl);

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
    console.log(raw)
    // ✅ Normalize response
    res.status(200).json({
      data: raw.data || [],
      meta: raw.meta || [],
      stats: raw.statistics || {},
      row: raw.data?.[0] || {}, // shortcut for KPI cards
    });
  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
