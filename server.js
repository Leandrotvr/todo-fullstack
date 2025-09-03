const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let todos = [];

// --- API ---
app.get("/api/todos", (req, res) => res.json(todos));
app.post("/api/todos", (req, res) => {
  const text = (req.body?.text || "").toString().trim();
  if (!text) return res.status(400).json({ error: "text requerido" });
  const newTodo = { id: Date.now(), text, done: false };
  todos.push(newTodo);
  res.json(newTodo);
});
app.put("/api/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  todos = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
  res.json({ success: true });
});
app.delete("/api/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  todos = todos.filter(t => t.id !== id);
  res.json({ success: true });
});

// --- FRONTEND compilado ---
const distPath = path.join(__dirname, "client", "dist");
app.use(express.static(distPath));

// Fallback SPA sin comodines (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(distPath, "index.html"));
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor único en http://localhost:${PORT}`));
