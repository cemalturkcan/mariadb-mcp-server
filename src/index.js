#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { DbManager } from "./db.js";
import {
  validateReadQuery,
  validateWriteQuery,
  resolveRowLimit,
  buildLimitedQuery,
} from "./sqlGuard.js";
import { buildToolDefinitions, fail, ok } from "./tools.js";

const config = loadConfig();
const db = new DbManager(config);

const allConnections = db.getConnectionNames();
const readableConnections = db.getReadableConnections();
const writableConnections = db.getWritableConnections();

const server = new Server(
  { name: "mariadb-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: buildToolDefinitions(
    readableConnections,
    writableConnections,
    allConnections,
  ),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_connections": {
        const list = allConnections.map((connectionName) => {
          const c = db.getConnectionConfig(connectionName);
          return {
            name: connectionName,
            description: c.description,
            host: c.host,
            port: c.port,
            database: c.database,
            read: c.read,
            write: c.write,
            ...(c.statement_timeout_ms > 0 && {
              statement_timeout_ms: c.statement_timeout_ms,
            }),
            ...(c.default_row_limit > 0 && {
              default_row_limit: c.default_row_limit,
            }),
            ...(c.max_row_limit > 0 && { max_row_limit: c.max_row_limit }),
          };
        });
        return ok(list);
      }

      case "list_databases": {
        const connection = args?.connection;
        if (!connection) return fail("'connection' field is required.");
        const rows = await db.runReadOnly(connection, "SHOW DATABASES");
        return ok(rows);
      }

      case "list_tables": {
        const { connection, database } = args || {};
        if (!connection) return fail("'connection' field is required.");
        const sql = database
          ? `SHOW TABLES FROM \`${database}\``
          : "SHOW TABLES";
        const rows = await db.runReadOnly(connection, sql);
        return ok(rows);
      }

      case "describe_table": {
        const { connection, table, database } = args || {};
        if (!connection) return fail("'connection' field is required.");
        if (!table) return fail("'table' field is required.");
        const path = database ? `\`${database}\`.\`${table}\`` : `\`${table}\``;
        const rows = await db.runReadOnly(connection, `DESCRIBE ${path}`);
        return ok(rows);
      }

      case "execute_select": {
        const connection = args?.connection;
        const query = args?.query;
        const database = args?.database;
        const requestedRowLimit = args?.row_limit;

        if (!connection) return fail("'connection' field is required.");
        if (!query) return fail("'query' field is required.");

        const connectionConfig = db.getConnectionConfig(connection);
        const validatedQuery = validateReadQuery(query);

        const upper = validatedQuery.trim().toUpperCase();
        let finalQuery = validatedQuery;
        let appliedRowLimit = null;

        if (upper.startsWith("SELECT") || upper.startsWith("WITH")) {
          appliedRowLimit = resolveRowLimit(
            requestedRowLimit,
            connectionConfig,
          );
          if (appliedRowLimit !== null) {
            finalQuery = buildLimitedQuery(validatedQuery, appliedRowLimit);
          }
        }

        const rows = await db.runReadOnly(connection, finalQuery, { database });

        const result = {
          row_count: Array.isArray(rows) ? rows.length : 0,
          rows,
        };
        if (appliedRowLimit !== null) {
          result.row_limit = appliedRowLimit;
        }
        return ok(result);
      }

      case "execute_write": {
        const { connection, query } = args || {};
        if (!connection) return fail("'connection' field is required.");
        if (!query) return fail("'query' field is required.");

        const validatedQuery = validateWriteQuery(query);
        const meta = await db.runWrite(connection, validatedQuery);
        return ok({ success: true, meta });
      }

      case "execute_transaction": {
        const { connection, queries } = args || {};
        if (!connection) return fail("'connection' field is required.");
        if (!Array.isArray(queries) || queries.length === 0) {
          return fail("'queries' must be an array with at least one query.");
        }

        for (const q of queries) {
          validateWriteQuery(q);
        }

        const result = await db.runTransaction(connection, queries);
        return ok(result);
      }

      case "suggest_query": {
        const { connection, query, reason } = args || {};
        return ok({
          message: "MANUAL EXECUTION REQUIRED",
          connection,
          reason: reason || "Write operation",
          query,
        });
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Error: ${message}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Server failed to start: ${message}`);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await db.closeAll();
    process.exit(0);
  });
}
