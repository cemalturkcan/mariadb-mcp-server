# mariadb-mcp-server

MCP (Model Context Protocol) server for MariaDB/MySQL databases. Provides AI assistants with safe, controlled database access through per-connection read/write permissions.

## Features

- **Multi-connection** — manage multiple MariaDB/MySQL databases from a single server
- **Per-connection access control** — `read` and `write` flags per connection
- **Optional limits** — `statement_timeout_ms`, `default_row_limit`, `max_row_limit` (all optional, unlimited by default)
- **SQL guard** — validates queries to prevent accidental writes through read tools
- **Transaction support** — atomic multi-query execution on writable connections

## Installation

```bash
npm install -g mariadb-mcp-server
```

Or use directly with npx:

```bash
npx mariadb-mcp-server
```

## Configuration

Create a `config.json` next to the package (or set `DB_MCP_CONFIG_PATH` env var):

```json
{
  "connections": {
    "local": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "",
      "description": "Local MariaDB",
      "read": true,
      "write": true
    },
    "production": {
      "host": "db.example.com",
      "port": 3306,
      "user": "readonly_user",
      "password": "secret",
      "database": "mydb",
      "description": "Production (read-only)",
      "read": true,
      "write": false,
      "statement_timeout_ms": 5000,
      "default_row_limit": 50,
      "max_row_limit": 500
    }
  }
}
```

### Connection options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | `localhost` | Database host |
| `port` | number | `3306` | Database port |
| `user` | string | `root` | Database user |
| `password` | string | `""` | Database password |
| `database` | string | `""` | Default database |
| `description` | string | `""` | Human-readable label |
| `read` | boolean | `true` | Allow read queries |
| `write` | boolean | `false` | Allow write queries |
| `ssl` | boolean/object | `false` | SSL configuration |
| `statement_timeout_ms` | number | *none* | Connection timeout (0 or omit = unlimited) |
| `default_row_limit` | number | *none* | Default LIMIT for SELECT (0 or omit = unlimited) |
| `max_row_limit` | number | *none* | Max allowed LIMIT (0 or omit = unlimited) |

## MCP Tools

| Tool | Description | Requires |
|------|-------------|----------|
| `list_connections` | List all configured connections | — |
| `list_databases` | Show databases on a connection | `read` |
| `list_tables` | Show tables (optionally in a specific database) | `read` |
| `describe_table` | Show column definitions | `read` |
| `execute_select` | Run SELECT/SHOW/DESCRIBE/EXPLAIN queries | `read` |
| `execute_write` | Run INSERT/UPDATE/DELETE/DDL queries | `write` |
| `execute_transaction` | Run multiple write queries atomically | `write` |
| `suggest_query` | Suggest a query for manual review | — |

## Claude Desktop / MCP Client Setup

Add to your MCP client config:

```json
{
  "mcpServers": {
    "mariadb": {
      "command": "npx",
      "args": ["-y", "mariadb-mcp-server"],
      "env": {
        "DB_MCP_CONFIG_PATH": "/path/to/your/config.json"
      }
    }
  }
}
```

## License

MIT
