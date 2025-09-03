import { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function App() {
  const whatsapp = "5493777416857";
  const waHref = `https://wa.me/${whatsapp}?text=Hola%20Leandro%2C%20vi%20tu%20CV%20web`;

  const cv = {
    nombre: "Leandro Maciel",
    titular: "Asistente Virtual · Soporte al Cliente · Data Entry",
    ubicacion: "Mercedes, Corrientes — Argentina",
    email: "leandrotvr@gmail.com",
    perfil:
      "Docente en Geografía y Ciencias Sociales con experiencia en gestión de grupos y producción de materiales digitales. Orientado a asistencia virtual, soporte al cliente, data entry y redacción. Comunicación clara, organización y aprendizaje continuo.",
    competencias: [
      "Comunicación clara","Gestión del tiempo","Atención al cliente",
      "Redacción y edición","Trabajo remoto","Autonomía","Trabajo en equipo",
      "Google Workspace · Microsoft Office · Sheets/Excel · Trello · Notion · Slack · Zoom",
    ],
    potencial: [
      "Asistente Virtual (ES/EN): correo, agenda, coordinación y reportes",
      "Customer Support (chat/email)",
      "Data Entry / Data Ops en planillas y CRMs",
      "QA Manual junior (pruebas funcionales, reporte de bugs)",
      "Soporte técnico básico (software y cuentas)",
      "Docencia/tutorías online (Geografía y Cs. Sociales)",
      "Redacción y estandarización de plantillas/procesos",
    ],
    proyectos: [{ t: "To-Do List (Live)", url: "https://todo-fullstack-30wd.onrender.com/" }],
  };

  // ====== TODO LIST ======
  const [todos, setTodos] = useState([]);
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    axios.get("/api/todos").then(res => setTodos(res.data));
  }, []);

  const addTodo = () => {
    const v = text.trim();
    if (!v) return;
    axios.post("/api/todos", { text: v }).then(res => {
      setTodos(prev => [...prev, res.data]);
      setText("");
      inputRef.current?.focus();
    });
  };
  const toggleTodo = (id) => {
    axios.put(`/api/todos/${id}`).then(() => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    });
  };
  const deleteTodo = (id) => {
    axios.delete(`/api/todos/${id}`).then(() => {
      setTodos(prev => prev.filter(t => t.id !== id));
    });
  };

  // ====== ESTILOS (inline para UI; CSS @media print los sobreescribe) ======
  const s = {
    page: { minHeight: "100vh", margin: 0, background: "#121212", color: "#eee", fontFamily: "system-ui, sans-serif" },
    wrap: { maxWidth: 1000, margin: "0 auto", padding: 20, display: "grid", gridTemplateColumns: "1fr", gap: 16 },
    h2: { fontSize: 20, margin: "0 0 10px 0", borderBottom: "1px solid #2a2a2a", paddingBottom: 6 },
    small: { color: "#aaa", fontSize: 14 },
    card: { background: "#1b1b1b", border: "1px solid #2a2a2a", borderRadius: 14, padding: 16 },
    row: { display: "flex", gap: 8, marginTop: 10, marginBottom: 10 },
    input: { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #444", background: "#2a2a2a", color: "#eee" },
    btn: { padding: "10px 16px", borderRadius: 8, border: "1px solid #555", background: "#333", color: "#fff", cursor: "pointer" },
    ul: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 },
    li: { display: "flex", alignItems: "center", gap: 8, background: "#202020", border: "1px solid #323232", borderRadius: 10, padding: "10px 12px" },
    todoText: done => ({ flex: 1, cursor: "pointer", textDecoration: done ? "line-through" : "none", color: done ? "#aaa" : "#fff" }),
    del: { padding: "6px 10px", borderRadius: 8, border: "1px solid #7a2b2b", background: "#b43b3b", color: "#fff", cursor: "pointer" },
    banner: { background: "#1b1b1b", border: "1px solid #2a2a2a", borderRadius: 14, padding: 16 },
    name: { fontSize: 28, fontWeight: 800, margin: 0 },
    sub: { margin: "4px 0 8px 0", color: "#c8c8c8" },
    meta: { margin: 0, color: "#bdbdbd" },
    link: { color: "#7db7ff", textDecoration: "none" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    list: { margin: 0, paddingLeft: 18 }
  };

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* ====== TODO LIST PRIMERO ====== */}
        <section className="pdf-card" style={s.card}>
          <h2 style={s.h2}>Mis tareas (To-Do List)</h2>
          <p style={s.small}>
            <strong>Hecha con:</strong> React + Vite (frontend), Node.js + Express (backend), Axios, API REST (JSON), CORS.{" "}
            <strong>Competencias:</strong> CRUD, hooks (useState/useEffect/useRef), asincronía (promesas), validaciones básicas, SPA y build de producción.
          </p>

          {/* Ocultamos el formulario al imprimir */}
          <form className="hide-print" onSubmit={(e) => { e.preventDefault(); addTodo(); }} style={s.row}>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Nueva tarea..."
              maxLength={120}
              style={s.input}
            />
            <button type="submit" style={s.btn} disabled={!text.trim()}>
              Agregar
            </button>
          </form>

          <ul style={s.ul}>
            {todos.map(t => (
              <li key={t.id} style={s.li}>
                <span
                  className="pdf-task"
                  style={s.todoText(t.done)}
                  onClick={() => toggleTodo(t.id)}
                  title="Marcar / desmarcar"
                >
                  {t.text}
                </span>
                {/* Ocultamos controles de eliminar al imprimir */}
                <button className="hide-print" onClick={() => deleteTodo(t.id)} style={s.del} title="Eliminar">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ====== BANNER CV ====== */}
        <section className="pdf-card" style={s.banner}>
          <h1 style={s.name}>{cv.nombre}</h1>
          <p style={s.sub}>{cv.titular}</p>
          <p style={s.meta}>
            📍 {cv.ubicacion}
            {" · "}✉ <a href={`mailto:${cv.email}`} style={s.link}>{cv.email}</a>
            {" · "}📞 <a href={waHref} style={s.link}>WhatsApp</a>
            {" · "}
            {/* Ocultamos el botón de imprimir en el propio PDF */}
            <button className="hide-print" onClick={() => window.print()} style={{...s.btn, padding: "4px 10px"}} title="Imprimir o guardar como PDF">
              Imprimir / Descargar PDF
            </button>
          </p>

          <p style={{marginTop: 12}}>{cv.perfil}</p>

          <div style={s.grid2}>
            <div>
              <h2 style={s.h2}>Competencias</h2>
              <ul style={s.list}>
                {cv.competencias.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div>
              <h2 style={s.h2}>Potencial empleable</h2>
              <ul style={s.list}>
                {cv.potencial.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          </div>

          <div style={{marginTop: 10}}>
            <h2 style={s.h2}>Proyecto destacado</h2>
            <ul style={s.list}>
              {cv.proyectos.map((p, i) => (
                <li key={i}><a style={s.link} href={p.url} target="_blank" rel="noreferrer">{p.t}</a></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
