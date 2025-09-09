//// api/turnout-series.js
//const fetch = require("node-fetch");
//const { HttpsProxyAgent } = require("https-proxy-agent");
//
//const FIXIE_URL = process.env.FIXIE_URL;
//const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
//const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";
//const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;
//
//const TABLE = "silver_sos_2024_09_voters_llama2_3_4";
//const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";
//
//module.exports = async (req, res) => {
//  try {
//    const query = `
//      SELECT * FROM (
//        SELECT 'Aug 2024' AS label,
//               round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 0) AS pct
//        FROM ${TABLE} WHERE ${COHORT}
//        UNION ALL
//        SELECT 'Nov 2024' AS label,
//               round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct
//        FROM ${TABLE} WHERE ${COHORT}
//      )
//      ORDER BY label
//      FORMAT JSONEachRow
//    `; // 👈 force JSON output
//
//    const response = await fetch(CLICKHOUSE_URL, {
//      method: "POST",
//      body: query,
//      headers: {
//        Authorization:
//          "Basic " +
//          Buffer.from(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`).toString(
//            "base64"
//          ),
//        "Content-Type": "text/plain",
//      },
//      agent: new HttpsProxyAgent(FIXIE_URL),
//    });
//
//    if (!response.ok) {
//      const errText = await response.text();
//      throw new Error(`ClickHouse HTTP ${response.status}: ${errText}`);
//    }
//
//    const text = await response.text();
//    console.log("Raw ClickHouse response:", text); // 👈 debug
//
//    // Parse JSONEachRow (line-delimited JSON objects)
//    const rows = text
//      .trim()
//      .split("\n")
//      .map((line) => JSON.parse(line));
//
//    res.status(200).json({
//      labels: rows.map((r) => r.label),
//      data: rows.map((r) => Number(r.pct)),
//    });
//  } catch (err) {
//    console.error("ClickHouse error:", err.message);
//    res.status(500).json({ error: err.message });
//  }
//};


// api/turnout-series.js
const fetch = require("node-fetch");
const { HttpsProxyAgent } = require("https-proxy-agent");

const FIXIE_URL = process.env.FIXIE_URL;
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || "default";
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;

const TABLE = "silver_sos_2024_09_voters_llama2_3_4";
const COHORT = "(lower(llama_names) LIKE '%muslim%' OR lower(llama_names) LIKE '%revert%')";

module.exports = async (req, res) => {
  try {
    const query = `
      SELECT * FROM (
        SELECT 'Aug 2024' AS label,
               round(100 * countIf(upper(Aug_2024_Status) = 'VOTED') / count(), 0) AS pct
        FROM ${TABLE} WHERE ${COHORT}
        UNION ALL
        SELECT 'Nov 2024' AS label,
               round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct
        FROM ${TABLE} WHERE ${COHORT}
      )
      ORDER BY label
      FORMAT JSONEachRow
    `;

    const response = await fetch(CLICKHOUSE_URL, {
      method: "POST",
      body: query,
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`).toString("base64"),
        "Content-Type": "text/plain",
      },
      agent: new HttpsProxyAgent(FIXIE_URL),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ClickHouse HTTP ${response.status}: ${errText}`);
    }

    const text = await response.text();
    const rows = text.trim().split("\n").map((line) => JSON.parse(line));

    // Default static values
    const chartData = {
      labels: ["Feb 2024", "Aug 2023", "Nov 2023", "Aug 2024", "Nov 2024", "Aug 2025"],
      data: [58, 65, 72, null, null, 0], // placeholders for dynamic
    };

    // Replace Aug 2024 + Nov 2024 with DB results
    rows.forEach((r) => {
      const idx = chartData.labels.indexOf(r.label);
      if (idx !== -1) chartData.data[idx] = Number(r.pct);
    });

    res.status(200).json(chartData);
  } catch (err) {
    console.error("ClickHouse error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
