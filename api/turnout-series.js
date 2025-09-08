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

    const response = await fetch(`${process.env.CLICKHOUSE_URL}/?database=default&default_format=JSONEachRow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: query,
      // ClickHouse Cloud needs Basic Auth
      // format: user:password in Authorization header
      // or pass ?user=...&password=...
      // safer way:
      headers: {
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}`
        ).toString('base64'),
      }
    });

    if (!response.ok) {
      throw new Error(`ClickHouse error: ${response.status} ${response.statusText}`);
    }

    const rows = await response.json();

    res.status(200).json({
      labels: rows.map(r => r.label),
      data: rows.map(r => Number(r.pct)),
    });
  } catch (err) {
    console.error('ClickHouse proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}
