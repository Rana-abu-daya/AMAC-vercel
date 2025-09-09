import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const proxyUrl = process.env.FIXIE_URL;
    const agent = new HttpsProxyAgent(proxyUrl);

    const query = `SELECT count() AS total_voters, 42 AS turnout_pct, 5 AS new_regs, 12 AS active_legis, 49 AS total_legis FORMAT JSON`;

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
          "Content-Type": "text/plain", // 👈 important
        },
        body: query, // 👈 send raw SQL, not JSON
        agent,
      }
    );

    // Parse JSON response from ClickHouse
    const data = await clickhouseRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
