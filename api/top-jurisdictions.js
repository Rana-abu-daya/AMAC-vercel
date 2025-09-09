// api/top-jurisdictions.js
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { election } = req.body; // e.g. "Nov 2024"
  const table = "silver_sos_2024_09_voters_llama2_3_4";
  const cohort = "(lower(llama_names) LIKE 'muslim' OR lower(llama_names) LIKE 'revert')";

  // Which condition applies?
  const electionCond =
    election === "Nov 2024"
      ? "lower(ballot_status) = 'accepted'"
      : "upper(Aug_2024_Status) = 'VOTED'";

  try {
    const queries = {
      county: `
        SELECT countycode AS name,
               count() AS count,
               round(100 * countIf(${electionCond}) / count(), 1) AS turnout
        FROM ${table}
        WHERE ${cohort}
        GROUP BY countycode
        ORDER BY count DESC
        LIMIT 1
        FORMAT JSON
      `,
      congressional: `
        SELECT congressionaldistrict AS name,
               count() AS count,
               round(100 * countIf(${electionCond}) / count(), 1) AS turnout
        FROM ${table}
        WHERE ${cohort}
        GROUP BY congressionaldistrict
        ORDER BY count DESC
        LIMIT 1
        FORMAT JSON
      `,
      legislative: `
        SELECT legislativedistrict AS name,
               count() AS count,
               round(100 * countIf(${electionCond}) / count(), 1) AS turnout
        FROM ${table}
        WHERE ${cohort}
        GROUP BY legislativedistrict
        ORDER BY count DESC
        LIMIT 1
        FORMAT JSON
      `,
      cities: `
        SELECT regcity AS name,
               count() AS count,
               round(100 * countIf(${electionCond}) / count(), 1) AS turnout
        FROM ${table}
        WHERE ${cohort}
        GROUP BY regcity
        ORDER BY count DESC
        LIMIT 2
        FORMAT JSON
      `,
    };

    const agent = new HttpsProxyAgent(process.env.FIXIE_URL);
    const results = {};

    for (let key of Object.keys(queries)) {
      const resp = await fetch(process.env.CLICKHOUSE_URL, {
        method: "POST",
        body: queries[key],
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

      const json = await resp.json();
      if (key === "cities") {
        results.cities = json.data.map((r) => ({
          name: r.name,
          count: r.count,
          turnout: r.turnout,
        }));
      } else {
        const row = json.data?.[0] || {};
        results[key] = {
          name: row.name || "",
          count: row.count || 0,
          turnout: row.turnout || 0,
        };
      }
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("ClickHouse error:", err);
    res.status(500).json({ error: err.message });
  }
}
