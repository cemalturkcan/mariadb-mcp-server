export function buildToolDefinitions(
  readableConnections,
  writableConnections,
  allConnections
) {
  const tools = [
    {
      name: "list_connections",
      description: "Tanimli MariaDB baglantilarini listeler.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_databases",
      description: "Secilen baglantidaki veritabanlarini listeler.",
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
      description: "Secilen baglantida tablolari listeler.",
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
      description: "Bir tablonun kolon bilgilerini dondurur.",
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
        "Salt-okunur SELECT/SHOW/DESCRIBE/EXPLAIN sorgusu calistirir. Satir limiti uygulanir.",
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
        description: `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP vb. yazma sorgusu calistirir. Baglantilar: ${writableConnections.join(", ")}`,
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
        description: `Birden fazla yazma sorgusunu transaction icinde calistirir. Baglantilar: ${writableConnections.join(", ")}`,
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
    description: "Manuel calistirilmasi gereken bir sorgu onerir.",
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
