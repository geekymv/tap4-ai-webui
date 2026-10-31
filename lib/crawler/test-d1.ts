import type { D1DatabaseClient } from '../../db/d1';

type Handler = (query: string, values: unknown[]) => unknown;

export default function createTestDatabase(handler: Handler) {
  const queries: Array<{ query: string; values: unknown[] }> = [];
  class Statement {
    values: unknown[] = [];

    constructor(readonly query: string) {}

    bind(...values: unknown[]) {
      this.values = values;
      return this;
    }

    execute() {
      queries.push({ query: this.query, values: this.values });
      return handler(this.query, this.values);
    }

    async all<T>() {
      return { results: (this.execute() || []) as T[] };
    }

    async first<T>() {
      const rows = (this.execute() || []) as T[];
      return rows[0] || null;
    }

    async run() {
      const value = this.execute() as { changes?: number; results?: unknown[] } | undefined;
      return {
        success: true,
        results: value?.results || [],
        meta: { changes: value?.changes ?? 1 },
      };
    }
  }

  const database = {
    prepare: (query: string) => new Statement(query),
    batch: async (statements: Statement[]) =>
      Promise.all(
        statements.map(async (statement) => {
          const value = statement.execute() as { changes?: number; results?: unknown[] } | unknown[] | undefined;
          return {
            success: true,
            results: Array.isArray(value) ? value : value?.results || [],
            meta: { changes: Array.isArray(value) ? 1 : value?.changes ?? 1 },
          };
        }),
      ),
  } as unknown as D1DatabaseClient;
  return { database, queries };
}
