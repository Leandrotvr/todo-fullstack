const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());

// ===== CORS =====
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
if (ALLOWED_ORIGIN && ALLOWED_ORIGIN !== "*") {
  app.use(cors({ origin: ALLOWED_ORIGIN, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] }));
} else {
  app.use(cors()); // dev
}

// ===== Rate limit solo para API =====
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", limiter);

// ===== DB: Postgres si hay DATABASE_URL; sino SQLite local =====
const usePg = !!process.env.DATABASE_URL;
let pool, db;

(async () => {
  if (usePg) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id   SERIAL PRIMARY KEY,
        text TEXT    NOT NULL,
        done BOOLEAN NOT NULL DEFAULT false,
        ord  INTEGER
      );
    `);
    // Asegurar 'ord' poblado
    await pool.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(ord, 2147483647), id) AS rn
        FROM todos
      )
      UPDATE todos t SET ord = ranked.rn
      FROM ranked WHERE ranked.id = t.id AND (t.ord IS NULL OR t.ord < 1);
    `);
    console.log("DB: Postgres listo.");
  } else {
    const fs = require("fs");
    const Database = require("better-sqlite3");
    const localDbPath = path.join(__dirname, "data", "todos.db");
    fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
    db = new Database(localDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT    NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        ord  INTEGER
      );
    `);
    // Asegurar 'ord' poblado
    const rows = db.prepare("SELECT id, ord FROM todos ORDER BY COALESCE(ord, 99999999), id").all();
    const tx = db.transaction((items) => {
      const upd = db.prepare("UPDATE todos SET ord = ? WHERE id = ?");
      let i = 1;
      for (const r of items) { if (!r.ord || r.ord < 1) upd.run(i++, r.id); }
    });
    tx(rows);
    console.log("DB: SQLite local lista en", path.join(__dirname, "data", "todos.db"));
  }
})().catch(err => console.error("Error inicializando DB:", err));

// ===== HEALTHCHECK =====
app.get("/health", async (req, res) => {
  try {
    if (usePg) { await pool.query("SELECT 1"); }
    else { db.prepare("SELECT 1").get(); }
    res.json({ ok: true, db: usePg ? "pg" : "sqlite" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== API =====
app.get("/api/todos", async (req, res) => {
  try {
    if (usePg) {
      const { rows } = await pool.query("SELECT id, text, done, ord FROM todos ORDER BY ord ASC, id ASC");
      return res.json(rows);
    }
    const rows = db.prepare("SELECT id, text, done, ord FROM todos ORDER BY ord ASC, id ASC").all()
      .map(r => ({ id: r.id, text: r.text, done: !!r.done, ord: r.ord }));
    return res.json(rows);
  } catch (e) { res.status(500).json({ error: "db_get", detail: e.message }); }
});

app.post("/api/todos", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ error: "text requerido" });
    if (usePg) {
      const { rows } = await pool.query(`
        INSERT INTO todos (text, done, ord)
        VALUES ($1, false, COALESCE((SELECT MAX(ord) FROM todos), 0) + 1)
        RETURNING id, text, done, ord
      `, [text]);
      return res.json(rows[0]);
    }
    const max = db.prepare("SELECT COALESCE(MAX(ord),0) AS m FROM todos").get().m;
    const info = db.prepare("INSERT INTO todos (text, done, ord) VALUES (?, 0, ?)").run(text, max + 1);
    return res.json({ id: info.lastInsertRowid, text, done: false, ord: max + 1 });
  } catch (e) { res.status(500).json({ error: "db_post", detail: e.message }); }
});

// Toggle done
app.put("/api/todos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (usePg) await pool.query("UPDATE todos SET done = NOT done WHERE id = $1", [id]);
    else db.prepare("UPDATE todos SET done = CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "db_put_toggle", detail: e.message }); }
});

// Editar texto
app.patch("/api/todos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ error: "text requerido" });
    if (usePg) {
      const { rows } = await pool.query("UPDATE todos SET text = $1 WHERE id = $2 RETURNING id, text, done, ord", [text, id]);
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      return res.json(rows[0]);
    } else {
      const r = db.prepare("UPDATE todos SET text = ? WHERE id = ?").run(text, id);
      if (!r.changes) return res.status(404).json({ error: "not_found" });
      const row = db.prepare("SELECT id, text, done, ord FROM todos WHERE id = ?").get(id);
      return res.json({ id: row.id, text: row.text, done: !!row.done, ord: row.ord });
    }
  } catch (e) { res.status(500).json({ error: "db_patch_text", detail: e.message }); }
});

// Borrar una
app.delete("/api/todos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (usePg) await pool.query("DELETE FROM todos WHERE id = $1", [id]);
    else db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "db_delete_one", detail: e.message }); }
});

// Borrar completadas
app.delete("/api/todos/completed", async (req, res) => {
  try {
    if (usePg) await pool.query("DELETE FROM todos WHERE done = TRUE");
    else db.prepare("DELETE FROM todos WHERE done = 1").run();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "db_delete_completed", detail: e.message }); }
});

// Reordenar (DnD) -> { ids: [id1, id2, ...] } asigna ord = 1..n
app.patch("/api/todos/reorder", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isInteger(n)) : [];
    if (!ids.length) return res.status(400).json({ error: "ids requerido" });
    if (usePg) {
      await pool.query("BEGIN");
      for (let i = 0; i < ids.length; i++) {
        await pool.query("UPDATE todos SET ord = $1 WHERE id = $2", [i + 1, ids[i]]);
      }
      await pool.query("COMMIT");
    } else {
      const tx = db.transaction((list) => {
        const upd = db.prepare("UPDATE todos SET ord = ? WHERE id = ?");
        list.forEach((id, i) => upd.run(i + 1, id));
      });
      tx(ids);
    }
    res.json({ success: true });
  } catch (e) {
    if (usePg) await pool.query("ROLLBACK").catch(()=>{});
    res.status(500).json({ error: "db_reorder", detail: e.message });
  }
});

// ===== FRONTEND: estáticos + caché =====
const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath, {
  maxAge: "1y",
  setHeaders: (res, p) => {
    if (p.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (p.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

// Fallback SPA (Express 5)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(distPath, "index.html"));
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Servidor único en http://localhost:${PORT} (DB: ${usePg ? "Postgres" : "SQLite"})`)
);
