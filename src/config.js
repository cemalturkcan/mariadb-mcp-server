import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toNonNegativeInt(value) {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeConnection(connection) {
  return {
    host: connection.host || "localhost",
    port: toPositiveInt(connection.port, 3306),
    user: connection.user || "root",
    password: connection.password || "",
    database: connection.database || "",
    description: connection.description || "",
    read: connection.read !== false,
    write: connection.write === true,
    statement_timeout_ms: toNonNegativeInt(connection.statement_timeout_ms),
    default_row_limit: toNonNegativeInt(connection.default_row_limit),
    max_row_limit: toNonNegativeInt(connection.max_row_limit),
    ssl: connection.ssl || false,
  };
}

const DEFAULT_CONFIG = {
  connections: {
    local: {
      host: "localhost",
      port: 3306,
      user: "root",
      password: "",
      database: "",
      description: "Local MariaDB",
      read: true,
      write: false,
    },
  },
};

function getXdgConfigPath() {
  const xdgBase = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgBase, "mariadb-mcp", "config.json");
}

function createDefaultConfig(configPath) {
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
    "utf8",
  );
  process.stderr.write(
    `[mariadb-mcp] Created default config at ${configPath}\n`,
  );
  return DEFAULT_CONFIG;
}

export function loadConfig() {
  const xdgPath = getXdgConfigPath();

  const candidates = [
    process.env.DB_MCP_CONFIG_PATH,
    join(__dirname, "../config.json"),
    join(process.cwd(), "config.json"),
    xdgPath,
  ].filter(Boolean);

  let rawConfig;
  for (const configPath of candidates) {
    if (existsSync(configPath)) {
      rawConfig = JSON.parse(readFileSync(configPath, "utf8"));
      break;
    }
  }

  if (!rawConfig) {
    rawConfig = createDefaultConfig(xdgPath);
  }

  const raw = rawConfig.connections || rawConfig.databases;
  if (!raw || typeof raw !== "object") {
    throw new Error(
      "config.json icinde 'connections' (veya eski format 'databases') nesnesi olmalidir.",
    );
  }

  const entries = Object.entries(raw);
  if (entries.length === 0) {
    throw new Error("En az bir baglanti tanimlamalisiniz.");
  }

  const connections = {};
  for (const [name, connection] of entries) {
    if (!connection || typeof connection !== "object") {
      throw new Error(`'${name}' baglantisi gecersiz.`);
    }

    const normalized = normalizeConnection(connection);

    if (
      normalized.default_row_limit > 0 &&
      normalized.max_row_limit > 0 &&
      normalized.default_row_limit > normalized.max_row_limit
    ) {
      throw new Error(
        `'${name}' icin default_row_limit, max_row_limit degerinden buyuk olamaz.`,
      );
    }

    connections[name] = normalized;
  }

  return { connections };
}
