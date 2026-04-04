export function buildToolDefinitions(
  readableConnections,
  writableConnections,
  allConnections
) {
  const tools = [
    {
      name: "list_connections",
      description: "Lists configured MariaDB connections.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_databases",
      description: "Lists databases for the selected connection.",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", enum: readableConnections },
        },
        required: ["connection"],
      },
    },
    {
      name: "list_tables",
      description: "Lists tables for the selected connection.",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", enum: readableConnections },
          database: { type: "string" },
        },
        required: ["connection"],
      },
    },
    {
      name: "describe_table",
      description: "Returns column information for a table.",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", enum: readableConnections },
          table: { type: "string" },
          database: { type: "string" },
        },
        required: ["connection", "table"],
      },
    },
    {
      name: "execute_select",
      description:
        "Executes a read-only SELECT/SHOW/DESCRIBE/EXPLAIN query. Row limit is enforced.",
      inputSchema: {
        type: "object",
        properties: {
          connection: { type: "string", enum: readableConnections },
          query: { type: "string" },
          database: { type: "string" },
          row_limit: { type: "number" },
        },
        required: ["connection", "query"],
      },
    },
  ];

  if (writableConnections.length > 0) {
    tools.push(
      {
        name: "execute_write",
        description: `Executes a write query (INSERT/UPDATE/DELETE/CREATE/ALTER/DROP etc.). Connections: ${writableConnections.join(", ")}`,
        inputSchema: {
          type: "object",
          properties: {
            connection: { type: "string", enum: writableConnections },
            query: { type: "string" },
          },
          required: ["connection", "query"],
        },
      },
      {
        name: "execute_transaction",
        description: `Executes multiple write queries within a transaction. Connections: ${writableConnections.join(", ")}`,
        inputSchema: {
          type: "object",
          properties: {
            connection: { type: "string", enum: writableConnections },
            queries: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
          required: ["connection", "queries"],
        },
      }
    );
  }

  tools.push({
    name: "suggest_query",
    description: "Suggests a query that should be executed manually.",
    inputSchema: {
      type: "object",
      properties: {
        connection: { type: "string" },
        query: { type: "string" },
        reason: { type: "string" },
      },
      required: ["connection", "query"],
    },
  });

  return tools;
}

export function ok(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          payload,
          (key, value) => (typeof value === "bigint" ? Number(value) : value),
          2
        ),
      },
    ],
  };
}

export function fail(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
