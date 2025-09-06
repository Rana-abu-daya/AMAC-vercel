// /api/_ch.ts
export const config = { runtime: 'edge' };

import { createClient } from '@clickhouse/client-web';

export function ch() {
  return createClient({
    host:    process.env.CLICKHOUSE_HOST!,   // e.g. https://<cluster>.clickhouse.cloud:8443
    username:process.env.CLICKHOUSE_USER!,
    password:process.env.CLICKHOUSE_PASS!,
    database:process.env.CLICKHOUSE_DB,      // optional
  });
}

/** Common WHERE predicate for your Muslim/Revert cohort */
export const TARGET_WHERE = `
  multiSearchAny(lower(llama_names), ['muslim','revert'])

`;
