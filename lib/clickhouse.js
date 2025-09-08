import { createClient } from '@clickhouse/client';

export const clickhouse = createClient({
  host: process.env.CLICKHOUSE_URL,   // https://pod38uxp1w.us-west-2.aws.clickhouse.cloud:8443
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD,
  // Vercel serverless requires HTTPS
  tls: {}, // leave empty for default secure connection
});
