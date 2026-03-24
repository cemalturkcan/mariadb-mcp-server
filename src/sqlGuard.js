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
    throw new Error("Sorgu metin (string) olmalidir.");
  }

  const query = rawQuery.trim();
  if (!query) {
    throw new Error("Sorgu bos olamaz.");
  }

  if (!isReadQuery(query)) {
    throw new Error(
      "Yalnizca SELECT/SHOW/DESCRIBE/EXPLAIN sorgularina izin verilir."
    );
  }

  return query;
}

export function validateWriteQuery(rawQuery) {
  if (typeof rawQuery !== "string") {
    throw new Error("Sorgu metin (string) olmalidir.");
  }

  const query = rawQuery.trim();
  if (!query) {
    throw new Error("Sorgu bos olamaz.");
  }

  if (isReadQuery(query)) {
    throw new Error(
      "Read-only sorgular (SELECT/SHOW/DESCRIBE/EXPLAIN) execute_write'da kullanilamaz. execute_select kullanin."
    );
  }

  if (!isWriteQuery(query)) {
    throw new Error(
      `Sorgu gecerli bir yazma islemi olarak taninamadi. Izin verilen: ${WRITE_PREFIXES.join(", ")}`
    );
  }

  return query;
}

/**
 * Resolves the effective row limit for a query.
 * Returns null when no limit should be applied.
 *
 * - Config'de default_row_limit / max_row_limit yoksa (0) → sinirsiz
 * - Kullanici row_limit verdiyse ve max_row_limit varsa → min(request, max) uygulanir
 * - Kullanici row_limit vermediyse ama default_row_limit varsa → default uygulanir
 */
export function resolveRowLimit(requestedRowLimit, connectionConfig) {
  const defaultLimit = connectionConfig.default_row_limit || 0;
  const maxLimit = connectionConfig.max_row_limit || 0;

  if (requestedRowLimit != null) {
    const n = Number(requestedRowLimit);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("row_limit pozitif bir sayi olmalidir.");
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
