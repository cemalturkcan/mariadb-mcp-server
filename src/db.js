import { createPool } from "mariadb";

export class DbManager {
  constructor(config) {
    this.config = config;
    this.pools = new Map();
  }

  getConnectionNames() {
    return Object.keys(this.config.connections);
  }

  getReadableConnections() {
    return this.getConnectionNames().filter(
      (name) => this.config.connections[name].read,
    );
  }

  getWritableConnections() {
    return this.getConnectionNames().filter(
      (name) => this.config.connections[name].write,
    );
  }

  getConnectionConfig(name) {
    const cfg = this.config.connections[name];
    if (!cfg) {
      const available = this.getConnectionNames().join(", ");
      throw new Error(
        `Baglanti bulunamadi: '${name}'. Mevcut baglantilar: ${available}`,
      );
    }
    return cfg;
  }

  getPool(name, databaseOverride = null) {
    const c = this.getConnectionConfig(name);
    const database = databaseOverride || c.database;
    const poolKey = `${name}::${database}`;

    if (!this.pools.has(poolKey)) {
      const poolOptions = {
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
        database: database || undefined,
        connectionLimit: 5,
        insertIdAsNumber: true,
        bigIntAsNumber: true,
      };

      if (c.statement_timeout_ms > 0) {
        poolOptions.connectTimeout = c.statement_timeout_ms;
      }

      if (c.ssl) {
        poolOptions.ssl =
          typeof c.ssl === "object" ? c.ssl : { rejectUnauthorized: false };
      }

      this.pools.set(poolKey, createPool(poolOptions));
    }

    return this.pools.get(poolKey);
  }

  assertReadable(connectionName) {
    const cfg = this.getConnectionConfig(connectionName);
    if (!cfg.read) {
      throw new Error(
        `'${connectionName}' baglantisi read (okuma) izni vermiyor.`,
      );
    }
  }

  assertWritable(connectionName) {
    const cfg = this.getConnectionConfig(connectionName);
    if (!cfg.write) {
      throw new Error(
        `'${connectionName}' baglantisi write (yazma) izni vermiyor.`,
      );
    }
  }

  async runReadOnly(connectionName, sql, options = {}) {
    this.assertReadable(connectionName);
    const database = options.database || null;
    const conn = await this.getPool(connectionName, database).getConnection();
    try {
      return await conn.query(sql);
    } finally {
      conn.release();
    }
  }

  async runWrite(connectionName, sql, options = {}) {
    this.assertWritable(connectionName);
    const database = options.database || null;
    const conn = await this.getPool(connectionName, database).getConnection();
    try {
      const result = await conn.query(sql);
      return {
        affectedRows: result.affectedRows,
        insertId: result.insertId,
        warningStatus: result.warningStatus,
      };
    } finally {
      conn.release();
    }
  }

  async runTransaction(connectionName, queries, options = {}) {
    this.assertWritable(connectionName);
    const database = options.database || null;
    const conn = await this.getPool(connectionName, database).getConnection();
    try {
      await conn.beginTransaction();
      const results = [];
      for (const q of queries) {
        const r = await conn.query(q);
        results.push({
          query: q.substring(0, 100),
          affectedRows: r.affectedRows,
          insertId: r.insertId,
        });
      }
      await conn.commit();
      return { committed: true, results };
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        /* asil hatayi koruyoruz */
      }
      throw new Error(
        `Transaction basarisiz, rollback yapildi: ${error.message}`,
      );
    } finally {
      conn.release();
    }
  }

  async closeAll() {
    const tasks = [];
    for (const pool of this.pools.values()) {
      tasks.push(pool.end());
    }
    await Promise.all(tasks);
  }
}
