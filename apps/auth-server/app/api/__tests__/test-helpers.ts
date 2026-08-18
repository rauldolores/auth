import { vi } from "vitest";

/**
 * A minimal stand-in for supabase-js's PostgrestFilterBuilder: every chain
 * method (`select`, `eq`, `order`, `range`, `is`, `single`, `maybeSingle`,
 * `insert`, `update`, `upsert`, `delete`, `returns`, ...) just returns the
 * same object so `caller.schema(...).from(...).select(...).eq(...).order(...)`
 * chains of any shape/length resolve. The object is itself thenable (like
 * the real builder), so `await` / destructuring `{ data, error }` or
 * `{ count }` off it resolves to whatever canned `result` this builder was
 * built with — the chain calls in between are for readability/call
 * assertions only, they don't affect what gets returned.
 */
export function makeThenableBuilder(result: unknown) {
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "is",
    "in",
    "or",
    "gte",
    "lte",
    "order",
    "range",
    "single",
    "maybeSingle",
    "insert",
    "update",
    "upsert",
    "delete",
    "returns",
  ] as const;

  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

/**
 * Fakes the `.schema("kontrolia_auth").from(table)...` entry point shared by
 * every Supabase client in this codebase (the caller-scoped client built by
 * scopedClient()/createRouteHandlerSupabaseClient(), and the service-role
 * admin client). `tableResponses[table]` is a FIFO queue: each `.from(table)`
 * call pops the next canned `{data, error}` (or `{count}`) result for that
 * table, so a single request that queries the same table twice for two
 * different purposes (e.g. a SELECT then an UPDATE) can be scripted with two
 * queued results in call order.
 */
export function makeSchemaClient(tableResponses: Record<string, unknown[]>) {
  const queues = new Map(Object.entries(tableResponses).map(([table, results]) => [table, [...results]]));
  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    const result = queue?.shift() ?? { data: null, error: null };
    return makeThenableBuilder(result);
  });
  return {
    schema: vi.fn(() => ({ from })),
    from,
  };
}

/** Builds a fake admin client: `.schema().from()` table access plus `.auth.admin.listUsers()` and (optionally) `.storage.from(bucket)`. */
export function makeAdminClient(
  tableResponses: Record<string, unknown[]> = {},
  listUsersResult: {
    data: { users: { id: string; email: string; user_metadata?: Record<string, unknown> }[] } | null;
    error: unknown;
  } = {
    data: { users: [] },
    error: null,
  },
  storageFrom?: (bucket: string) => unknown,
) {
  const schemaClient = makeSchemaClient(tableResponses);
  return {
    ...schemaClient,
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue(listUsersResult),
      },
    },
    storage: {
      from: vi.fn((bucket: string) => storageFrom?.(bucket) ?? {}),
    },
  };
}
