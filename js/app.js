/* ============================================================
   PROGRESSÃO — app
   Estado local (localStorage), progressão dupla, substituições
   ============================================================ */

const LS = {
  logs: "gg_logs_v1",   // { exId: [ {d, name, sets:[{w,r}]} ] }  mais recente primeiro
  subs: "gg_subs_v1",   // { exId: "nome do exercício em uso" }
  last: "gg_last_v1"    // { workoutId: "2026-09-01" }
};

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let logs = read(LS.logs, {});
let subs = read(LS.subs, {});
let last = read(LS.last, {});

const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const brDate = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
const findWorkout = id => PROGRAM.workouts.find(w => w.id === id);
const exName = ex => subs[ex.id] || ex.name;

function daysAgo(iso) {
  if (!iso) return null;
  const d = Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 864e5);
  return d;
}

/* ------------------------------------------------ progressão dupla */
function suggestion(ex) {
  const h = logs[ex.id];
  if (!h || !h.length) return null;
  const s = h[0].sets.filter(x => x.r > 0);
  if (!s.length) return null;
  const top = s.every(x => x.r >= ex.repsMax);
  const low = s.some(x => x.r < ex.repsMin);
  const maxW = Math.max(...s.map(x => x.w || 0));
  if (top && ex.inc > 0) {
    return { up: true, txt: "Bateu o topo da faixa em todas as séries. Suba para " + fmt(maxW + ex.inc) + " kg hoje." };
  }
  if (low) {
    return { up: false, txt: "Ficou abaixo de " + ex.repsMin + " reps na última vez. Mantenha " + fmt(maxW) + " kg e busque reps." };
  }
  return { up: false, txt: "Mantenha " + fmt(maxW) + " kg e adicione reps até chegar a " + ex.repsMax + " em todas as séries." };
}
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");

/* ------------------------------------------------ home */
function viewHome() {
  const done = Object.keys(last).length;
  const sessions = Object.values(logs).reduce((a, h) => a + h.length, 0);
  const volume = Object.values(logs).reduce((a, h) =>
    a + (h[0] ? h[0].sets.reduce((s, x) => s + (x.w || 0) * (x.r || 0), 0) : 0), 0);

  const cards = PROGRAM.workouts.map((w, i) => {
    const d = daysAgo(last[w.id]);
    const when = d === null ? "nunca feito" : d === 0 ? "feito hoje" : d === 1 ? "ontem" : "há " + d + " dias";
    return `
    <button class="card ${w.priority ? "pri" : "sec-pri"} rise" style="animation-delay:${60 + i * 45}ms" data-go="w/${w.id}">
      <div class="grp">${esc(w.group)}${w.priority ? " &middot; prioridade" : ""}</div>
      <h3>${esc(w.title)}</h3>
      <p class="focus">${esc(w.focus)}</p>
      <div class="tags">
        <span class="tag">${w.duration} min</span>
        <span class="tag">${w.exercises.length} exercícios</span>
        <span class="tag ${d !== null && d <= 2 ? "ok" : ""}">${when}</span>
      </div>
    </button>`;
  }).join("");

  app.innerHTML = `
  <header class="topbar">
    <div class="mark">PRO<span>GRESSÃO</span></div>
    <div class="meta">v1.0</div>
  </header>

  <section class="hero rise">
    <h1>Pontos<em>fracos</em></h1>
    <p>Programa focado em costas, ombro e peito. Cada sessão registra carga e reps, e o app diz quando subir o peso.</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Sessões</div><div class="v">${sessions}</div></div>
      <div class="stat"><div class="k">Treinos</div><div class="v">${done}<small>/${PROGRAM.workouts.length}</small></div></div>
      <div class="stat"><div class="k">Volume</div><div class="v">${Math.round(volume / 1000)}<small>t</small></div></div>
    </div>
  </section>

  <div class="sec">Prioridade</div>
  ${cards}

  <div class="sec">Divisões sugeridas</div>
  ${SPLITS.map(s => `
    <div class="card" style="cursor:default">
      <div class="grp">${esc(s.name)}</div>
      <p class="focus" style="margin:8px 0 0">${s.days.map(id => esc((findWorkout(id) || {}).title || id)).join(" &rarr; ")}</p>
    </div>`).join("")}

  <div class="sec">Histórico</div>
  <button class="card" data-go="h">
    <h3>Cargas por exercício</h3>
    <p class="focus">Últimas sessões registradas, exercício a exercício.</p>
  </button>`;
}

/* ------------------------------------------------ treino */
function viewWorkout(id) {
  const w = findWorkout(id);
  if (!w) return go("");

  const ex = w.exercises.map((e, i) => {
    const sug = suggestion(e);
    const h = logs[e.id] && logs[e.id][0];
    const cur = exName(e);
    const swapped = cur !== e.name;

    const rows = Array.from({ length: e.sets }, (_, s) => {
      const p = h && h.sets[s] ? h.sets[s] : null;
      return `
      <div class="set-row">
        <div class="n">${s + 1}</div>
        <input type="number" inputmode="decimal" step="0.5" placeholder="${p && p.w ? fmt(p.w) : "kg"}" data-ex="${e.id}" data-s="${s}" data-f="w">
        <input type="number" inputmode="numeric" placeholder="${p && p.r ? p.r : e.repsMin + "-" + e.repsMax}" data-ex="${e.id}" data-s="${s}" data-f="r">
        <button class="done" data-done>&#10003;</button>
      </div>`;
    }).join("");

    return `
    <article class="ex rise" style="animation-delay:${60 + i * 50}ms">
      <div class="ex-head">
        <div class="ex-num">${i + 1}</div>
        <div class="ex-title">
          <h4>${esc(cur)}${swapped ? ' <span class="tag hot">trocado</span>' : ""}</h4>
          <div class="prescr">
            <b>${e.sets}x${e.repsMin}${e.repsMax !== e.repsMin ? "-" + e.repsMax : ""}</b><span class="dot">/</span>
            <span>RIR ${e.rir}</span><span class="dot">/</span>
            <span>desc. ${e.rest >= 60 ? fmt(e.rest / 60) + " min" : e.rest + "s"}</span>
            ${e.tech ? `<span class="dot">/</span><span style="color:var(--accent)">${esc(e.tech)}</span>` : ""}
          </div>
        </div>
      </div>
      <p class="cue">${esc(e.cue)}${e.tech ? " <strong>" + esc(PROGRAM.techniques[e.tech]) + "</strong>" : ""}</p>
      ${sug ? `<div class="suggest ${sug.up ? "" : "hold"}">${sug.up ? "&#9650; " : "&#8226; "}${esc(sug.txt)}</div>` : ""}
      <div class="sets">
        <div class="sets-head"><div></div><div>Carga (kg)</div><div>Reps</div><div></div></div>
        ${rows}
        ${h ? `<div class="last">Última (${brDate(h.d)}): <b>${h.sets.map(x => (x.w ? fmt(x.w) : "-") + "x" + (x.r || "-")).join("  ")}</b></div>` : ""}
      </div>
      <div class="ex-tools">
        <button class="mini" data-alts="${e.id}">Trocar exercício (${e.alts.length})</button>
        ${swapped ? `<button class="mini" data-reset="${e.id}">Voltar ao original</button>` : ""}
      </div>
      <div class="alts" id="alts-${e.id}">
        <button class="alt ${!swapped ? "cur" : ""}" data-pick="${e.id}" data-name="${esc(e.name)}">${esc(e.name)}</button>
        ${e.alts.map(a => `<button class="alt ${cur === a ? "cur" : ""}" data-pick="${e.id}" data-name="${esc(a)}">${esc(a)}</button>`).join("")}
      </div>
    </article>`;
  }).join("");

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="">&larr; Treinos</button>
    <div class="mark" style="font-size:15px">${esc(w.group)}</div>
    <div class="meta">${w.duration} min</div>
  </header>
  <section class="hero rise" style="padding-bottom:14px">
    <h1 style="font-size:clamp(27px,7.4vw,38px)">${esc(w.title)}</h1>
    <p style="margin-bottom:0">${esc(w.focus)}</p>
  </section>
  <p class="brief rise">${esc(w.brief)}</p>
  ${ex}
  <div class="bar">
    <div class="bar-in">
      <button class="btn ghost" data-clear>Limpar</button>
      <button class="btn" data-save="${w.id}">Salvar sessão</button>
    </div>
  </div>`;
}

/* ------------------------------------------------ histórico */
function viewHistory() {
  const ids = Object.keys(logs);
  const all = [];
  PROGRAM.workouts.forEach(w => w.exercises.forEach(e => { if (ids.includes(e.id)) all.push([w, e]); }));

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="">&larr; Treinos</button>
    <div class="mark" style="font-size:15px">Histórico</div>
  </header>
  <section class="hero rise" style="padding-bottom:10px">
    <h1 style="font-size:clamp(27px,7.4vw,38px)">Cargas</h1>
    <p style="margin-bottom:0">Últimas 6 sessões por exercício.</p>
  </section>
  ${all.length ? all.map(([w, e]) => `
    <div class="hist-ex">
      <h4>${esc(exName(e))} <span class="tag">${esc(w.group)}</span></h4>
      ${logs[e.id].slice(0, 6).map(s => `
        <div class="hist-line"><span class="d">${brDate(s.d)}</span>
        <span>${s.sets.map(x => (x.w ? fmt(x.w) : "-") + " x " + (x.r || "-")).join("   |   ")}</span></div>`).join("")}
    </div>`).join("") : `<p class="empty">Nenhuma sessão registrada ainda. Salve o primeiro treino.</p>`}
  <div style="height:40px"></div>`;
}

/* ------------------------------------------------ ações */
function saveSession(wid) {
  const w = findWorkout(wid);
  let count = 0;
  w.exercises.forEach(e => {
    const sets = [];
    document.querySelectorAll(`input[data-ex="${e.id}"][data-f="w"]`).forEach((inp, i) => {
      const r = document.querySelector(`input[data-ex="${e.id}"][data-s="${i}"][data-f="r"]`);
      const wv = parseFloat(inp.value), rv = parseInt(r && r.value, 10);
      if (!isNaN(wv) || !isNaN(rv)) sets.push({ w: isNaN(wv) ? 0 : wv, r: isNaN(rv) ? 0 : rv });
    });
    if (sets.length) {
      logs[e.id] = logs[e.id] || [];
      const entry = { d: today(), name: exName(e), sets };
      if (logs[e.id][0] && logs[e.id][0].d === entry.d) logs[e.id][0] = entry;
      else logs[e.id].unshift(entry);
      logs[e.id] = logs[e.id].slice(0, 12);
      count++;
    }
  });
  if (!count) return toast("Nada preenchido para salvar");
  last[wid] = today();
  save(LS.logs, logs); save(LS.last, last);
  toast(count + " exercícios registrados");
  setTimeout(() => go(""), 850);
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ------------------------------------------------ eventos */
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-go],[data-alts],[data-pick],[data-reset],[data-save],[data-clear],[data-done]");
  if (!t) return;

  if (t.hasAttribute("data-go")) return go(t.getAttribute("data-go"));

  if (t.hasAttribute("data-alts")) {
    const box = document.getElementById("alts-" + t.getAttribute("data-alts"));
    box.classList.toggle("open"); t.classList.toggle("on"); return;
  }
  if (t.hasAttribute("data-pick")) {
    const id = t.getAttribute("data-pick"), name = t.getAttribute("data-name");
    const orig = PROGRAM.workouts.flatMap(w => w.exercises).find(e => e.id === id);
    if (orig && name === orig.name) delete subs[id]; else subs[id] = name;
    save(LS.subs, subs); render(); toast("Exercício atualizado"); return;
  }
  if (t.hasAttribute("data-reset")) {
    delete subs[t.getAttribute("data-reset")]; save(LS.subs, subs); render(); return;
  }
  if (t.hasAttribute("data-save")) return saveSession(t.getAttribute("data-save"));
  if (t.hasAttribute("data-clear")) {
    document.querySelectorAll(".sets input").forEach(i => i.value = "");
    document.querySelectorAll(".done.on").forEach(b => b.classList.remove("on"));
    return toast("Campos limpos");
  }
  if (t.hasAttribute("data-done")) return t.classList.toggle("on");
});

/* ------------------------------------------------ router */
function go(hash) { location.hash = hash; }
function render() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "h") viewHistory();
  else if (h.startsWith("w/")) viewWorkout(h.slice(2));
  else viewHome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
