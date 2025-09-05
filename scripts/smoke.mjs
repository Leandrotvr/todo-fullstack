const BASE = process.env.BASE || "http://localhost:4000";

async function j(url, opts={}) {
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(\HTTP \\);
    const ct = res.headers.get("content-type")||"";
    return ct.includes("application/json") ? await res.json() : await res.text();
  } finally { clearTimeout(t); }
}

async function retry(fn, times=10, delayMs=6000) {
  let err;
  for (let i=0;i<times;i++){
    try { return await fn(); } catch(e){ err=e; await new Promise(r=>setTimeout(r, delayMs)); }
  }
  throw err;
}

(async () => {
  console.log("SMOKE against:", BASE);

  // 1) /health debe ok:true
  const health = await retry(()=> j(\\https://todo-fullstack-30wd.onrender.com/health\));
  if (!health || health.ok !== true) throw new Error("health not ok");
  console.log("health ok ->", health);

  // 2) GET lista
  const list = await j(\\https://todo-fullstack-30wd.onrender.com/api/todos\);
  console.log("GET todos ok (len):", Array.isArray(list)? list.length : (list.value?.length ?? "n/a"));

  // 3) CRUD rápido: crear -> toggle -> borrar
  const marker = "CI-SMOKE " + Date.now();
  const created = await j(\\https://todo-fullstack-30wd.onrender.com/api/todos\, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: marker })
  });
  if (!created?.id) throw new Error("create failed");
  console.log("created id:", created.id);

  await j(\\https://todo-fullstack-30wd.onrender.com/api/todos/\\, { method: "PUT" });
  console.log("toggled");

  await j(\\https://todo-fullstack-30wd.onrender.com/api/todos/\\, { method: "DELETE" });
  console.log("deleted");

  console.log("SMOKE PASSED");
})().catch(err => { console.error("SMOKE FAILED:", err?.message || err); process.exit(1); });
