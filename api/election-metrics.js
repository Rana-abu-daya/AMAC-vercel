import { ClickHouse } from '@clickhouse/client';
import { HttpsProxyAgent } from 'https-proxy-agent';

const client = new ClickHouse({
  host: process.env.CLICKHOUSE_HOST,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASS,
  database: 'default',
  tls: { rejectUnauthorized: true },
  httpAgent: new HttpsProxyAgent(process.env.FIXIE_URL)
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const TABLE = "silver_sos_2024_09_voters_llama2_3_4";
    const COHORT = "multiSearchAny(lower(llama_names), ['muslim','revert'])";

    // KPIs
    const [voters, regs, legis] = await Promise.all([
      client.query({ query: `SELECT count() AS total_voters FROM ${TABLE} WHERE ${COHORT} FORMAT JSONEachRow` }).then(r => r.json()),
      client.query({ query: `SELECT count() AS new_regs FROM ${TABLE} WHERE ${COHORT} AND toYear(registrationdate) = 2024 FORMAT JSONEachRow` }).then(r => r.json()),
      client.query({ query: `SELECT uniqExact(legislativedistrict) AS active_legis, 49 AS total_legis FROM ${TABLE} WHERE ${COHORT} FORMAT JSONEachRow` }).then(r => r.json()),
    ]);

    res.status(200).json({
      total_voters: voters[0].total_voters,
      new_regs: regs[0].new_regs,
      active_legis: legis[0].active_legis,
      total_legis: legis[0].total_legis
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
