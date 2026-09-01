/* ============================================================
   PROGRESSÃO — app
   Estado local (localStorage), progressão dupla, substituições,
   histórico completo e local de treino
   ============================================================ */

const LS = {
  logs: "gg_logs_v1",   // { exId: [ {d, name, sets:[{w,r}], loc} ] }  mais recente primeiro
  subs: "gg_subs_v1",   // { exId: "nome do exercício em uso" }
  last: "gg_last_v1",   // { workoutId: "2026-09-01" }
  locs: "gg_locs_v1",   // ["Smart Fit Cohama", "Academia do condomínio"]
  lloc: "gg_lloc_v1"    // último local usado
};

const read = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? f : v; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let logs = read(LS.logs, {});
let subs = read(LS.subs, {});
let last = read(LS.last, {});
let locs = read(LS.locs, []);
let lloc = read(LS.lloc, "");

const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const brDate = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
const brFull = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4) : "";
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
const allEx = () => PROGRAM.workouts.flatMap(w => w.exercises.map(e => [w, e]));
const findWorkout = id => PROGRAM.workouts.find(w => w.id === id);
const findEx = id => { const p = allEx().find(([, e]) => e.id === id); return p || null; };
const exName = ex => subs[ex.id] || ex.name;

function daysAgo(iso) {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 864e5);
}
const topSet = s => s.reduce((a, x) => Math.max(a, x.w || 0), 0);
const volume = s => s.reduce((a, x) => a + (x.w || 0) * (x.r || 0), 0);

/* ------------------------------------------------ progressão dupla */
function suggestion(ex) {
  const h = logs[ex.id];
  if (!h || !h.length) return null;
  const s = h[0].sets.filter(x => x.r > 0);
  if (!s.length) return null;
  const top = s.every(x => x.r >= ex.repsMax);
  const low = s.some(x => x.r < ex.repsMin);
  const maxW = topSet(s);
  if (top && ex.inc > 0) return { up: true, txt: "Bateu o topo da faixa em todas as séries. Suba para " + fmt(maxW + ex.inc) + " kg hoje." };
  if (low) return { up: false, txt: "Ficou abaixo de " + ex.repsMin + " reps na última vez. Mantenha " + fmt(maxW) + " kg e busque reps." };
  return { up: false, txt: "Mantenha " + fmt(maxW) + " kg e adicione reps até chegar a " + ex.repsMax + " em todas as séries." };
}

/* ------------------------------------------------ gráfico de carga */
function lineChart(series) {
  // series: [{d, v}] em ordem cronológica. Uma única série: sem legenda, título nomeia.
  const W = 340, H = 148, ml = 34, mr = 12, mt = 12, mb = 24;
  const iw = W - ml - mr, ih = H - mt - mb;
  const vs = series.map(p => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi === lo) { hi = lo + (lo * 0.1 || 1); lo = Math.max(0, lo - (lo * 0.1 || 1)); }
  const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi = hi + pad;
  const x = i => ml + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = v => mt + ih - ((v - lo) / (hi - lo)) * ih;

  const grid = [0, .5, 1].map(t => {
    const v = lo + (hi - lo) * t, yy = y(v);
    return `<line x1="${ml}" x2="${W - mr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="g-grid"/>
            <text x="${ml - 6}" y="${(yy + 3.5).toFixed(1)}" class="g-tick" text-anchor="end">${fmt(v)}</text>`;
  }).join("");

  const d = series.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const area = d + ` L${x(series.length - 1).toFixed(1)} ${mt + ih} L${x(0).toFixed(1)} ${mt + ih} Z`;
  const maxI = vs.indexOf(Math.max(...vs));

  const dots = series.map((p, i) => {
    const cx = x(i).toFixed(1), cy = y(p.v).toFixed(1);
    const on = i === series.length - 1 || i === maxI;
    return `<circle cx="${cx}" cy="${cy}" r="${on ? 4.5 : 3}" class="g-dot${on ? " on" : ""}"
             data-v="${p.v}" data-d="${p.d}" tabindex="0"/>`;
  }).join("");

  const lastP = series[series.length - 1];
  const lbl = `<text x="${(x(series.length - 1) - 4).toFixed(1)}" y="${(y(lastP.v) - 10).toFixed(1)}"
                class="g-lbl" text-anchor="end">${fmt(lastP.v)} kg</text>`;

  const xt = `<text x="${ml}" y="${H - 6}" class="g-tick">${brDate(series[0].d)}</text>
              <text x="${W - mr}" y="${H - 6}" class="g-tick" text-anchor="end">${brDate(lastP.d)}</text>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carga máxima por sessão">
    ${grid}<path d="${area}" class="g-area"/><path d="${d}" class="g-line"/>${dots}${lbl}${xt}
  </svg>
  <p class="g-cap" id="g-cap">Toque em um ponto para ver a sessão.</p>`;
}

/* ------------------------------------------------ home */
function viewHome() {
  const done = Object.keys(last).length;
  const sessions = Object.values(logs).reduce((a, h) => a + h.length, 0);
  const vol = Object.values(logs).reduce((a, h) => a + (h[0] ? volume(h[0].sets) : 0), 0);

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
    <div class="meta">v1.1</div>
  </header>

  <section class="hero rise">
    <h1>Pontos<em>fracos</em></h1>
    <p>Programa focado em costas, ombro e peito. Cada sessão registra carga, reps e local, e o app diz quando subir o peso.</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Sessões</div><div class="v">${sessions}</div></div>
      <div class="stat"><div class="k">Treinos</div><div class="v">${done}<small>/${PROGRAM.workouts.length}</small></div></div>
      <div class="stat"><div class="k">Volume</div><div class="v">${Math.round(vol / 1000)}<small>t</small></div></div>
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

  <div class="sec">Evolução</div>
  <button class="card" data-go="h">
    <h3>Histórico por exercício</h3>
    <p class="focus">Todas as sessões registradas, com gráfico de carga e local de treino.</p>
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
        ${h ? `<div class="last">Última (${brDate(h.d)}${h.loc ? ", " + esc(h.loc) : ""}): <b>${h.sets.map(x => (x.w ? fmt(x.w) : "-") + "x" + (x.r || "-")).join("  ")}</b></div>` : ""}
      </div>
      <div class="ex-tools">
        <button class="mini" data-alts="${e.id}">Trocar exercício (${e.alts.length})</button>
        ${logs[e.id] && logs[e.id].length ? `<button class="mini" data-go="hx/${e.id}">Ver evolução</button>` : ""}
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

  <div class="local rise">
    <label for="loc">Local do treino</label>
    <input id="loc" list="loclist" placeholder="Onde você está treinando hoje" value="${esc(lloc)}" autocomplete="off">
    <datalist id="loclist">${locs.map(l => `<option value="${esc(l)}"></option>`).join("")}</datalist>
  </div>

  ${ex}
  <div class="bar">
    <div class="bar-in">
      <button class="btn ghost" data-clear>Limpar</button>
      <button class="btn" data-save="${w.id}">Salvar sessão</button>
    </div>
  </div>`;
}

/* ------------------------------------------------ lista de histórico */
function viewHistory() {
  const rows = allEx().filter(([, e]) => logs[e.id] && logs[e.id].length).map(([w, e]) => {
    const h = logs[e.id];
    const best = h.reduce((a, s) => Math.max(a, topSet(s.sets)), 0);
    return `
    <button class="card" data-go="hx/${e.id}">
      <div class="grp">${esc(w.group)}</div>
      <h3 style="font-size:17px">${esc(exName(e))}</h3>
      <div class="tags">
        <span class="tag">${h.length} ${h.length === 1 ? "sessão" : "sessões"}</span>
        <span class="tag hot">recorde ${fmt(best)} kg</span>
        <span class="tag">última ${brDate(h[0].d)}</span>
      </div>
    </button>`;
  }).join("");

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="">&larr; Treinos</button>
    <div class="mark" style="font-size:15px">Evolução</div>
  </header>
  <section class="hero rise" style="padding-bottom:10px">
    <h1 style="font-size:clamp(27px,7.4vw,38px)">Histórico</h1>
    <p style="margin-bottom:0">Toque em um exercício para ver a curva de carga e todas as sessões.</p>
  </section>
  ${rows || `<p class="empty">Nenhuma sessão registrada ainda. Salve o primeiro treino.</p>`}
  <div style="height:40px"></div>`;
}

/* ------------------------------------------------ evolução de um exercício */
function viewExercise(exId) {
  const pair = findEx(exId);
  const h = logs[exId];
  if (!pair || !h || !h.length) return go("h");
  const [w, e] = pair;

  const chrono = h.slice().reverse();                     // cronológico
  const series = chrono.map(s => ({ d: s.d, v: topSet(s.sets) })).filter(p => p.v > 0);
  const best = Math.max(...series.map(p => p.v));
  const first = series[0], lastP = series[series.length - 1];
  const delta = first && first.v ? ((lastP.v - first.v) / first.v) * 100 : 0;
  const volTotal = chrono.reduce((a, s) => a + volume(s.sets), 0);

  const usados = [...new Set(h.map(s => s.loc).filter(Boolean))];

  const sessions = h.map(s => `
    <div class="hist-line">
      <span class="d">${brFull(s.d)}</span>
      <span class="sets-txt">${s.sets.map(x => (x.w ? fmt(x.w) : "-") + " x " + (x.r || "-")).join("  ·  ")}</span>
      ${s.loc ? `<span class="loc-tag">${esc(s.loc)}</span>` : ""}
    </div>`).join("");

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="h">&larr; Histórico</button>
    <div class="mark" style="font-size:15px">${esc(w.group)}</div>
  </header>
  <section class="hero rise" style="padding-bottom:14px">
    <h1 style="font-size:clamp(23px,6.2vw,32px)">${esc(exName(e))}</h1>
    <p style="margin-bottom:14px">${h.length} ${h.length === 1 ? "sessão registrada" : "sessões registradas"}${usados.length ? " &middot; " + esc(usados.join(", ")) : ""}</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Recorde</div><div class="v">${fmt(best)}<small>kg</small></div></div>
      <div class="stat"><div class="k">Variação</div><div class="v" style="color:${delta >= 0 ? "var(--cyan)" : "var(--amber)"}">${delta >= 0 ? "+" : ""}${fmt(delta)}<small>%</small></div></div>
      <div class="stat"><div class="k">Volume total</div><div class="v">${Math.round(volTotal / 1000)}<small>t</small></div></div>
    </div>
  </section>

  <div class="sec">Carga máxima por sessão</div>
  <div class="chart-box rise">${series.length > 1 ? lineChart(series) : `<p class="empty" style="padding:16px 0">Registre pelo menos duas sessões para a curva aparecer.</p>`}</div>

  <div class="sec">Todas as sessões</div>
  <div class="hist-ex">${sessions}</div>
  <div style="height:50px"></div>`;
}

/* ------------------------------------------------ ações */
function saveSession(wid) {
  const w = findWorkout(wid);
  const locInput = document.getElementById("loc");
  const loc = locInput ? locInput.value.trim() : "";
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
      const entry = { d: today(), name: exName(e), sets, loc };
      if (logs[e.id][0] && logs[e.id][0].d === entry.d) logs[e.id][0] = entry;
      else logs[e.id].unshift(entry);
      logs[e.id] = logs[e.id].slice(0, 400);   // histórico completo
      count++;
    }
  });

  if (!count) return toast("Nada preenchido para salvar");
  if (loc) { lloc = loc; if (!locs.includes(loc)) locs.unshift(loc); locs = locs.slice(0, 12); save(LS.locs, locs); save(LS.lloc, lloc); }
  last[wid] = today();
  save(LS.logs, logs); save(LS.last, last);
  toast(count + (count === 1 ? " exercício registrado" : " exercícios registrados"));
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
  const dot = ev.target.closest(".g-dot");
  if (dot) {
    const cap = document.getElementById("g-cap");
    if (cap) cap.textContent = brFull(dot.getAttribute("data-d")) + " — " + fmt(parseFloat(dot.getAttribute("data-v"))) + " kg na série mais pesada";
    document.querySelectorAll(".g-dot.sel").forEach(d => d.classList.remove("sel"));
    dot.classList.add("sel");
    return;
  }

  const t = ev.target.closest("[data-go],[data-alts],[data-pick],[data-reset],[data-save],[data-clear],[data-done]");
  if (!t) return;

  if (t.hasAttribute("data-go")) return go(t.getAttribute("data-go"));
  if (t.hasAttribute("data-alts")) {
    const box = document.getElementById("alts-" + t.getAttribute("data-alts"));
    box.classList.toggle("open"); t.classList.toggle("on"); return;
  }
  if (t.hasAttribute("data-pick")) {
    const id = t.getAttribute("data-pick"), name = t.getAttribute("data-name");
    const orig = allEx().map(([, e]) => e).find(e => e.id === id);
    if (orig && name === orig.name) delete subs[id]; else subs[id] = name;
    save(LS.subs, subs); render(); toast("Exercício atualizado"); return;
  }
  if (t.hasAttribute("data-reset")) { delete subs[t.getAttribute("data-reset")]; save(LS.subs, subs); render(); return; }
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
  else if (h.startsWith("hx/")) viewExercise(h.slice(3));
  else if (h.startsWith("w/")) viewWorkout(h.slice(2));
  else viewHome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
