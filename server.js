const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// --- DB bootstrap (Postgres si hay DATABASE_URL; sino SQLite local) ---
const usePg = !!process.env.DATABASE_URL;
let pool, db;

if (usePg) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  // Migración mínima
  pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id   SERIAL PRIMARY KEY,
      text TEXT    NOT NULL,
      done BOOLEAN NOT NULL DEFAULT false
    );
  `).catch(err => console.error("PG init error:", err));
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
}

// --- API ---
app.get("/api/todos", async (req, res) => {
  try {
    if (usePg) {
      const { rows } = await pool.query("SELECT id, text, done FROM todos ORDER BY id DESC");
      return res.json(rows);
    }
    const rows = db.prepare("SELECT id, text, done FROM todos ORDER BY id DESC").all()
      .map(r => ({ id: r.id, text: r.text, done: !!r.done }));
    res.json(rows);
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
    res.json({ id: info.lastInsertRowid, text, done: false });
  } catch (e) { res.status(500).json({ error: "db_post", detail: e.message }); }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (usePg) {
      await pool.query("UPDATE todos SET done = NOT done WHERE id = $1", [id]);
      return res.json({ success: true });
    }
    db.prepare("UPDATE todos SET done = CASE WHEN done=1 THEN 0 ELSE 1 END WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "db_put", detail: e.message }); }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (usePg) {
      await pool.query("DELETE FROM todos WHERE id = $1", [id]);
      return res.json({ success: true });
    }
    db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "db_delete", detail: e.message }); }
});

// --- FRONTEND compilado + fallback SPA (Express 5 compatible) ---
const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));
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
