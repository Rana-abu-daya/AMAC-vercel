// api/turnout-series.js
export default async function handler(req, res) {
  try {
    const query = `
      SELECT * FROM (
        SELECT 'Aug 2024' AS label,
               round(100 * countIf(lower(Aug_2024_Status) = 'voted') / count(), 0) AS pct
        FROM silver_sos_2024_09_voters_llama2_3_4
        WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
        UNION ALL
        SELECT 'Nov 2024' AS label,
               round(100 * countIf(lower(ballot_status) = 'accepted') / count(), 0) AS pct
        FROM silver_sos_2024_09_voters_llama2_3_4
        WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
      )
      ORDER BY label
    `;

    const response = await fetch(process.env.CLICKHOUSE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        user: process.env.CLICKHOUSE_USER,
        password: process.env.CLICKHOUSE_PASSWORD,
        format: 'JSONEachRow',
      }),
    });

    if (!response.ok) {
      throw new Error(`ClickHouse error: ${response.statusText}`);
    }

    const rows = await response.json();

    res.status(200).json({
      labels: rows.map(r => r.label),
      data: rows.map(r => Number(r.pct)),
    });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}
