import 'server-only';

import postgres from 'postgres';

let client: ReturnType<typeof postgres> | undefined;

export default function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  if (!client) {
    client = postgres(connectionString, {
      connect_timeout: 10,
      idle_timeout: 20,
      max: 2,
      prepare: false,
    });
  }
  return client;
}
