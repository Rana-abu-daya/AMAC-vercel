// api/top-jurisdictions.js
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export default async function handler(req, res) {
  const { election, mode } = req.query;
  const cohort = "(lower(llama_names) = 'muslim' OR lower(llama_names) = 'revert')";
  const table = "silver_sos_2024_09_voters_llama2_3_4";
  const electionCond = election === "Nov 2024"
    ? "lower(ballot_status) = 'accepted'"
    : "upper(Aug_2024_Status) = 'VOTED'";

  try {
    const queries = {
      county: `
        SELECT countycode AS name, ${
          mode === "count"
            ? "count() AS value"
            : `round(100 * countIf(${electionCond}) / count(), 0) AS value`
        }
        FROM ${table}
        WHERE ${cohort}
        GROUP BY county ORDER BY value DESC LIMIT 1 FORMAT JSON;
      `,
      congressional: `
        SELECT congressionaldistrict AS name, ${
          mode === "count"
            ? "count() AS value"
            : `round(100 * countIf(${electionCond}) / count(), 0) AS value`
        }
        FROM ${table}
        WHERE ${cohort}
        GROUP BY congressionaldistrict ORDER BY value DESC LIMIT 1 FORMAT JSON;
      `,
      legislative: `
        SELECT legislativedistrict AS name, ${
          mode === "count"
            ? "count() AS value"
            : `round(100 * countIf(${electionCond}) / count(), 0) AS value`
        }
        FROM ${table}
        WHERE ${cohort}
        GROUP BY legislativedistrict ORDER BY value DESC LIMIT 1 FORMAT JSON;
      `,
      cities: `
        SELECT regcity AS name, ${
          mode === "count"
            ? "count() AS value"
            : `round(100 * countIf(${electionCond}) / count(), 0) AS value`
        }
        FROM ${table}
        WHERE ${cohort}
        GROUP BY city ORDER BY value DESC LIMIT 2 FORMAT JSON;
      `
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
         const row = json.data?.[0] || {};
         if (key === "cities") {
           results.cities = json.data.map((r) => ({
             name: r.name,
             value: r.value,
           }));
         } else {
           results[key] = { name: row.name || "", value: row.value || 0 };
         }
       }

       res.status(200).json(results);
     } catch (err) {
       console.error("ClickHouse error:", err);
       res.status(500).json({ error: err.message });
     }
   }