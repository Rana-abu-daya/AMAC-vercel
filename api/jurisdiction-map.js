// api/jurisdiction-map.js
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { election, jurisdiction } = req.body;

    // Column mapping for ClickHouse
    const colMap = {
      'Counties': 'countycode AS name',
      'Legislative Districts': 'legislativedistrict AS name',
      'Congressional Districts': 'congressionaldistrict AS name',
      'Cities': 'regcity AS name',
      'State Level': ` 'Washington State' AS name `
    };

    const col = colMap[jurisdiction];
    if (!col) {
      return res.status(400).json({ error: 'Unsupported jurisdiction' });
    }

    // Election condition
    const electionCond = election === 'Nov 2024'
      ? "lower(ballot_status) = 'accepted'"
      : "upper(Aug_2024_Status) = 'VOTED'";

    // SQL query (⚠️ notice no geometry column)
    const sql = `
      SELECT
        ${col},
        count() AS voter_count,
        round(100 * countIf(${electionCond}) / count(), 1) AS turnout
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE lower(llama_names) LIKE 'muslim' OR lower(llama_names) LIKE 'revert'
      GROUP BY name
      FORMAT JSON
    `;

    const agent = new HttpsProxyAgent(process.env.FIXIE_URL);

    const resp = await fetch(process.env.CLICKHOUSE_URL, {
      method: "POST",
      body: sql,
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`
          ).toString("base64"),
        "Content-Type": "text/plain",
      },
      agent,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`ClickHouse error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    res.status(200).json({ data: data.data || [] });

  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
