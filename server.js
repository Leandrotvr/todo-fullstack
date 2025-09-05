const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");

const app = express();
app.set("trust proxy", 1);              // necesario en Render para rate limit por IP
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json());

// ===== CORS =====
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN; // si no existe, es dev/local
if (ALLOWED_ORIGIN && ALLOWED_ORIGIN !== "*") {
  app.use(cors({ origin: ALLOWED_ORIGIN, methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] }));
} else {
  app.use(cors()); // dev: abierto
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
        done BOOLEAN NOT NULL DEFAULT false
      );
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
        done INTEGER NOT NULL DEFAULT 0
      );
    `);
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
      const { rows } = await pool.query("SELECT id, text, done FROM todos ORDER BY id DESC");
      return res.json(rows);
    }
    const rows = db.prepare("SELECT id, text, done FROM todos ORDER BY id DESC").all()
      .map(r => ({ id: r.id, text: r.text, done: !!r.done }));
    return res.json(rows);
  } catch (e) { res.status(500).json({ error: "db_get", detail: e.message }); }
});

app.post("/api/todos", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString().trim();
    if (!text) return res.status(400).json({ error: "text requerido" });
    if (usePg) {
      const { rows } = await pool.query("INSERT INTO todos (text, done) VALUES ($1, false) RETURNING id, text, done", [text]);
      return res.json(rows[0]);
    }
    const info = db.prepare("INSERT INTO todos (text, done) VALUES (?, 0)").run(text);
    return res.json({ id: info.lastInsertRowid, text, done: false });
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
      const { rows } = await pool.query("UPDATE todos SET text = $1 WHERE id = $2 RETURNING id, text, done", [text, id]);
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      return res.json(rows[0]);
    } else {
      const r = db.prepare("UPDATE todos SET text = ? WHERE id = ?").run(text, id);
      if (!r.changes) return res.status(404).json({ error: "not_found" });
      const row = db.prepare("SELECT id, text, done FROM todos WHERE id = ?").get(id);
      return res.json({ id: row.id, text: row.text, done: !!row.done });
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

// ===== FRONTEND: estáticos + caché =====
const distPath = path.join(__dirname, "client", "dist");
// Cache agresiva para assets con hash; no-cache para index.html
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

// Fallback SPA compatible con Express 5 (sin wildcard)
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
