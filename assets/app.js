/* SPIN Tenis de Mesa — sitio estático. Datos: data/club.json y data/players/<id>.json */
(() => {
  "use strict";
  const $app = document.getElementById("app");
  const TMT = "https://www.tenisdemesaparatodos.com";
  const FET = "https://fetemba.bsweb.com.ar";
  const CATS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "8va"];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  let CLUB = null;
  const cache = {};
  
  // ---------- helpers
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (n == null || n === "" ? "–" : Number(n).toLocaleString("es-AR"));
  const pct = (g, p) => (p ? Math.round((100 * g) / p) : null);
  const fdate = (d) => { if (!d) return "–"; const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };
  const niceName = (n) => { const [s, g] = String(n).split(","); return g ? `${g.trim()} ${s.trim()}` : n; };
  const initials = (n) => { const [s, g] = String(n).split(","); return ((g || "").trim()[0] || "") + (s.trim()[0] || ""); };
  const catBadge = (c) => (c ? `<span class="badge c${esc(c)}">${esc(c)}</span>` : "");
  const signed = (v) => (v == null ? "–" : v > 0 ? `<span class="up">+${v}</span>` : v < 0 ? `<span class="down">${v}</span>` : "0");
  const form = (f) => `<span class="form">${(f || []).map((x) => `<i class="${x}">${x}</i>`).join("")}</span>`;
  const plink = (id, name) => `<a class="pname" href="#/jugador/${esc(id)}">${esc(name)}</a>`;
  const srcBadges = (src) => (src || []).map((s) => `<span class="badge src ${s}">${s === "tmt" ? "TMT" : "FETEMBA"}</span>`).join(" ");
  const medal = (p) => (p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : "");
  const getJSON = async (u) => { if (cache[u]) return cache[u]; const r = await fetch(u); if (!r.ok) throw new Error(u); return (cache[u] = await r.json()); };
  const player = async (id) => { const all = await getJSON("data/players.json"); if (!all[id]) throw new Error(id); return all[id]; };
  const byId = (id) => CLUB.players.find((p) => p.id === id);
  const spark = (vals, w = 90, h = 26) => {
    if (!vals || vals.length < 2) return "";
    const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
    const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - mn) / r) * (h - 4)).toFixed(1)}`).join(" ");
    const up = vals[vals.length - 1] >= vals[0];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${up ? css("--ok") : css("--mal")}" stroke-width="1.8" points="${pts}"/></svg>`;
  };
  const tile = (v, l, s = "") => `<div class="tile"><div class="l">${l}</div><div class="v num">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const killCharts = () => {};
  // Gráficos SVG livianos (sin dependencias)
  const W = 640, H = 250, PL = 46, PR = 12, PT = 12, PB = 30;
  const niceTicks = (mn, mx, n = 5) => {
    const span = mx - mn || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= step0) || step0;
    const lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step, out = [];
    for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  };
  const axes = (ticks, y, labels, x) => {
    const g = css("--linea"), ink = css("--gris");
    let o = ticks.map((t) => `<line x1="${PL}" x2="${W - PR}" y1="${y(t)}" y2="${y(t)}" stroke="${g}"/><text x="${PL - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="${ink}">${fmt(t)}</text>`).join("");
    const every = Math.max(1, Math.ceil(labels.length / 7));
    o += labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && !(i !== labels.length - 1 && labels.length - 1 - i < every && i % every === 0 && i !== 0 && false)
      ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${ink}">${esc(l)}</text>` : "").join("");
    return o;
  };
  function lineChart(el, labels, vals, { color = css("--azul"), area = "rgba(116,172,223,.18)", tips = null, dots = true } = {}) {
    if (!el || vals.length < 1) return;
    const mn = Math.min(...vals), mx = Math.max(...vals), pad = (mx - mn) * 0.1 || 20;
    const ticks = niceTicks(mn - pad, mx + pad);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const x = (i) => PL + (vals.length === 1 ? (W - PL - PR) / 2 : (i / (vals.length - 1)) * (W - PL - PR));
    const y = (v) => PT + (1 - (v - y0) / (y1 - y0 || 1)) * (H - PT - PB);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${axes(ticks, y, labels, x)}
      <polygon points="${x(0)},${y(y0)} ${pts.join(" ")} ${x(vals.length - 1)},${y(y0)}" fill="${area}"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>
      ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${dots ? 3.5 : 0}" fill="${color}"/><rect x="${x(i) - (W / vals.length) / 2}" y="${PT}" width="${W / vals.length}" height="${H - PT - PB}" fill="transparent"><title>${esc(tips ? tips[i] : labels[i] + ": " + v)}</title></rect>`).join("")}</svg>`;
  }
  function barChart(el, labels, series, { stacked = true } = {}) {
    if (!el || !labels.length) return;
    const tot = labels.map((_, i) => stacked ? series.reduce((a, s) => a + (s.data[i] || 0), 0) : Math.max(...series.map((s) => s.data[i] || 0)));
    const ticks = niceTicks(0, Math.max(...tot, 1), 4);
    const y1 = ticks[ticks.length - 1];
    const bw = (W - PL - PR) / labels.length;
    const x = (i) => PL + bw * (i + 0.5);
    const y = (v) => PT + (1 - v / y1) * (H - PT - PB);
    let bars = "";
    labels.forEach((l, i) => {
      let acc = 0;
      series.forEach((s) => {
        const v = s.data[i] || 0; if (!v) return;
        const top = y(acc + v), bot = y(acc); acc += v;
        bars += `<rect x="${x(i) - bw * 0.34}" y="${top}" width="${bw * 0.68}" height="${Math.max(0, bot - top)}" rx="3" fill="${s.color}"><title>${esc(l)} · ${esc(s.label || "")} ${v}</title></rect>`;
      });
      if (series.length === 1) bars += `<text x="${x(i)}" y="${y(tot[i]) - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="${css("--tinta")}">${tot[i]}</text>`;
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("")}</div>` : "";
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${axes(ticks, y, labels.map(String), x)}${bars}</svg>${legend}`;
  }

  // ---------- views
  function viewInicio() {
    const s = CLUB.stats;
    const top = CLUB.players.filter((p) => p.rating).slice(0, 10);
    const hot = CLUB.players.filter((p) => p.delta != null && p.pj12 >= 5).sort((a, b) => b.delta - a.delta).slice(0, 6);
    const best12 = CLUB.players.filter((p) => p.pj12 >= 15).sort((a, b) => b.wr12 - a.wr12).slice(0, 6);
    const active = CLUB.players.filter((p) => p.tor12).sort((a, b) => b.tor12 - a.tor12).slice(0, 6);
    const tours = CLUB.tournaments.slice(0, 6);
    const y1 = s.y1;
    $app.innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <img src="assets/escudo.png" alt="Escudo SPIN">
        <div><h1>SPIN Tenis de Mesa</h1>
        <p>Villa Crespo · Villa Pueyrredón · Saavedra — CABA. Plantel, ratings y estadísticas de todo el club en el circuito TMT y en FETEMBA.</p></div>
      </div>
      <div class="grid tiles">
        ${tile(fmt(s.total_players), "Jugadores", `${s.tmt_players} en TMT · ${s.fet_players} en FETEMBA`)}
        ${tile(CLUB.tmt_rank ? CLUB.tmt_rank + "°" : "–", "Ranking de clubes TMT", `Rating total ${fmt(s.tmt_rating_total)}`)}
        ${tile(fmt(s.tmt_rating_avg), "Rating promedio TMT", `Edad promedio ${s.avg_age ?? "–"} años`)}
        ${tile(fmt(y1.partidos), "Partidos último año", `${pct(y1.ganados, y1.partidos)}% ganados`)}
        ${tile(fmt(y1.p1), "Títulos último año", `${fmt(y1.p1 + y1.p2 + y1.p3)} podios`)}
      </div>
    </section>

    <div class="section grid g2">
      <div class="card">
        <div class="card-head"><h3>Top 10 del club · TMT</h3><a href="#/jugadores">Ver todos →</a></div>
        <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Jugador</th><th>Cat.</th><th class="r">Rating</th><th>Tendencia</th></tr></thead><tbody>
        ${top.map((p, i) => `<tr><td class="num">${i + 1}</td><td>${plink(p.id, p.name)}</td><td>${catBadge(p.cat)}</td><td class="r num"><b>${fmt(p.rating)}</b></td><td>${spark(p.spark)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="card">
        <h3>Plantel por categoría (TMT)</h3>
        <div id="chCats"></div>
        <p class="small muted">Rating total del club: <b>${fmt(s.tmt_rating_total)}</b> · ${fmt(s.tot.partidos)} partidos y ${fmt(s.tot.p1)} títulos en la historia del circuito.</p>
      </div>
    </div>

    <div class="section grid g3">
      <div class="card"><h3>📈 En racha</h3><p class="small muted">Mayor suba de rating en los últimos 20 torneos.</p>
        <ul class="list">${hot.map((p) => `<li><span class="grow ellipsis">${plink(p.id, p.name)}</span>${signed(p.delta)}</li>`).join("")}</ul></div>
      <div class="card"><h3>🎯 Efectividad</h3><p class="small muted">% de partidos ganados en el último año (mín. 15).</p>
        <ul class="list">${best12.map((p) => `<li><span class="grow ellipsis">${plink(p.id, p.name)}</span><b class="num">${p.wr12}%</b></li>`).join("")}</ul></div>
      <div class="card"><h3>🏓 Los más activos</h3><p class="small muted">Torneos jugados en el último año.</p>
        <ul class="list">${active.map((p) => `<li><span class="grow ellipsis">${plink(p.id, p.name)}</span><b class="num">${p.tor12}</b></li>`).join("")}</ul></div>
    </div>

    <div class="section grid g2">
      <div class="card"><div class="card-head"><h3>Últimos torneos con SPIN</h3><a href="#/torneos">Ver más →</a></div>
        <ul class="list">${tours.map(tourItem).join("")}</ul></div>
      <div class="card"><h3>⚡ Batacazos</h3><p class="small muted">Victorias ante rivales de mucho mayor rating.</p>
        <ul class="list">${CLUB.upsets.slice(0, 7).map((u) => `<li><span class="grow"><div class="ellipsis">${plink(u.id, u.name)} <span class="muted">venció a</span> ${esc(u.op)} <span class="muted small">(${esc(u.oc)})</span></div>
          <div class="small muted ellipsis">${fdate(u.date)} · ${esc(u.torneo)}</div></span><span class="up num">+${u.diff}</span></li>`).join("")}</ul></div>
    </div>`;
    const cnt = CATS.map((c) => s.cats[c] || 0);
    barChart(document.getElementById("chCats"), CATS, [{ data: cnt, color: css("--celeste"), label: "Jugadores" }]);
  }

  const tourItem = (t) => `<li><span class="grow"><div class="ellipsis"><a href="${TMT}/partidos_xtorneo.asp?codigo=${esc(t.tid)}" target="_blank" rel="noopener">${esc(t.name)}</a></div>
      <div class="small muted">${fdate(t.date)} · ${t.players.length} jugador${t.players.length === 1 ? "" : "es"} · ${t.w}G–${t.l}P</div></span>
      <span class="small ellipsis" style="max-width:40%">${t.players.slice(0, 3).map((p) => esc(niceName(p.name).split(" ")[0] + " " + p.name.split(",")[0])).join(", ")}${t.players.length > 3 ? "…" : ""}</span></li>`;

  // ----- jugadores
  const listState = { q: "", cat: "", src: "", sort: "rating", asc: false };
  function viewJugadores() {
    const cols = [
      ["clubPos", "#", "r"], ["name", "Jugador"], ["cat", "Cat. TMT"], ["rating", "Rating TMT", "r"], ["rankPos", "Pos. TMT", "r"],
      ["wr", "% Gan. total", "r"], ["wr12", "% Gan. 12m", "r"], ["pj", "Partidos", "r"], ["pod", "Podios", "r"], ["delta", "Var. 20 torneos", "r"],
      ["fr", "Rating FETEMBA", "r"], ["fcat", "Cat. FET", ""], ["ultimo", "Último torneo", ""],
    ];
    $app.innerHTML = `
      <div class="section"><h1>Jugadores</h1>
      <p class="muted">Todos los jugadores del club en TMT y en el padrón de FETEMBA. Tocá un nombre para ver su ficha completa.</p>
      <div class="filters">
        <input id="q" type="search" placeholder="Buscar jugador…" value="${esc(listState.q)}">
        <select id="src"><option value="">TMT y FETEMBA</option><option value="tmt">Solo TMT</option><option value="fet">Solo FETEMBA</option><option value="both">En ambos</option></select>
      </div>
      <div class="chips" id="cats"><button class="chip" data-c="">Todas</button>${CATS.map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join("")}</div>
      <div class="card" style="margin-top:14px;padding:6px 8px"><div class="tbl-wrap"><table id="tbl"><thead><tr>${cols.map(([k, l, a]) => `<th data-k="${k}" class="${a || ""}">${l}</th>`).join("")}</tr></thead><tbody></tbody></table></div></div>
      <p class="small muted" id="count"></p></div>`;
    const tb = $app.querySelector("tbody");
    const draw = () => {
      const q = listState.q.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      let rows = CLUB.players.filter((p) =>
        (!q || p.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(q)) &&
        (!listState.cat || p.cat === listState.cat) &&
        (!listState.src || (listState.src === "both" ? p.src.length === 2 : listState.src === "tmt" ? p.src.includes("tmt") : p.src.includes("fet"))));
      const k = listState.sort, dir = listState.asc ? 1 : -1;
      rows = rows.slice().sort((a, b) => {
        let x = a[k], y = b[k];
        if (k === "cat") { x = x ? CATS.indexOf(x) : 99; y = y ? CATS.indexOf(y) : 99; return (x - y) * -dir; }
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return typeof x === "string" ? x.localeCompare(y) * dir : (x - y) * dir;
      });
      tb.innerHTML = rows.map((p) => `<tr>
        <td class="r num muted">${p.clubPos ?? ""}</td>
        <td>${plink(p.id, p.name)} ${p.src.length === 1 && p.src[0] === "fet" ? srcBadges(p.src) : ""}</td>
        <td>${catBadge(p.cat)}</td><td class="r num"><b>${fmt(p.rating)}</b></td><td class="r num">${fmt(p.rankPos)}</td>
        <td class="r num">${p.wr != null ? p.wr + "%" : "–"}</td><td class="r num">${p.wr12 != null ? p.wr12 + "%" : "–"}</td>
        <td class="r num">${fmt(p.pj)}</td><td class="r num">${fmt(p.pod)}</td><td class="r num">${signed(p.delta)}</td>
        <td class="r num">${fmt(p.fr)}</td><td>${p.fcat ? `<span class="badge fet">${esc(p.fcat)}</span>` : "–"}</td><td class="num">${fdate(p.ultimo)}</td></tr>`).join("");
      $app.querySelectorAll("th").forEach((th) => { th.classList.toggle("sorted", th.dataset.k === k); th.classList.toggle("asc", th.dataset.k === k && listState.asc); });
      $app.querySelectorAll("#cats .chip").forEach((c) => c.classList.toggle("on", c.dataset.c === listState.cat));
      document.getElementById("count").textContent = `${rows.length} jugadores`;
    };
    document.getElementById("src").value = listState.src;
    $app.querySelector("#q").addEventListener("input", (e) => { listState.q = e.target.value; draw(); });
    $app.querySelector("#src").addEventListener("change", (e) => { listState.src = e.target.value; draw(); });
    $app.querySelector("#cats").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { listState.cat = c.dataset.c; draw(); } });
    $app.querySelector("thead").addEventListener("click", (e) => {
      const th = e.target.closest("th"); if (!th) return;
      if (listState.sort === th.dataset.k) listState.asc = !listState.asc; else { listState.sort = th.dataset.k; listState.asc = th.dataset.k === "name" || th.dataset.k === "clubPos" || th.dataset.k === "rankPos"; }
      draw();
    });
    draw();
  }

  // ----- jugador
  async function viewJugador(id) {
    $app.innerHTML = `<div class="loading">Cargando jugador…</div>`;
    let p;
    try { p = await player(id); } catch (e) { $app.innerHTML = `<div class="section"><h2>Jugador no encontrado</h2><a href="#/jugadores">Volver</a></div>`; return; }
    const s = byId(id) || {};
    const t = p.tmt, f = p.fet;
    const eq = p.equipo || {};
    const statBlock = (st) => {
      if (!st) return "";
      const wr = pct(st.ganados, st.partidos);
      return `<div class="grid tiles">
        ${tile(fmt(st.torneos), "Torneos")}${tile(fmt(st.partidos), "Partidos")}
        ${tile(wr != null ? wr + "%" : "–", "Efectividad", `${fmt(st.ganados)}G · ${fmt(st.partidos - st.ganados)}P`)}
        ${tile(fmt(st.p1), "Títulos 🥇")}${tile(fmt(st.p2), "Finales perdidas 🥈")}${tile(fmt(st.p3), "Semifinales 🥉")}
      </div><div class="bar" style="margin-top:12px"><span style="width:${wr || 0}%;background:var(--ok)"></span><span style="width:${100 - (wr || 0)}%;background:var(--mal);opacity:.7"></span></div>`;
    };
    $app.innerHTML = `
    <div class="section">
      <a href="#/jugadores" class="small">← Jugadores</a>
      <div class="phead" style="margin-top:10px">
        <div class="avatar">${esc(initials(p.name))}</div>
        <div style="flex:1;min-width:220px">
          <h1 style="margin-bottom:6px">${esc(niceName(p.name))}</h1>
          <div class="meta">${t ? catBadge(t.cat) : ""} ${f && f.cat ? `<span class="badge fet">FETEMBA ${esc(f.cat)}</span>` : ""} ${srcBadges(p.src)}
            ${f && f.club && !f.spin ? `<span class="small muted">· Federado por ${esc(f.club)}</span>` : ""}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${t ? `<a class="btn ghost" target="_blank" rel="noopener" href="${TMT}/jugadores_ficha.asp?codigo=${esc(t.code)}">Ficha TMT ↗</a>` : ""}
          ${f ? `<a class="btn ghost" target="_blank" rel="noopener" href="${FET}/jugadores/${esc(f.id)}">Ficha FETEMBA ↗</a>` : ""}
          <a class="btn" href="#/comparar?a=${esc(id)}">Comparar</a>
        </div>
      </div>
    </div>

    <div class="grid tiles section">
      ${t ? tile(fmt(t.rating), "Rating TMT", t.rankPos ? `Puesto ${fmt(t.rankPos)} del ranking` : "") : ""}
      ${t ? tile(`${t.clubPos}°`, "Posición en SPIN", `de ${CLUB.stats.tmt_players} jugadores`) : ""}
      ${t ? tile(signed(t.recent.delta), "Variación", "últimos 20 torneos") : ""}
      ${f ? tile(fmt(f.rating), "Rating FETEMBA", f.pos ? `Puesto ${fmt(f.pos)} · ${esc(f.cat || "")}` : "") : ""}
      ${f && f.res ? tile(fmt(f.res.mejor_puntos), "Mejor rating FETEMBA", f.res.mejor_puntos_fecha ? fdate(f.res.mejor_puntos_fecha) : "") : ""}
      ${f && f.res ? tile(f.res.mejor_posicion ? f.res.mejor_posicion + "°" : "–", "Mejor puesto FETEMBA") : ""}
    </div>

    ${t ? `
    <div class="section grid g2">
      <div class="card">
        <div class="card-head"><h3>Estadísticas TMT</h3>
          <div class="tabs" id="stTabs"><button data-k="tot" class="on">Totales</button><button data-k="y1">Último año</button><button data-k="m6">6 meses</button></div></div>
        <div id="stBox">${statBlock(t.tot)}</div>
        <p class="small muted" style="margin-top:10px">En el circuito desde ${fdate(t.ingreso)} · último torneo ${fdate(t.ultimo)}</p>
      </div>
      <div class="card">
        <h3>Evolución del rating TMT</h3>
        <div id="chT"></div>
        <p class="small muted">Últimos ${t.tours.length} torneos.</p>
      </div>
    </div>
    <div class="section grid g3">
      <div class="card"><h3>Forma reciente</h3>${form(t.form)}
        <dl class="kv" style="margin-top:14px">
          <dt>Últimos ${t.tours.length} torneos</dt><dd>${t.recent.w}G – ${t.recent.l}P (${pct(t.recent.w, t.recent.w + t.recent.l) ?? "–"}%)</dd>
          <dt>Sets</dt><dd>${t.recent.sets_w} – ${t.recent.sets_l}</dd>
          <dt>Partidos a 5 sets</dt><dd>${t.recent.dec_w}G – ${t.recent.dec_l}P</dd>
        </dl></div>
      <div class="card"><h3>Mejores victorias</h3>
        <ul class="list">${t.upsets.length ? t.upsets.map((u) => `<li><span class="grow"><div class="ellipsis">${esc(u.op)} <span class="muted small">(${esc(u.oc)}) · ${fmt(u.or)}</span></div><div class="small muted ellipsis">${fdate(u.date)} · ${esc(u.res)}</div></span>${u.diff > 0 ? `<span class="up num">+${u.diff}</span>` : ""}</li>`).join("") : `<li class="muted">Sin datos</li>`}</ul></div>
      <div class="card"><h3>Material</h3>
        <dl class="kv"><dt>Madera</dt><dd>${esc(eq.madera) || "–"}</dd><dt>Goma drive</dt><dd>${esc(eq.drive) || "–"}</dd><dt>Goma revés</dt><dd>${esc(eq.reves) || "–"}</dd><dt>Mano hábil</dt><dd>${esc(eq.mano) || "–"}</dd></dl></div>
    </div>
    <div class="section"><h2>Últimos torneos (TMT)</h2>
      ${t.tours.map((x, i) => `<details class="tour" ${i === 0 ? "open" : ""}><summary>
        <span class="num muted small" style="width:78px">${fdate(x.date)}</span><span class="t">${esc(x.name)}</span>
        <span class="small">${x.w}G–${x.l}P</span><span class="num">${signed(x.var)}</span></summary>
        <div class="body">${x.m.map((m) => `<div class="match"><span class="wl ${m.w ? "G" : "P"}">${m.w ? "G" : "P"}</span>
          <span class="ellipsis">${m.spin ? plink(m.opc, m.op) : esc(m.op)} <span class="muted small">(${esc(m.oc)}) · ${fmt(m.or)}</span><br><span class="sets">${esc(m.ph)} · ${m.sets.map(esc).join("  ")}</span></span>
          <b class="num">${esc(m.res)}</b><span class="num small">${signed(m.v)}</span></div>`).join("")}</div></details>`).join("")}
    </div>` : ""}

    ${f ? `
    <div class="section grid g2">
      <div class="card"><h3>FETEMBA · Historial de rating</h3><div id="chF"></div>
        <p class="small muted">${esc(f.ranking || "")}${f.publicado ? " al " + fdate(f.publicado) : ""}.</p></div>
      <div class="card"><h3>FETEMBA · Resumen</h3>
        ${f.res ? `<div class="grid tiles">
          ${tile(`${fmt(f.res.ganados)}–${fmt(f.res.perdidos)}`, "Individuales G–P", `${pct(f.res.ganados, f.res.partidos) ?? "–"}% efectividad`)}
          ${tile(`${fmt(f.res.sets_ganados)}–${fmt(f.res.sets_perdidos)}`, "Sets")}
          ${tile(fmt(f.res.titulos), "Títulos", `${fmt(f.res.finales)} finales`)}
          ${tile(fmt(f.res.podios), "Podios", `${fmt(f.res.eventos)} torneos`)}
        </div>
        <p class="small muted" style="margin-top:10px">Juega desde ${fdate(f.res.primer_partido)} · último partido ${fdate(f.res.ultimo_partido)}</p>
        ${(f.clases || []).length ? `<dl class="kv" style="margin-top:8px">${f.clases.map((c) => `<dt>${{ IND: "Individuales", DOB: "Dobles", EQU: "Equipos" }[c.clase] || esc(c.clase)}</dt><dd>${c.ganados}G – ${c.perdidos}P · ${pct(c.ganados, c.partidos) ?? "–"}%${c.titulos ? ` · ${c.titulos} título${c.titulos > 1 ? "s" : ""}` : ""}</dd>`).join("")}</dl>` : ""}` : `<p class="muted">Sin historial.</p>`}
      </div>
    </div>
    <div class="section grid g2">
      <div class="card"><h3>FETEMBA · Partidos por año</h3><div id="chY"></div></div>
      <div class="card"><h3>FETEMBA · Palmarés</h3>
        <ul class="list">${(f.pal || []).length ? f.pal.slice(0, 12).map((x) => `<li><span class="medal">${medal(x.pu)}</span><span class="grow"><div class="ellipsis"><b>${esc(x.ev)}</b> · ${esc(x.cat)}</div><div class="small muted">${fdate(x.f)} · ${esc(x.tipo)}</div></span></li>`).join("") : `<li class="muted">Sin podios registrados</li>`}</ul></div>
    </div>` : ""}
    `;
    // tabs
    const tabs = document.getElementById("stTabs");
    tabs && tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      document.getElementById("stBox").innerHTML = statBlock(t[b.dataset.k]);
    });
    if (t && t.tours.length) {
      const tt = t.tours.slice().reverse().filter((x) => x.post != null);
      lineChart(document.getElementById("chT"), tt.map((x) => fdate(x.date).slice(0, 5)), tt.map((x) => x.post),
        { tips: tt.map((x) => `${fdate(x.date)} · ${x.name}: ${x.post} (${x.var > 0 ? "+" : ""}${x.var})`) });
    }
    if (f && f.hist.length) {
      lineChart(document.getElementById("chF"), f.hist.map((h) => h[0].slice(0, 4)), f.hist.map((h) => h[1]),
        { color: "#B23A3A", area: "rgba(178,58,58,.10)", dots: false, tips: f.hist.map((h) => `${fdate(h[0])}: ${h[1]} pts${h[2] ? " · puesto " + h[2] : ""}`) });
    }
    if (f && f.years.length) {
      barChart(document.getElementById("chY"), f.years.map((y) => String(y.y).slice(2)), [
        { label: "Ganados", data: f.years.map((y) => y.g), color: css("--ok") },
        { label: "Perdidos", data: f.years.map((y) => y.p - y.g), color: css("--celeste") }]);
    }
  }

  // ----- torneos
  function viewTorneos() {
    $app.innerHTML = `<div class="section"><h1>Torneos</h1>
      <p class="muted">Torneos recientes del circuito TMT donde jugó al menos un jugador de SPIN.</p>
      ${CLUB.tournaments.map((t, i) => `<details class="tour" ${i < 2 ? "open" : ""}><summary>
        <span class="num muted small" style="width:78px">${fdate(t.date)}</span><span class="t">${esc(t.name)}</span>
        <span class="small">${t.players.length} jug. · ${t.w}G–${t.l}P</span></summary>
        <div class="body"><div class="tbl-wrap"><table><thead><tr><th>Jugador</th><th class="r">G</th><th class="r">P</th><th class="r">Rating</th></tr></thead><tbody>
        ${t.players.map((p) => `<tr><td>${plink(p.id, p.name)}</td><td class="r num">${p.w}</td><td class="r num">${p.l}</td><td class="r num">${signed(p.var)}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="small"><a href="${TMT}/partidos_xtorneo.asp?codigo=${esc(t.tid)}" target="_blank" rel="noopener">Ver resultados completos en TMT ↗</a></p></div></details>`).join("")}
      <h2 style="margin-top:32px">Clásicos SPIN</h2><p class="muted">Partidos recientes entre jugadores del club.</p>
      <div class="card"><ul class="list">${CLUB.derbies.slice(0, 25).map((d) => `<li><span class="grow"><div class="ellipsis">${plink(d.wid, d.winner)} <b class="num">${esc(d.res)}</b> ${plink(d.lid, d.loser)}</div><div class="small muted ellipsis">${fdate(d.date)} · ${esc(d.torneo)}</div></span></li>`).join("")}</ul></div>
    </div>`;
  }

  // ----- comparar
  async function viewComparar(params) {
    const opts = CLUB.players.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
    const a = params.get("a") || CLUB.players[0].id, b = params.get("b") || CLUB.players[1].id;
    $app.innerHTML = `<div class="section"><h1>Comparar jugadores</h1>
      <div class="filters"><select id="pa">${opts}</select><select id="pb">${opts}</select></div><div id="cmp" class="card"><div class="loading">Cargando…</div></div></div>`;
    const pa = document.getElementById("pa"), pb = document.getElementById("pb");
    pa.value = a; pb.value = b;
    const go = () => { location.hash = `#/comparar?a=${encodeURIComponent(pa.value)}&b=${encodeURIComponent(pb.value)}`; };
    pa.onchange = go; pb.onchange = go;
    const [A, B] = await Promise.all([player(a), player(b)]);
    const row = (lab, x, y, better = "hi", f = fmt) => {
      const bx = x != null && y != null && (better === "hi" ? x > y : x < y), by = x != null && y != null && (better === "hi" ? y > x : y < x);
      return `<div class="cmp-row"><div class="a">${bx ? `<b class="best">${f(x)}</b>` : f(x)}</div><div class="lab">${lab}</div><div>${by ? `<b class="best">${f(y)}</b>` : f(y)}</div></div>`;
    };
    const g = (P, path) => path.split(".").reduce((o, k) => (o == null ? null : o[k]), P);
    const wr = (st) => (st ? pct(st.ganados, st.partidos) : null);
    const pc = (v) => (v == null ? "–" : v + "%");
    // head to head (from recent TMT matches)
    const h2h = [];
    (A.tmt?.tours || []).forEach((t) => t.m.forEach((m) => { if (m.opc === b) h2h.push({ date: t.date, torneo: t.name, w: m.w, res: m.res }); }));
    const hw = h2h.filter((x) => x.w).length;
    document.getElementById("cmp").innerHTML = `
      <div class="cmp-row" style="border-bottom:2px solid var(--linea)"><div class="a"><h3 style="margin:0">${plink(A.id, niceName(A.name))}</h3></div><div class="lab">vs</div><div><h3 style="margin:0">${plink(B.id, niceName(B.name))}</h3></div></div>
      ${row("Categoría TMT", A.tmt?.cat, B.tmt?.cat, "none", (v) => v ? catBadge(v) : "–")}
      ${row("Rating TMT", g(A, "tmt.rating"), g(B, "tmt.rating"))}
      ${row("Puesto ranking TMT", g(A, "tmt.rankPos"), g(B, "tmt.rankPos"), "lo")}
      ${row("Partidos (total)", g(A, "tmt.tot.partidos"), g(B, "tmt.tot.partidos"))}
      ${row("% ganados (total)", wr(A.tmt?.tot), wr(B.tmt?.tot), "hi", pc)}
      ${row("% ganados (12 meses)", wr(A.tmt?.y1), wr(B.tmt?.y1), "hi", pc)}
      ${row("Torneos (12 meses)", g(A, "tmt.y1.torneos"), g(B, "tmt.y1.torneos"))}
      ${row("Títulos TMT", g(A, "tmt.tot.p1"), g(B, "tmt.tot.p1"))}
      ${row("Podios TMT", A.tmt ? A.tmt.tot.p1 + A.tmt.tot.p2 + A.tmt.tot.p3 : null, B.tmt ? B.tmt.tot.p1 + B.tmt.tot.p2 + B.tmt.tot.p3 : null)}
      ${row("Var. últimos 20 torneos", g(A, "tmt.recent.delta"), g(B, "tmt.recent.delta"))}
      ${row("Rating FETEMBA", g(A, "fet.rating"), g(B, "fet.rating"))}
      ${row("Puesto FETEMBA", g(A, "fet.pos"), g(B, "fet.pos"), "lo")}
      ${row("Mejor rating FETEMBA", g(A, "fet.res.mejor_puntos"), g(B, "fet.res.mejor_puntos"))}
      ${row("Títulos FETEMBA", g(A, "fet.res.titulos"), g(B, "fet.res.titulos"))}
      <h3 style="margin-top:18px">Mano a mano reciente (TMT)</h3>
      ${h2h.length ? `<p><b>${hw}</b> – <b>${h2h.length - hw}</b> en los últimos torneos registrados.</p><ul class="list">${h2h.map((x) => `<li><span class="grow small">${fdate(x.date)} · ${esc(x.torneo)}</span><span class="wl ${x.w ? "G" : "P"}">${x.w ? "G" : "P"}</span><b class="num">${esc(x.res)}</b></li>`).join("")}</ul>` :
        `<p class="muted small">No se enfrentaron en los últimos torneos registrados. ${A.tmt && B.tmt ? `<a target="_blank" rel="noopener" href="${TMT}/partidos_headtohead.asp?codigo1=${esc(A.tmt.code)}">Ver head to head completo en TMT ↗</a>` : ""}</p>`}`;
  }

  // ----- club
  function viewClub() {
    const c = CLUB;
    $app.innerHTML = `<div class="section"><h1>El club</h1>
      <p class="muted" style="max-width:720px">SPIN Tenis de Mesa tiene sedes en distintos barrios de CABA, con clases para todos los niveles y edades, escuelita para chicos y chicas, turnos de partidos libres y torneos del circuito TMT. Está afiliado a FETEMBA.</p>
      <div class="grid g3 section">${c.sedes.map((s) => `<div class="card"><h3>📍 ${esc(s.nombre)}</h3><p style="margin:0"><b>${esc(s.dir)}</b><br><span class="muted">${esc(s.lugar)}</span></p><p class="small" style="margin-bottom:0">${esc(s.dias)}</p>
        <p class="small" style="margin:6px 0 0"><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.dir + ", CABA, Argentina")}">Ver en el mapa ↗</a></p></div>`).join("")}</div>
      <div class="grid g2">
        <div class="card"><h3>🕒 Horarios · Sede Villa Crespo</h3><p style="white-space:pre-line;margin:0">${esc(c.horarios || "Consultar por Instagram.")}</p>
          ${c.instalaciones ? `<p class="small muted">${esc(c.instalaciones)}</p>` : ""}${c.como_llegar ? `<p class="small muted">${esc(c.como_llegar)}</p>` : ""}</div>
        <div class="card"><h3>👥 Entrenadores</h3><ul class="list">${c.entrenadores.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
          <p style="margin-top:14px"><a class="btn" target="_blank" rel="noopener" href="${c.instagram}">Escribinos por Instagram</a></p>
          <p class="small muted">Club en <a target="_blank" rel="noopener" href="${TMT}/clubes_ampliar.asp?codigo=${c.tmt_code}">TMT ↗</a> y en <a target="_blank" rel="noopener" href="${FET}/clubes">FETEMBA ↗</a>.</p></div>
      </div>
      <div class="note section">Las estadísticas se toman automáticamente de los sitios públicos de TMT y FETEMBA. Algunos jugadores del club están federados en FETEMBA por otra institución; en su ficha se indica el club con el que figuran.</div>
    </div>`;
  }

  // ---------- router
  async function route() {
    killCharts();
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const parts = path.split("/").filter(Boolean);
    const r = parts[0] || "inicio";
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (r === "jugador" ? "jugadores" : r)));
    document.querySelector(".nav").classList.remove("open");
    window.scrollTo(0, 0);
    if (r === "jugadores") viewJugadores();
    else if (r === "jugador") await viewJugador(decodeURIComponent(parts[1] || ""));
    else if (r === "torneos") viewTorneos();
    else if (r === "comparar") await viewComparar(new URLSearchParams(qs || ""));
    else if (r === "club") viewClub();
    else viewInicio();
    const name = { jugadores: "Jugadores", torneos: "Torneos", comparar: "Comparar", club: "El club" }[r];
    document.title = r === "jugador" ? `${niceName(byId(decodeURIComponent(parts[1] || ""))?.name || "Jugador")} · SPIN` : name ? `${name} · SPIN Tenis de Mesa` : "SPIN Tenis de Mesa · Jugadores y estadísticas";
  }

  document.querySelector(".menu-btn").addEventListener("click", (e) => {
    const n = document.querySelector(".nav"); n.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", n.classList.contains("open"));
  });
  getJSON("data/club.json").then((c) => {
    CLUB = c;
    const d = c.updated ? new Date(c.updated) : null;
    document.getElementById("updated").textContent = d ? `Última actualización: ${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "";
    window.addEventListener("hashchange", route);
    route();
  }).catch(() => { $app.innerHTML = `<div class="loading">No se pudieron cargar los datos.</div>`; });
})();
