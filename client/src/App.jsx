import { useState, useEffect, useRef } from "react";
import axios from "axios";

function useTheme() {
  const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = localStorage.getItem("theme") || (sysDark ? "dark" : "light");
  const [theme, setTheme] = useState(initial);
  useEffect(() => { localStorage.setItem("theme", theme); }, [theme]);
  return { theme, setTheme };
}

function palette(theme) {
  const light = { bg:"#fff", fg:"#111", sub:"#333", border:"#ddd", card:"#fff", cardBorder:"#e5e5e5",
    inputBg:"#fff", inputBorder:"#ccc", btnBg:"#f2f2f2", btnBorder:"#ccc", btnFg:"#111",
    liBg:"#fff", liBorder:"#e5e5e5", todoDone:"#777", todoText:"#111", dangerBg:"#e74c3c",
    dangerBorder:"#c0392b", dangerFg:"#fff", link:"#0b57d0" };
  const dark  = { bg:"#121212", fg:"#eee", sub:"#c8c8c8", border:"#2a2a2a", card:"#1b1b1b", cardBorder:"#2a2a2a",
    inputBg:"#2a2a2a", inputBorder:"#444", btnBg:"#333", btnBorder:"#555", btnFg:"#fff",
    liBg:"#202020", liBorder:"#323232", todoDone:"#aaa", todoText:"#fff", dangerBg:"#b43b3b",
    dangerBorder:"#7a2b2b", dangerFg:"#fff", link:"#7db7ff" };
  return theme === "dark" ? dark : light;
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const p = palette(theme);

  // ====== CONTACTO ======
  const whatsapp = "5493777416857";
  const waHref = `https://wa.me/${whatsapp}?text=Hola%20Leandro%2C%20vi%20tu%20CV%20web`;

  // ====== CV ======
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
  const [filtro, setFiltro] = useState("todas"); // todas | pendientes | hechas
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const draggingId = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    axios.get("/api/todos").then(res => setTodos(res.data));
  }, []);

  const addTodo = () => {
    const v = text.trim();
    if (!v) return;
    axios.post("/api/todos", { text: v }).then(res => {
      setTodos(prev => [...prev, res.data]); // se agrega al final (ord = max+1)
      setText(""); inputRef.current?.focus();
    });
  };
  const toggleTodo = (id) => {
    if (editingId === id) return;
    axios.put(`/api/todos/${id}`).then(() => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    });
  };
  const startEdit = (t) => { setEditingId(t.id); setEditingText(t.text); };
  const saveEdit = (id) => {
    const v = editingText.trim();
    if (!v) { cancelEdit(); return; }
    axios.patch(`/api/todos/${id}`, { text: v }).then(res => {
      const updated = res.data?.text ? res.data : { id, text: v, done: todos.find(x => x.id===id)?.done };
      setTodos(prev => prev.map(t => t.id === id ? { ...t, text: updated.text } : t));
      setEditingId(null); setEditingText("");
    });
  };
  const onEditKey = (e, id) => { if (e.key==="Enter"){e.preventDefault();saveEdit(id);} if(e.key==="Escape"){e.preventDefault();cancelEdit();} };
  const cancelEdit = () => { setEditingId(null); setEditingText(""); };
  const deleteTodo = (id) => { axios.delete(`/api/todos/${id}`).then(() => setTodos(prev => prev.filter(t => t.id !== id))); };
  const clearCompleted = () => { axios.delete("/api/todos/completed").then(() => setTodos(prev => prev.filter(t => !t.done))); };

  // DnD solo en "todas" para evitar reordenes parciales confusos
  const canDnD = filtro === "todas";
  const onDragStart = (id) => (e) => { draggingId.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver  = (id) => (e) => { if (!canDnD) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop      = (id) => async (e) => {
    if (!canDnD) return;
    e.preventDefault();
    const from = draggingId.current;
    const to = id;
    if (from == null || from === to) return;

    // Reordenar en memoria (todos está en orden por 'ord')
    setTodos(prev => {
      const idxFrom = prev.findIndex(t => t.id === from);
      const idxTo   = prev.findIndex(t => t.id === to);
      if (idxFrom < 0 || idxTo < 0) return prev;
      const clone = prev.slice();
      const [moved] = clone.splice(idxFrom, 1);
      clone.splice(idxTo, 0, moved);
      // Persistir orden en servidor
      const ids = clone.map(t => t.id);
      axios.patch("/api/todos/reorder", { ids }).catch(()=>{});
      return clone;
    });
  };

  // Derivados (lista filtrada para UI)
  const total = todos.length;
  const hechas = todos.filter(t => t.done).length;
  const pendientes = total - hechas;
  const filteredTodos = filtro === "hechas" ? todos.filter(t => t.done)
                        : filtro === "pendientes" ? todos.filter(t => !t.done)
                        : todos;

  // UI utils
  const copyMarkdown = async () => {
    const lines = filteredTodos.map(t => `- [${t.done ? "x" : " "}] ${t.text}`);
    const md = lines.join("\n") || "*(lista vacía)*";
    try { await navigator.clipboard.writeText(md); alert("Lista (Markdown) copiada."); }
    catch { alert("No se pudo copiar."); }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(todos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "todos.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // Estilos
  const s = {
    page: { minHeight:"100vh", margin:0, background:p.bg, color:p.fg, fontFamily:"system-ui, sans-serif" },
    wrap: { maxWidth:1000, margin:"0 auto", padding:20, display:"grid", gridTemplateColumns:"1fr", gap:16 },
    h2: { fontSize:20, margin:"0 0 10px 0", borderBottom:`1px solid ${p.border}`, paddingBottom:6 },
    small: { color:p.sub, fontSize:14 },
    card: { background:p.card, border:`1px solid ${p.cardBorder}`, borderRadius:14, padding:16 },
    row: { display:"flex", gap:8, marginTop:10, marginBottom:10 },
    input: { flex:1, padding:"10px 12px", borderRadius:8, border:`1px solid ${p.inputBorder}`, background:p.inputBg, color:p.fg },
    btn: { padding:"10px 16px", borderRadius:8, border:`1px solid ${p.btnBorder}`, background:p.btnBg, color:p.btnFg, cursor:"pointer" },
    ul: { listStyle:"none", padding:0, margin:0, display:"grid", gap:8 },
    li: { display:"flex", alignItems:"center", gap:8, background:p.liBg, border:`1px solid ${p.liBorder}`, borderRadius:10, padding:"10px 12px" },
    todoText: done => ({ flex:1, cursor:"pointer", textDecoration: done ? "line-through" : "none", color: done ? p.todoDone : p.todoText }),
    del: { padding:"6px 10px", borderRadius:8, border:`1px solid ${p.dangerBorder}`, background:p.dangerBg, color:p.dangerFg, cursor:"pointer" },
    banner: { background:p.card, border:`1px solid ${p.cardBorder}`, borderRadius:14, padding:16 },
    name: { fontSize:28, fontWeight:800, margin:0 }, sub: { margin:"4px 0 8px 0", color:p.sub }, meta: { margin:0, color:p.sub }, link: { color:p.link, textDecoration:"none" },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }, list: { margin:0, paddingLeft:18 },
    filters: { display:"flex", gap:8, alignItems:"center", marginTop:4, marginBottom:8 },
    tab: (active) => ({ padding:"6px 10px", borderRadius:999, border:`1px solid ${p.inputBorder}`, background: active ? p.fg : p.inputBg, color: active ? p.bg : p.fg, cursor:"pointer" })
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* ====== TODO LIST ====== */}
        <section className="pdf-card" style={s.card}>
          <h2 style={s.h2}>Mis tareas (To-Do List)</h2>
          <p style={s.small}>
            <strong>Hecha con:</strong> React + Vite (frontend), Node.js + Express (backend), Axios, API REST (JSON), CORS.{" "}
            <strong>Competencias:</strong> CRUD, hooks, asincronía, validaciones, SPA, build prod, DnD con persistencia (ord).
          </p>
          <p style={s.small}><strong>Contador:</strong> Total {total} · Pendientes {pendientes} · Hechas {hechas}</p>

          <div className="hide-print" style={s.filters}>
            <button type="button" style={s.tab(filtro === "todas")} onClick={() => setFiltro("todas")}>Todas</button>
            <button type="button" style={s.tab(filtro === "pendientes")} onClick={() => setFiltro("pendientes")}>Pendientes</button>
            <button type="button" style={s.tab(filtro === "hechas")} onClick={() => setFiltro("hechas")}>Hechas</button>
            <div style={{flex:1}} />
            <button type="button" style={s.btn} onClick={copyMarkdown} title="Copiar lista (Markdown)">Copiar (MD)</button>
            <button type="button" style={s.btn} onClick={exportJson}   title="Exportar JSON">Exportar JSON</button>
            <button type="button" className="hide-print" style={s.btn} onClick={clearCompleted} title="Borrar todas las completadas">Borrar completadas</button>
          </div>

          <form className="hide-print" onSubmit={(e) => { e.preventDefault(); addTodo(); }} style={s.row}>
            <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="Nueva tarea..." maxLength={120} style={s.input}/>
            <button type="submit" style={s.btn} disabled={!text.trim()}>Agregar</button>
          </form>

          <ul style={s.ul}>
            {filteredTodos.map(t => (
              <li key={t.id}
                  style={{...s.li, opacity: canDnD ? 1 : 1}}
                  draggable={canDnD}
                  onDragStart={onDragStart(t.id)}
                  onDragOver={onDragOver(t.id)}
                  onDrop={onDrop(t.id)}
              >
                {editingId === t.id ? (
                  <input autoFocus value={editingText} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>onEditKey(e,t.id)} onBlur={()=>saveEdit(t.id)} style={{...s.input, flex:1}} maxLength={120}/>
                ) : (
                  <span className="pdf-task" style={s.todoText(t.done)} onDoubleClick={()=>startEdit(t)} onClick={()=>toggleTodo(t.id)} title={canDnD ? "Arrastrá para reordenar · Doble clic: editar · Clic: completar" : "Doble clic: editar · Clic: completar"}>
                    {t.text}
                  </span>
                )}
                <button className="hide-print" onClick={()=>startEdit(t)} style={s.btn} title="Editar">Editar</button>
                <button className="hide-print" onClick={()=>deleteTodo(t.id)} style={s.del} title="Eliminar">Eliminar</button>
              </li>
            ))}
          </ul>
          {filtro!=="todas" && <p style={s.small}>* El reordenamiento por arrastre está disponible en el filtro “Todas”.</p>}
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
            <button className="hide-print" onClick={() => window.print()} style={{...s.btn, padding:"4px 10px"}} title="Imprimir o guardar como PDF">
              Imprimir / Descargar PDF
            </button>
            {" · "}
            <button className="hide-print" onClick={()=>setTheme(theme==="dark"?"light":"dark")} style={{...s.btn, padding:"4px 10px"}} title="Cambiar tema">
              Tema: {theme === "dark" ? "Oscuro" : "Claro"}
            </button>
          </p>

          <p style={{marginTop:12}}>{cv.perfil}</p>

          <div style={s.grid2}>
            <div>
              <h2 style={s.h2}>Competencias</h2>
              <ul style={s.list}>{cv.competencias.map((c,i)=><li key={i}>{c}</li>)}</ul>
            </div>
            <div>
              <h2 style={s.h2}>Potencial empleable</h2>
              <ul style={s.list}>{cv.potencial.map((p,i)=><li key={i}>{p}</li>)}</ul>
            </div>
          </div>

          <div style={{marginTop:10}}>
            <h2 style={s.h2}>Proyecto fullstack</h2>
            <ul style={s.list}>
              {cv.proyectos.map((p,i)=>(<li key={i}><a style={s.link} href={p.url} target="_blank" rel="noreferrer">{p.t}</a></li>))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
