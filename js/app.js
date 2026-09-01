/* ============================================================
   PROGRESSÃO — app v1.2
   localStorage, progressão dupla, substituições, histórico
   completo, local de treino, técnicas avançadas, timer,
   volume semanal por grupo e detecção de estagnação
   ============================================================ */

const LS = {
  logs: "gg_logs_v1", subs: "gg_subs_v1", last: "gg_last_v1",
  locs: "gg_locs_v1", lloc: "gg_lloc_v1", cust: "gg_cust_v1"
};

const read = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? f : v; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let logs = read(LS.logs, {});
let subs = read(LS.subs, {});
let last = read(LS.last, {});
let locs = read(LS.locs, []);
let lloc = read(LS.lloc, "");
let cust = read(LS.cust, []);   // [{id, wid, name, group, sets, repsMin, repsMax, rir, rest, inc}]

const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const brDate = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
const brFull = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(2, 4) : "";
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
const tecOf = k => TECNICAS.find(t => t.k === (k || "")) || TECNICAS[0];

const findWorkout = id => PROGRAM.workouts.find(w => w.id === id);
const customOf = wid => cust.filter(c => c.wid === wid);
const exsOf = w => w.exercises.concat(customOf(w.id));
const allPairs = () => PROGRAM.workouts.flatMap(w => exsOf(w).map(e => [w, e]));
const findEx = id => allPairs().find(([, e]) => e.id === id) || null;
const exName = ex => subs[ex.id] || ex.name;
const groupOf = (w, e) => e.g || e.group || w.group;

function daysAgo(iso) { return iso ? Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 864e5) : null; }
const topSet = s => s.reduce((a, x) => Math.max(a, x.w || 0), 0);
const volume = s => s.reduce((a, x) => a + (x.w || 0) * (x.r || 0), 0);
const effSets = s => s.filter(x => (x.r || 0) > 0).length;

/* ------------------------------------------------ progressão e estagnação */
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

/* Estagnação: 3 sessões sem ganho de carga nem de reps na carga de topo */
function stall(exId) {
  const h = (logs[exId] || []).slice(0, 3);
  if (h.length < 3) return null;
  const score = s => {
    const w = topSet(s.sets);
    const reps = s.sets.filter(x => (x.w || 0) === w).reduce((a, x) => a + (x.r || 0), 0);
    return w * 1000 + reps;
  };
  const sc = h.map(score);
  if (sc[0] > sc[1] || sc[1] > sc[2]) return null;
  return { n: h.length, since: h[h.length - 1].d };
}

/* ------------------------------------------------ volume semanal */
function weekWindow(offset) {
  const end = new Date(); end.setHours(12, 0, 0, 0); end.setDate(end.getDate() - offset * 7);
  const start = new Date(end); start.setDate(start.getDate() - 6);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}
function volumeByGroup(offset) {
  const [a, b] = weekWindow(offset);
  const out = {};
  allPairs().forEach(([w, e]) => {
    const g = groupOf(w, e);
    if (g === "Livre") return;
    (logs[e.id] || []).forEach(s => {
      if (s.d >= a && s.d <= b) out[g] = (out[g] || 0) + effSets(s.sets);
    });
  });
  return out;
}

/* ------------------------------------------------ gráfico */
function lineChart(series) {
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
    const on = i === series.length - 1 || i === maxI;
    return `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${on ? 4.5 : 3}" class="g-dot${on ? " on" : ""}" data-v="${p.v}" data-d="${p.d}" tabindex="0"/>`;
  }).join("");
  const lastP = series[series.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carga máxima por sessão">
    ${grid}<path d="${area}" class="g-area"/><path d="${d}" class="g-line"/>${dots}
    <text x="${(x(series.length - 1) - 4).toFixed(1)}" y="${(y(lastP.v) - 10).toFixed(1)}" class="g-lbl" text-anchor="end">${fmt(lastP.v)} kg</text>
    <text x="${ml}" y="${H - 6}" class="g-tick">${brDate(series[0].d)}</text>
    <text x="${W - mr}" y="${H - 6}" class="g-tick" text-anchor="end">${brDate(lastP.d)}</text>
  </svg>
  <p class="g-cap" id="g-cap">Toque em um ponto para ver a sessão.</p>`;
}

/* ------------------------------------------------ timer de descanso */
const Timer = {
  left: 0, id: null,
  start(sec, label) {
    this.left = sec; this.label = label || "Descanso";
    clearInterval(this.id);
    this.id = setInterval(() => { this.left--; this.paint(); if (this.left <= 0) this.done(); }, 1000);
    this.paint();
  },
  add(s) { if (this.el()) { this.left += s; this.paint(); } },
  stop() { clearInterval(this.id); this.id = null; this.left = 0; const e = this.el(); if (e) e.remove(); },
  done() {
    clearInterval(this.id); this.id = null;
    if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
    const e = this.el(); if (e) { e.classList.add("fim"); e.querySelector(".t-time").textContent = "0:00"; e.querySelector(".t-lbl").textContent = "Descanso concluído"; }
    setTimeout(() => { const x = this.el(); if (x) x.remove(); }, 6000);
  },
  el() { return document.getElementById("timer"); },
  paint() {
    let e = this.el();
    if (!e) {
      e = document.createElement("div"); e.id = "timer"; e.className = "timer";
      e.innerHTML = `<span class="t-lbl"></span><span class="t-time"></span>
        <button class="t-btn" data-t="15">+15s</button><button class="t-btn" data-t="stop">Pular</button>`;
      document.body.appendChild(e);
    }
    e.classList.remove("fim");
    const m = Math.floor(Math.max(0, this.left) / 60), s = Math.max(0, this.left) % 60;
    e.querySelector(".t-lbl").textContent = this.label;
    e.querySelector(".t-time").textContent = m + ":" + String(s).padStart(2, "0");
  }
};

/* ------------------------------------------------ bottom sheet */
function sheet(title, html) {
  let s = document.getElementById("sheet");
  if (!s) { s = document.createElement("div"); s.id = "sheet"; s.className = "sheet"; document.body.appendChild(s); }
  s.innerHTML = `<div class="sheet-bg" data-sheet-close></div>
    <div class="sheet-in"><div class="sheet-h">${esc(title)}<button class="mini" data-sheet-close>Fechar</button></div>${html}</div>`;
  requestAnimationFrame(() => s.classList.add("open"));
}
function closeSheet() { const s = document.getElementById("sheet"); if (s) { s.classList.remove("open"); setTimeout(() => s.remove(), 220); } }

/* ------------------------------------------------ home */
function viewHome() {
  const sessions = Object.values(logs).reduce((a, h) => a + h.length, 0);
  const done = Object.keys(last).length;
  const wk = volumeByGroup(0);
  const wkSets = Object.values(wk).reduce((a, b) => a + b, 0);
  const stalls = allPairs().map(([, e]) => [e, stall(e.id)]).filter(([, s]) => s);

  const cards = PROGRAM.workouts.map((w, i) => {
    const d = daysAgo(last[w.id]);
    const when = d === null ? "nunca feito" : d === 0 ? "feito hoje" : d === 1 ? "ontem" : "há " + d + " dias";
    const n = exsOf(w).length;
    return `
    <button class="card ${w.priority ? "pri" : "sec-pri"} rise" style="animation-delay:${50 + i * 35}ms" data-go="w/${w.id}">
      <div class="grp">${esc(w.group)}${w.priority ? " &middot; prioridade" : ""}</div>
      <h3>${esc(w.title)}</h3>
      <p class="focus">${esc(w.focus)}</p>
      <div class="tags">
        ${w.duration ? `<span class="tag">${w.duration} min</span>` : ""}
        <span class="tag">${n} ${n === 1 ? "exercício" : "exercícios"}</span>
        <span class="tag ${d !== null && d <= 2 ? "ok" : ""}">${when}</span>
      </div>
    </button>`;
  }).join("");

  app.innerHTML = `
  <header class="topbar">
    <div class="mark">PRO<span>GRESSÃO</span></div>
    <div class="meta">v1.2</div>
  </header>

  <section class="hero rise">
    <h1>Pontos<em>fracos</em></h1>
    <p>Programa focado em costas, ombro e peito. Registra carga, reps, técnica e local, e avisa quando subir o peso ou quando você estagnou.</p>
    <div class="stat-row">
      <div class="stat"><div class="k">Sessões</div><div class="v">${sessions}</div></div>
      <div class="stat"><div class="k">Séries 7d</div><div class="v">${wkSets}</div></div>
      <div class="stat"><div class="k">Alertas</div><div class="v" style="${stalls.length ? "color:var(--amber)" : ""}">${stalls.length}</div></div>
    </div>
  </section>

  ${stalls.length ? `
  <button class="card alert rise" data-go="v">
    <div class="grp" style="color:var(--amber)">Estagnação</div>
    <h3 style="font-size:17px">${stalls.length} ${stalls.length === 1 ? "exercício parado" : "exercícios parados"}</h3>
    <p class="focus" style="margin:6px 0 0">${stalls.slice(0, 3).map(([e]) => esc(exName(e))).join(", ")}${stalls.length > 3 ? " e mais" : ""}. Toque para ver o que fazer.</p>
  </button>` : ""}

  <div class="sec">Treinos</div>
  ${cards}

  <div class="sec">Acompanhamento</div>
  <button class="card" data-go="v">
    <h3 style="font-size:19px">Volume semanal e alertas</h3>
    <p class="focus">Séries efetivas por grupo nos últimos 7 dias, comparadas com a faixa alvo, e os exercícios estagnados.</p>
  </button>
  <button class="card" data-go="h">
    <h3 style="font-size:19px">Histórico por exercício</h3>
    <p class="focus">Todas as sessões, com gráfico de carga, técnica usada e local de treino.</p>
  </button>

  <div class="sec">Divisões sugeridas</div>
  ${SPLITS.map(s => `
    <div class="card" style="cursor:default">
      <div class="grp">${esc(s.name)}</div>
      <p class="focus" style="margin:8px 0 0">${s.days.map(id => esc((findWorkout(id) || {}).title || id)).join(" &rarr; ")}</p>
    </div>`).join("")}`;
}

/* ------------------------------------------------ volume e alertas */
function viewVolume() {
  const cur = volumeByGroup(0), prev = volumeByGroup(1);
  const grupos = ["Costas", "Peito", "Ombro", "Braço", "Perna"];
  const maxV = Math.max(20, ...grupos.map(g => cur[g] || 0));

  const bars = grupos.map(g => {
    const v = cur[g] || 0, p = prev[g] || 0, [lo, hi] = ALVO[g];
    const st = v === 0 ? "zero" : v < lo ? "baixo" : v > hi ? "alto" : "ok";
    const txt = { zero: "sem estímulo", baixo: "abaixo do alvo", ok: "dentro do alvo", alto: "acima do alvo" }[st];
    const d = v - p;
    return `
    <div class="vol-row">
      <div class="vol-top">
        <span class="vol-g">${g}</span>
        <span class="vol-n">${v} <small>séries</small></span>
      </div>
      <div class="vol-track">
        <div class="vol-fill ${st}" style="width:${Math.min(100, (v / maxV) * 100)}%"></div>
        <div class="vol-band" style="left:${(lo / maxV) * 100}%;width:${((hi - lo) / maxV) * 100}%"></div>
      </div>
      <div class="vol-foot">
        <span class="st ${st}">${txt}</span>
        <span>alvo ${lo} a ${hi} &middot; semana passada ${p}${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}</span>
      </div>
    </div>`;
  }).join("");

  const stalls = allPairs().map(([w, e]) => [w, e, stall(e.id)]).filter(([, , s]) => s);

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="">&larr; Treinos</button>
    <div class="mark" style="font-size:15px">Acompanhamento</div>
  </header>
  <section class="hero rise" style="padding-bottom:10px">
    <h1 style="font-size:clamp(27px,7.4vw,38px)">Volume semanal</h1>
    <p style="margin-bottom:0">Séries efetivas por grupo nos últimos 7 dias. A faixa clara na barra é o alvo semanal para hipertrofia.</p>
  </section>

  <div class="chart-box rise">${bars}</div>

  <div class="sec">Estagnação</div>
  ${stalls.length ? stalls.map(([w, e, s]) => `
    <button class="card alert" data-go="hx/${e.id}">
      <div class="grp" style="color:var(--amber)">${esc(groupOf(w, e))}</div>
      <h3 style="font-size:17px">${esc(exName(e))}</h3>
      <p class="focus" style="margin:6px 0 0">${s.n} sessões sem ganho de carga nem de reps, desde ${brDate(s.since)}. Faça uma semana com 40% menos volume nesse exercício, ou troque por uma das alternativas.</p>
    </button>`).join("") : `<p class="empty">Nenhum exercício estagnado. Toda progressão que existe está registrada em cima de pelo menos 3 sessões.</p>`}
  <div style="height:50px"></div>`;
}

/* ------------------------------------------------ treino */
function viewWorkout(id) {
  const w = findWorkout(id);
  if (!w) return go("");
  const list = exsOf(w);

  const ex = list.map((e, i) => {
    const sug = suggestion(e), st = stall(e.id);
    const h = logs[e.id] && logs[e.id][0];
    const cur = exName(e), swapped = cur !== e.name;
    const isC = !!e.wid;

    const rows = Array.from({ length: e.sets }, (_, s) => {
      const p = h && h.sets[s] ? h.sets[s] : null;
      return `
      <div class="set-row">
        <div class="n">${s + 1}</div>
        <input type="number" inputmode="decimal" step="0.5" placeholder="${p && p.w ? fmt(p.w) : "kg"}" data-ex="${e.id}" data-s="${s}" data-f="w">
        <input type="number" inputmode="numeric" placeholder="${p && p.r ? p.r : e.repsMin + "-" + e.repsMax}" data-ex="${e.id}" data-s="${s}" data-f="r">
        <button class="tec" data-tec="${e.id}|${s}" data-k="">—</button>
        <button class="done" data-done data-rest="${e.rest}" data-nome="${esc(cur)}">&#10003;</button>
      </div>`;
    }).join("");

    return `
    <article class="ex rise" style="animation-delay:${50 + i * 40}ms">
      <div class="ex-head">
        <div class="ex-num">${i + 1}</div>
        <div class="ex-title">
          <h4>${esc(cur)}${swapped ? ' <span class="tag hot">trocado</span>' : ""}${isC ? ' <span class="tag">avulso</span>' : ""}</h4>
          <div class="prescr">
            <b>${e.sets}x${e.repsMin}${e.repsMax !== e.repsMin ? "-" + e.repsMax : ""}</b><span class="dot">/</span>
            <span>RIR ${e.rir}</span><span class="dot">/</span>
            <span>desc. ${e.rest >= 60 ? fmt(e.rest / 60) + " min" : e.rest + "s"}</span>
            ${e.tech ? `<span class="dot">/</span><span style="color:var(--accent)">${esc(e.tech)}</span>` : ""}
          </div>
        </div>
      </div>
      ${e.cue ? `<p class="cue">${esc(e.cue)}${e.tech ? " <strong>" + esc(PROGRAM.techniques[e.tech] || "") + "</strong>" : ""}</p>` : ""}
      ${st ? `<div class="suggest stall">&#9888; Estagnado há ${st.n} sessões. Reduza o volume 40% esta semana ou troque o exercício.</div>` : ""}
      ${sug ? `<div class="suggest ${sug.up ? "" : "hold"}">${sug.up ? "&#9650; " : "&#8226; "}${esc(sug.txt)}</div>` : ""}
      <div class="sets">
        <div class="sets-head"><div></div><div>Carga (kg)</div><div>Reps</div><div>Téc</div><div></div></div>
        ${rows}
        ${h ? `<div class="last">Última (${brDate(h.d)}${h.loc ? ", " + esc(h.loc) : ""}): <b>${h.sets.map(x => (x.w ? fmt(x.w) : "-") + "x" + (x.r || "-") + (x.t ? " " + tecOf(x.t).s : "")).join("  ")}</b></div>` : ""}
      </div>
      <div class="ex-tools">
        ${e.alts && e.alts.length ? `<button class="mini" data-alts="${e.id}">Trocar exercício (${e.alts.length})</button>` : ""}
        ${logs[e.id] && logs[e.id].length ? `<button class="mini" data-go="hx/${e.id}">Ver evolução</button>` : ""}
        ${swapped ? `<button class="mini" data-reset="${e.id}">Voltar ao original</button>` : ""}
        ${isC ? `<button class="mini" data-delc="${e.id}">Remover</button>` : ""}
      </div>
      ${e.alts && e.alts.length ? `<div class="alts" id="alts-${e.id}">
        <button class="alt ${!swapped ? "cur" : ""}" data-pick="${e.id}" data-name="${esc(e.name)}">${esc(e.name)}</button>
        ${e.alts.map(a => `<button class="alt ${cur === a ? "cur" : ""}" data-pick="${e.id}" data-name="${esc(a)}">${esc(a)}</button>`).join("")}
      </div>` : ""}
    </article>`;
  }).join("");

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="">&larr; Treinos</button>
    <div class="mark" style="font-size:15px">${esc(w.group)}</div>
    ${w.duration ? `<div class="meta">${w.duration} min</div>` : ""}
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

  ${ex || `<p class="empty">Nenhum exercício ainda. Use o botão abaixo para montar o treino.</p>`}

  <button class="add-ex" data-addex="${w.id}">+ Adicionar exercício avulso</button>

  <div class="bar">
    <div class="bar-in">
      <button class="btn ghost" data-clear>Limpar</button>
      <button class="btn" data-save="${w.id}">Salvar sessão</button>
    </div>
  </div>`;
}

/* ------------------------------------------------ histórico */
function viewHistory() {
  const rows = allPairs().filter(([, e]) => logs[e.id] && logs[e.id].length).map(([w, e]) => {
    const h = logs[e.id];
    const best = h.reduce((a, s) => Math.max(a, topSet(s.sets)), 0);
    const st = stall(e.id);
    return `
    <button class="card" data-go="hx/${e.id}">
      <div class="grp">${esc(groupOf(w, e))}</div>
      <h3 style="font-size:17px">${esc(exName(e))}</h3>
      <div class="tags">
        <span class="tag">${h.length} ${h.length === 1 ? "sessão" : "sessões"}</span>
        <span class="tag hot">recorde ${fmt(best)} kg</span>
        ${st ? `<span class="tag warn">estagnado</span>` : ""}
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

/* ------------------------------------------------ evolução do exercício */
function viewExercise(exId) {
  const pair = findEx(exId), h = logs[exId];
  if (!pair || !h || !h.length) return go("h");
  const [w, e] = pair;

  const chrono = h.slice().reverse();
  const series = chrono.map(s => ({ d: s.d, v: topSet(s.sets) })).filter(p => p.v > 0);
  const best = series.length ? Math.max(...series.map(p => p.v)) : 0;
  const delta = series.length > 1 && series[0].v ? ((series[series.length - 1].v - series[0].v) / series[0].v) * 100 : 0;
  const volTotal = chrono.reduce((a, s) => a + volume(s.sets), 0);
  const usados = [...new Set(h.map(s => s.loc).filter(Boolean))];
  const st = stall(exId);

  const sessions = h.map((s, i) => `
    <div class="hist-line" id="hs-${i}">
      <span class="d">${brFull(s.d)}</span>
      <span class="sets-txt">${s.sets.map(x => (x.w ? fmt(x.w) : "-") + " x " + (x.r || "-") + (x.t ? ` <b class="tec-tag">${tecOf(x.t).s}</b>` : "")).join("  ·  ")}</span>
      ${s.loc ? `<span class="loc-tag">${esc(s.loc)}</span>` : ""}
      <span class="row-tools">
        <button class="mini" data-edit="${exId}|${i}">Editar</button>
        <button class="mini danger" data-del="${exId}|${i}">Apagar</button>
      </span>
    </div>`).join("");

  app.innerHTML = `
  <header class="topbar">
    <button class="back" data-go="h">&larr; Histórico</button>
    <div class="mark" style="font-size:15px">${esc(groupOf(w, e))}</div>
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

  ${st ? `<div class="suggest stall rise">&#9888; Estagnado há ${st.n} sessões, desde ${brDate(st.since)}. Reduza o volume 40% por uma semana ou troque o exercício por uma alternativa.</div>` : ""}

  <div class="sec">Carga máxima por sessão</div>
  <div class="chart-box rise">${series.length > 1 ? lineChart(series) : `<p class="empty" style="padding:16px 0">Registre pelo menos duas sessões para a curva aparecer.</p>`}</div>

  <div class="sec">Todas as sessões</div>
  <div class="hist-ex">${sessions}</div>
  <div style="height:50px"></div>`;
}

/* ------------------------------------------------ editar sessão */
function editSheet(exId, i) {
  const s = logs[exId][i];
  const rows = s.sets.map((x, k) => `
    <div class="set-row">
      <div class="n">${k + 1}</div>
      <input type="number" inputmode="decimal" step="0.5" value="${x.w || ""}" data-ed="w" data-k="${k}">
      <input type="number" inputmode="numeric" value="${x.r || ""}" data-ed="r" data-k="${k}">
      <button class="tec" data-edtec="${k}" data-k="${x.t || ""}">${tecOf(x.t).s}</button>
      <span></span>
    </div>`).join("");

  sheet("Editar sessão de " + brFull(s.d), `
    <div class="sets" style="padding:0">
      <div class="sets-head"><div></div><div>Carga (kg)</div><div>Reps</div><div>Téc</div><div></div></div>
      ${rows}
    </div>
    <div class="local" style="margin:12px 0 0;box-shadow:none">
      <label for="edloc">Local</label>
      <input id="edloc" value="${esc(s.loc || "")}" placeholder="Local do treino">
    </div>
    <button class="btn" style="width:100%;margin-top:14px" data-saveedit="${exId}|${i}">Salvar alterações</button>`);
}

function tecSheet(onPick, atual) {
  sheet("Técnica da série", `<div class="alts open" style="padding:0">
    ${TECNICAS.map(t => `<button class="alt ${t.k === (atual || "") ? "cur" : ""}" data-tecpick="${t.k}">${t.n}${t.k ? ` <span class="tec-tag">${t.s}</span>` : ""}</button>`).join("")}
  </div>`);
  window.__tecPick = onPick;
}

/* ------------------------------------------------ exercício avulso */
function addExSheet(wid) {
  sheet("Novo exercício avulso", `
    <div class="form">
      <label>Nome do exercício</label>
      <input id="cx-name" placeholder="Ex.: Agachamento búlgaro">
      <label>Grupo muscular</label>
      <select id="cx-group">${["Costas", "Peito", "Ombro", "Braço", "Perna"].map(g => `<option>${g}</option>`).join("")}</select>
      <div class="form-row">
        <div><label>Séries</label><input id="cx-sets" type="number" inputmode="numeric" value="3"></div>
        <div><label>Reps mín.</label><input id="cx-rmin" type="number" inputmode="numeric" value="10"></div>
        <div><label>Reps máx.</label><input id="cx-rmax" type="number" inputmode="numeric" value="12"></div>
      </div>
      <div class="form-row">
        <div><label>Descanso (s)</label><input id="cx-rest" type="number" inputmode="numeric" value="90"></div>
        <div><label>Incremento (kg)</label><input id="cx-inc" type="number" inputmode="decimal" step="0.5" value="2.5"></div>
      </div>
      <button class="btn" style="width:100%;margin-top:6px" data-savecx="${wid}">Adicionar ao treino</button>
    </div>`);
}

/* ------------------------------------------------ salvar sessão */
function saveSession(wid) {
  const w = findWorkout(wid);
  const locInput = document.getElementById("loc");
  const loc = locInput ? locInput.value.trim() : "";
  let count = 0;

  exsOf(w).forEach(e => {
    const sets = [];
    document.querySelectorAll(`input[data-ex="${e.id}"][data-f="w"]`).forEach((inp, i) => {
      const r = document.querySelector(`input[data-ex="${e.id}"][data-s="${i}"][data-f="r"]`);
      const tb = document.querySelector(`button[data-tec="${e.id}|${i}"]`);
      const wv = parseFloat(inp.value), rv = parseInt(r && r.value, 10);
      if (!isNaN(wv) || !isNaN(rv)) sets.push({ w: isNaN(wv) ? 0 : wv, r: isNaN(rv) ? 0 : rv, t: tb ? tb.getAttribute("data-k") : "" });
    });
    if (sets.length) {
      logs[e.id] = logs[e.id] || [];
      const entry = { d: today(), name: exName(e), sets, loc };
      if (logs[e.id][0] && logs[e.id][0].d === entry.d) logs[e.id][0] = entry;
      else logs[e.id].unshift(entry);
      logs[e.id] = logs[e.id].slice(0, 400);
      count++;
    }
  });

  if (!count) return toast("Nada preenchido para salvar");
  if (loc) { lloc = loc; if (!locs.includes(loc)) locs.unshift(loc); locs = locs.slice(0, 12); save(LS.locs, locs); save(LS.lloc, lloc); }
  last[wid] = today();
  save(LS.logs, logs); save(LS.last, last);
  Timer.stop();
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
  const t = ev.target.closest("button, .g-dot");
  if (!t) return;

  if (t.classList.contains("g-dot")) {
    const cap = document.getElementById("g-cap");
    if (cap) cap.textContent = brFull(t.getAttribute("data-d")) + " — " + fmt(parseFloat(t.getAttribute("data-v"))) + " kg na série mais pesada";
    document.querySelectorAll(".g-dot.sel").forEach(d => d.classList.remove("sel"));
    t.classList.add("sel"); return;
  }

  if (t.hasAttribute("data-sheet-close")) return closeSheet();
  if (t.hasAttribute("data-t")) {
    const v = t.getAttribute("data-t");
    return v === "stop" ? Timer.stop() : Timer.add(15);
  }

  /* técnica no treino */
  if (t.hasAttribute("data-tec")) {
    const btn = t;
    return tecSheet(k => { btn.setAttribute("data-k", k); btn.textContent = tecOf(k).s; btn.classList.toggle("on", !!k); closeSheet(); }, btn.getAttribute("data-k"));
  }
  if (t.hasAttribute("data-edtec")) {
    const btn = t;
    return tecSheet(k => { btn.setAttribute("data-k", k); btn.textContent = tecOf(k).s; closeSheet(); }, btn.getAttribute("data-k"));
  }
  if (t.hasAttribute("data-tecpick")) { if (window.__tecPick) window.__tecPick(t.getAttribute("data-tecpick")); return; }

  if (t.hasAttribute("data-go")) return go(t.getAttribute("data-go"));

  if (t.hasAttribute("data-alts")) {
    const box = document.getElementById("alts-" + t.getAttribute("data-alts"));
    box.classList.toggle("open"); t.classList.toggle("on"); return;
  }
  if (t.hasAttribute("data-pick")) {
    const id = t.getAttribute("data-pick"), name = t.getAttribute("data-name");
    const orig = allPairs().map(([, e]) => e).find(e => e.id === id);
    if (orig && name === orig.name) delete subs[id]; else subs[id] = name;
    save(LS.subs, subs); render(); toast("Exercício atualizado"); return;
  }
  if (t.hasAttribute("data-reset")) { delete subs[t.getAttribute("data-reset")]; save(LS.subs, subs); return render(); }

  if (t.hasAttribute("data-addex")) return addExSheet(t.getAttribute("data-addex"));
  if (t.hasAttribute("data-savecx")) {
    const wid = t.getAttribute("data-savecx");
    const name = document.getElementById("cx-name").value.trim();
    if (!name) return toast("Dê um nome ao exercício");
    const c = {
      id: "cx" + Date.now().toString(36), wid, name,
      group: document.getElementById("cx-group").value,
      sets: Math.max(1, parseInt(document.getElementById("cx-sets").value, 10) || 3),
      repsMin: parseInt(document.getElementById("cx-rmin").value, 10) || 10,
      repsMax: parseInt(document.getElementById("cx-rmax").value, 10) || 12,
      rir: 1, rest: parseInt(document.getElementById("cx-rest").value, 10) || 90,
      inc: parseFloat(document.getElementById("cx-inc").value) || 2.5,
      cue: "", tech: null, alts: []
    };
    cust.push(c); save(LS.cust, cust); closeSheet(); render(); return toast("Exercício adicionado");
  }
  if (t.hasAttribute("data-delc")) {
    const id = t.getAttribute("data-delc");
    if (t.dataset.confirm !== "1") { t.dataset.confirm = "1"; t.textContent = "Confirmar remoção?"; t.classList.add("danger"); return; }
    cust = cust.filter(c => c.id !== id); save(LS.cust, cust); render(); return toast("Exercício removido");
  }

  if (t.hasAttribute("data-edit")) { const [id, i] = t.getAttribute("data-edit").split("|"); return editSheet(id, +i); }
  if (t.hasAttribute("data-saveedit")) {
    const [id, i] = t.getAttribute("data-saveedit").split("|");
    const sets = [];
    document.querySelectorAll('#sheet input[data-ed="w"]').forEach((inp, k) => {
      const r = document.querySelector(`#sheet input[data-ed="r"][data-k="${k}"]`);
      const tb = document.querySelector(`#sheet button[data-edtec="${k}"]`);
      const wv = parseFloat(inp.value), rv = parseInt(r && r.value, 10);
      sets.push({ w: isNaN(wv) ? 0 : wv, r: isNaN(rv) ? 0 : rv, t: tb ? tb.getAttribute("data-k") : "" });
    });
    logs[id][+i].sets = sets;
    logs[id][+i].loc = document.getElementById("edloc").value.trim();
    save(LS.logs, logs); closeSheet(); render(); return toast("Sessão atualizada");
  }
  if (t.hasAttribute("data-del")) {
    const [id, i] = t.getAttribute("data-del").split("|");
    if (t.dataset.confirm !== "1") { t.dataset.confirm = "1"; t.textContent = "Confirmar?"; return; }
    logs[id].splice(+i, 1);
    if (!logs[id].length) { delete logs[id]; save(LS.logs, logs); return go("h"); }
    save(LS.logs, logs); render(); return toast("Sessão apagada");
  }

  if (t.hasAttribute("data-save")) return saveSession(t.getAttribute("data-save"));
  if (t.hasAttribute("data-clear")) {
    document.querySelectorAll(".sets input").forEach(i => i.value = "");
    document.querySelectorAll(".done.on").forEach(b => b.classList.remove("on"));
    return toast("Campos limpos");
  }
  if (t.hasAttribute("data-done")) {
    t.classList.toggle("on");
    if (t.classList.contains("on")) Timer.start(parseInt(t.getAttribute("data-rest"), 10) || 90, "Descanso · " + t.getAttribute("data-nome"));
    return;
  }
});

/* ------------------------------------------------ router */
function go(hash) { location.hash = hash; }
function render() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "h") viewHistory();
  else if (h === "v") viewVolume();
  else if (h.startsWith("hx/")) viewExercise(h.slice(3));
  else if (h.startsWith("w/")) viewWorkout(h.slice(2));
  else viewHome();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", () => { closeSheet(); render(); });
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
