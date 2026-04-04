const READ_PREFIXES = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"];

const WRITE_PREFIXES = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "REPLACE",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "RENAME",
  "SET",
  "START TRANSACTION",
  "COMMIT",
  "ROLLBACK",
];

export function isReadQuery(sql) {
  const t = sql.trim().toUpperCase();
  return READ_PREFIXES.some((p) => t.startsWith(p));
}

export function isWriteQuery(sql) {
  const t = sql.trim().toUpperCase();
  return WRITE_PREFIXES.some((p) => t.startsWith(p));
}

export function validateReadQuery(rawQuery) {
  if (typeof rawQuery !== "string") {
    throw new Error("Query must be a string.");
  }

  const query = rawQuery.trim();
  if (!query) {
    throw new Error("Query must not be empty.");
  }

  if (!isReadQuery(query)) {
    throw new Error(
      "Only SELECT/SHOW/DESCRIBE/EXPLAIN queries are allowed."
    );
  }

  return query;
}

export function validateWriteQuery(rawQuery) {
  if (typeof rawQuery !== "string") {
    throw new Error("Query must be a string.");
  }

  const query = rawQuery.trim();
  if (!query) {
    throw new Error("Query must not be empty.");
  }

  if (isReadQuery(query)) {
    throw new Error(
      "Read-only queries (SELECT/SHOW/DESCRIBE/EXPLAIN) cannot be used with execute_write. Use execute_select instead."
    );
  }

  if (!isWriteQuery(query)) {
    throw new Error(
      `Query was not recognized as a valid write operation. Allowed prefixes: ${WRITE_PREFIXES.join(", ")}`
    );
  }

  return query;
}

/**
 * Resolves the effective row limit for a query.
 * Returns null when no limit should be applied.
 *
 * - If default_row_limit / max_row_limit are absent (0) → unlimited
 * - If the caller provides row_limit and max_row_limit is set → min(requested, max) is used
 * - If the caller omits row_limit but default_row_limit is set → default is used
 */
export function resolveRowLimit(requestedRowLimit, connectionConfig) {
  const defaultLimit = connectionConfig.default_row_limit || 0;
  const maxLimit = connectionConfig.max_row_limit || 0;

  if (requestedRowLimit != null) {
    const n = Number(requestedRowLimit);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("row_limit must be a positive number.");
    }
    const chosen = Math.floor(n);
    return maxLimit > 0 ? Math.min(chosen, maxLimit) : chosen;
  }

  if (defaultLimit > 0) {
    return maxLimit > 0 ? Math.min(defaultLimit, maxLimit) : defaultLimit;
  }

  return null;
}

export function buildLimitedQuery(query, rowLimit) {
  return `SELECT * FROM (${query}) AS mcp_query LIMIT ${rowLimit}`;
}
