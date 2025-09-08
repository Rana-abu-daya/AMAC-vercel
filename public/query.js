// api/query.js
import { ClickHouse } from '@clickhouse/client';

export default async function handler(req, res) {
  try {
    const client = new ClickHouse({
      host: process.env.CLICKHOUSE_HOST,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
    });

    // Example: get total registered voters
    const query = `
      SELECT count(*) AS total
      FROM silver_sos_2024_09_voters_llama2_3_4
      WHERE multiSearchAny(lower(llama_names), ['muslim','revert'])
    `;

    const resultSet = await client.query({ query });
    const dataset = await resultSet.json();

    res.status(200).json(dataset.data[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
