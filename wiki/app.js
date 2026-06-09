/* California Peptide Club — Peptide Topology + Peptide Pedia */
(function () {
  const D = window.PEPTIDE_DATA;
  const PEPTIDES = D.peptides;
  const CATS = D.categories;
  const STACKS = D.stacks;
  const HISTORY = D.history;
  const QUOTES = D.quotes;
  const byId = (id) => document.getElementById(id);
  const catById = (id) => CATS.find((c) => c.id === id);
  const pepById = (id) => PEPTIDES.find((p) => p.id === id);
  const pepByName = (name) => {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    return PEPTIDES.find(
      (p) => p.name.toLowerCase() === n ||
             p.id === n ||
             (p.aliases || []).some((a) => a.toLowerCase() === n)
    );
  };

  const SCORE_KEYS = [
    { key: "humanResearch", label: "Human research" },
    { key: "weightLoss", label: "Weight loss" },
    { key: "muscleGrowth", label: "Muscle growth" },
    { key: "sleep", label: "Sleep" },
    { key: "recovery", label: "Recovery" },
    { key: "hairSkin", label: "Hair / skin" },
    { key: "cognitive", label: "Cognitive" },
    { key: "sideEffectSeverity", label: "Side effects" },
  ];

  const GLP1_IDS = new Set(["semaglutide", "tirzepatide", "retatrutide"]);
  const CHEAP_OZEMPIC_URL = "https://www.cremieux.xyz/p/how-to-get-cheap-ozempic";

  /* ================== MODE TOGGLE ================== */
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.querySelectorAll(".mode-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.mode === mode)
    );
    if (mode === "pedia") {
      const id = (location.hash || "").replace(/^#\/pedia\//, "") || PEPTIDES[0].id;
      renderPedia(id);
    } else if (mode === "talk") {
      const m = (location.hash || "").match(/^#\/talk\/(\d+)/);
      const i = m ? parseInt(m[1], 10) : 0;
      renderTalk(i);
    }
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".mode-btn").forEach((b) =>
    b.addEventListener("click", () => setMode(b.dataset.mode))
  );

  /* ================== TABS (topology) ================== */
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      byId("view-" + btn.dataset.view).classList.add("active");
      window.scrollTo({ top: 200, behavior: "smooth" });
    });
  });

  /* ================== LEGEND ================== */
  function renderLegendCats() {
    byId("legend-cats").innerHTML = CATS.map(
      (c) => `<div class="legend-cat-row"><span class="legend-cat-dot" style="background:${c.color}"></span>${c.name}</div>`
    ).join("");
  }
  byId("legend-toggle").addEventListener("click", () => {
    byId("legend-panel").classList.toggle("collapsed");
  });

  /* ================== MARQUEE ================== */
  function renderMarquee() {
    const items = QUOTES.map((q) => `<span>“${q.text}”</span><span class="sep">◆</span>`).join("");
    byId("marquee").innerHTML = `<div class="marquee-track">${items}${items}</div>`;
  }

  /* ================== VIAL SVG ================== */
  function vialSvg(color, fillLevel, sizeClass) {
    const fillH = 60 * fillLevel;
    const fillY = 80 - fillH;
    const cls = sizeClass || "vial-svg";
    const gid = "g-" + Math.random().toString(36).slice(2, 8);
    return `
<svg class="${cls}" viewBox="0 0 56 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect x="20" y="2" width="16" height="6" rx="1.5" fill="#3a3f5e" stroke="#1a1d2e"/>
  <rect x="18" y="6" width="20" height="4" rx="1" fill="#aab1d0" stroke="#1a1d2e"/>
  <rect x="22" y="10" width="12" height="6" fill="rgba(120,130,160,0.2)" stroke="#2a2f4a"/>
  <rect x="10" y="16" width="36" height="68" rx="4" fill="rgba(255,255,255,0.04)" stroke="#2a2f4a"/>
  <rect x="12" y="${fillY}" width="32" height="${fillH}" rx="2" fill="url(#${gid})"/>
  <rect x="14" y="20" width="3" height="60" rx="1.5" fill="rgba(255,255,255,0.12)"/>
  <rect x="10" y="48" width="36" height="20" fill="rgba(255,255,255,0.85)" rx="1"/>
  <line x1="10" y1="52" x2="46" y2="52" stroke="#1a1d2e" stroke-width="0.5"/>
  <line x1="10" y1="64" x2="46" y2="64" stroke="#1a1d2e" stroke-width="0.5"/>
</svg>`;
  }

  /* ================== BUBBLE MAP (D3 force) ================== */
  function renderBubbleMap() {
    const svg = d3.select("#bubble-map");
    svg.selectAll("*").remove();
    const wrap = byId("bubble-map-wrap");
    const W = wrap.clientWidth;
    const H = 700;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    // Defs: glow filter
    const defs = svg.append("defs");
    defs.append("filter").attr("id", "glow").attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%")
      .html(`<feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);

    const hullLayer = svg.append("g").attr("class", "hull-layer");
    const labelLayer = svg.append("g").attr("class", "label-layer");
    const nodeLayer = svg.append("g").attr("class", "node-layer");

    // Position category centers — spread out to give labels room
    const CAT_LAYOUT = {
      ghs:       { fx: W * 0.24, fy: H * 0.28 },
      tissue:    { fx: W * 0.76, fy: H * 0.28 },
      longevity: { fx: W * 0.5,  fy: H * 0.56 },
      immune:    { fx: W * 0.24, fy: H * 0.80 },
      glp1:      { fx: W * 0.76, fy: H * 0.80 },
    };

    const nodes = PEPTIDES.map((p) => {
      const cat = catById(p.category);
      const tier = p.tier || "C";
      const r = ({ S: 32, A: 28, B: 24, C: 20, D: 18, F: 16 }[tier] || 20);
      return {
        id: p.id, name: p.name, color: cat.color, category: p.category, r,
        x: CAT_LAYOUT[p.category].fx + (Math.random() - 0.5) * 60,
        y: CAT_LAYOUT[p.category].fy + (Math.random() - 0.5) * 60,
      };
    });

    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX((d) => CAT_LAYOUT[d.category].fx).strength(0.16))
      .force("y", d3.forceY((d) => CAT_LAYOUT[d.category].fy).strength(0.16))
      .force("collide", d3.forceCollide((d) => d.r + 26).strength(0.95))
      .force("charge", d3.forceManyBody().strength(-40))
      .alpha(1).alphaDecay(0.02);

    // Hulls per category — pad generously so labels (rendered below circles) sit inside
    function pathForHull(nodesInCat) {
      if (!nodesInCat.length) return "";
      // expanded points: include points around each node accounting for its radius+label space
      const points = [];
      nodesInCat.forEach(n => {
        const labelPad = 22; // space for label below circle
        const r = n.r + 8;
        // sample 8 points around each node, with extra clearance below for the label
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const yPad = (Math.sin(a) > 0 ? labelPad : 0);
          points.push([n.x + Math.cos(a) * r, n.y + Math.sin(a) * (r + yPad)]);
        }
      });
      if (points.length < 3) {
        const cx = d3.mean(points, p => p[0]);
        const cy = d3.mean(points, p => p[1]);
        const r = 80;
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      }
      const hull = d3.polygonHull(points);
      if (!hull) return "";
      const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.85));
      return line(hull);
    }

    sim.on("tick", () => {
      const byCat = d3.group(nodes, d => d.category);
      const hulls = hullLayer.selectAll("path.bubble-hull").data(CATS, d => d.id);
      hulls.enter().append("path").attr("class", "bubble-hull")
        .attr("fill", d => d.color).attr("stroke", d => d.color)
        .merge(hulls)
        .attr("d", d => pathForHull(byCat.get(d.id) || []));

      // Category banner labels — placed above the hull
      const labels = labelLayer.selectAll("text.bubble-label").data(CATS, d => d.id);
      const enterL = labels.enter().append("text").attr("class", "bubble-label").attr("text-anchor", "middle");
      enterL.merge(labels)
        .attr("x", d => CAT_LAYOUT[d.id].fx)
        .attr("y", d => {
          const ns = byCat.get(d.id) || [];
          if (!ns.length) return CAT_LAYOUT[d.id].fy;
          const minY = d3.min(ns, n => n.y - n.r);
          return Math.max(24, minY - 22);
        })
        .attr("fill", d => d.color)
        .text(d => d.name);

      // Nodes — circle + label BELOW the circle for full names
      const sel = nodeLayer.selectAll("g.bubble-node").data(nodes, d => d.id);
      const enter = sel.enter().append("g").attr("class", "bubble-node").attr("data-id", d => d.id)
        .on("click", (_, d) => openModal(d.id));
      enter.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => d.color).attr("fill-opacity", 0.2)
        .attr("stroke", d => d.color).attr("stroke-width", 2)
        .attr("filter", "url(#glow)");
      enter.append("text")
        .attr("class", "bubble-node-label")
        .attr("text-anchor", "middle");
      const merged = enter.merge(sel);
      merged.attr("transform", d => `translate(${d.x},${d.y})`);
      merged.select("text.bubble-node-label")
        .attr("y", d => d.r + 14)
        .text(d => d.name);
    });

    // Drag
    const drag = d3.drag()
      .on("start", (event) => { if (!event.active) sim.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; })
      .on("drag", (event) => { event.subject.fx = event.x; event.subject.fy = event.y; })
      .on("end", (event) => { if (!event.active) sim.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; });
    nodeLayer.selectAll("g.bubble-node").call(drag);

    // re-bind drag once nodes are mounted
    setTimeout(() => nodeLayer.selectAll("g.bubble-node").call(drag), 200);
  }

  /* ================== CATEGORIES (rich detail below the map) ================== */
  function renderCategories() {
    const html = CATS.map((cat) => {
      const peps = PEPTIDES.filter((p) => p.category === cat.id);
      const vials = peps
        .map((p) => {
          const fill = p.scores && typeof p.scores.humanResearch === "number"
            ? Math.max(0.18, p.scores.humanResearch / 10) : 0.18;
          return `
<div class="vial" data-id="${p.id}" style="--cat-color:${cat.color};--cat-glow:${cat.color}55">
  ${vialSvg(cat.color, fill)}
  <div class="vial-label">${p.name}</div>
  <div class="vial-meta">
    <span class="tier-badge tier-${p.tier || "C"}">${p.tier || "C"}</span>
    ${p.cycled ? '<span class="cycled-icon" title="Commonly cycled">↻</span>' : ""}
  </div>
</div>`;
        })
        .join("");
      const stacksHtml = (cat.id === "glp1" ? [] : (cat.commonStacks || []))
        .map((s) => `
<div class="cat-stack-row">
  <div class="cat-stack-name" style="color:${cat.color}">${s.name}</div>
  <div class="cat-stack-purpose">${s.purpose || ""}</div>
</div>`)
        .join("");
      return `
<div class="category-block" style="--cat-color:${cat.color}">
  <div class="category-head">
    <div class="category-name">${cat.name}</div>
    <div class="category-desc">${cat.description}</div>
  </div>
  <div class="vial-grid">${vials}</div>
  ${stacksHtml ? `
  <div class="cat-stacks">
    <div class="cat-stacks-title">Commonly stacked</div>
    ${stacksHtml}
  </div>` : ""}
</div>`;
    }).join("");
    byId("categories").innerHTML = html;
    document.querySelectorAll(".vial").forEach((v) => {
      v.addEventListener("click", () => openModal(v.dataset.id));
    });
  }

  /* ================== VECTOR MAP ================== */
  function populateAxes() {
    const xs = byId("axis-x"), ys = byId("axis-y");
    xs.innerHTML = ys.innerHTML = SCORE_KEYS.map((s) => `<option value="${s.key}">${s.label}</option>`).join("");
    xs.value = "weightLoss"; ys.value = "muscleGrowth";
    xs.addEventListener("change", renderMap);
    ys.addEventListener("change", renderMap);
  }
  function renderMap() {
    const xKey = byId("axis-x").value, yKey = byId("axis-y").value;
    const xLabel = SCORE_KEYS.find((s) => s.key === xKey).label;
    const yLabel = SCORE_KEYS.find((s) => s.key === yKey).label;
    const W = 800, H = 600, M = 70;
    const plotW = W - M * 2, plotH = H - M * 2;
    const xToPx = (v) => M + (v / 10) * plotW;
    const yToPx = (v) => H - M - (v / 10) * plotH;

    let svg = "";
    for (let i = 0; i <= 10; i++) {
      const x = xToPx(i), y = yToPx(i);
      svg += `<line class="grid-line" x1="${x}" y1="${M}" x2="${x}" y2="${H - M}"/>`;
      svg += `<line class="grid-line" x1="${M}" y1="${y}" x2="${W - M}" y2="${y}"/>`;
      if (i % 2 === 0) {
        svg += `<text class="axis-text" x="${x}" y="${H - M + 16}" text-anchor="middle">${i}</text>`;
        svg += `<text class="axis-text" x="${M - 10}" y="${y + 4}" text-anchor="end">${i}</text>`;
      }
    }
    svg += `<line class="axis-line" x1="${M}" y1="${H - M}" x2="${W - M}" y2="${H - M}"/>`;
    svg += `<line class="axis-line" x1="${M}" y1="${M}" x2="${M}" y2="${H - M}"/>`;
    svg += `<text class="axis-title" x="${W / 2}" y="${H - 20}" text-anchor="middle">${xLabel} →</text>`;
    svg += `<text class="axis-title" transform="translate(20, ${H / 2}) rotate(-90)" text-anchor="middle">${yLabel} →</text>`;

    const placed = {};
    PEPTIDES.forEach((p) => {
      const xv = p.scores ? p.scores[xKey] : null;
      const yv = p.scores ? p.scores[yKey] : null;
      if (xv == null || yv == null) return; // skip unscored
      const key = `${xv}-${yv}`;
      placed[key] = (placed[key] || 0) + 1;
      const idx = placed[key] - 1;
      const angle = (idx * 137.5) * Math.PI / 180;
      const r = idx === 0 ? 0 : 8 + 4 * Math.sqrt(idx);
      const cx = xToPx(xv) + Math.cos(angle) * r;
      const cy = yToPx(yv) + Math.sin(angle) * r;
      const cat = catById(p.category);
      const npRing = p.isPeptide === false ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="none" stroke="#FF7A00" stroke-width="2"><title>Not technically a peptide</title></circle>` : "";
      svg += `<g>${npRing}<circle class="dot" cx="${cx}" cy="${cy}" r="7" fill="${cat.color}" fill-opacity="0.8" stroke="${cat.color}" data-id="${p.id}"></circle><text class="dot-label" x="${cx + 10}" y="${cy + 3}">${p.name}</text></g>`;
    });
    byId("vector-map").innerHTML = svg;
    document.querySelectorAll(".dot").forEach((d) => d.addEventListener("click", () => openModal(d.dataset.id)));
  }

  /* ================== STACKS ================== */
  function renderStacks() {
    byId("stacks-grid").innerHTML = STACKS.map((s) => {
      const pills = s.peptides.map((pid) => {
        const p = pepById(pid);
        if (!p) return "";
        const cat = catById(p.category);
        return `<span class="stack-peptide-pill" data-id="${pid}" style="border-color:${cat.color}55;color:${cat.color}">${p.name}</span>`;
      }).join("");
      const quote = s.notableQuote ? `<div class="stack-quote">“${s.notableQuote}”</div>` : "";
      return `
<div class="stack-card">
  <h3 class="stack-name">${s.name}</h3>
  <div class="stack-purpose">${s.purpose}</div>
  <div class="stack-peptides">${pills}</div>
  ${quote}
  <div class="stack-dosing">${s.dosing || ""}</div>
</div>`;
    }).join("");
    document.querySelectorAll(".stack-peptide-pill").forEach((el) =>
      el.addEventListener("click", () => openModal(el.dataset.id))
    );
  }

  /* ================== HISTORY ================== */
  function renderHistory() {
    byId("timeline").innerHTML = HISTORY.map(
      (h) =>
        `<div class="tl-item">
  <div class="tl-year">${h.year}</div>
  <div class="tl-event">${h.event}</div>
  <div class="tl-why">${h.whyItMatters || ""}</div>
</div>`
    ).join("");
  }

  /* ================== MODAL (topology mode) ================== */
  function openModal(pepId) {
    const p = pepById(pepId);
    if (!p) return;
    const cat = catById(p.category);
    const aliases = (p.aliases && p.aliases.length) ? p.aliases.join(" · ") : "";

    // Score rows — only render bars when score is a number > 1 OR sideEffectSeverity is anything;
    // otherwise show "no data" in muted text.
    const scoreRows = SCORE_KEYS.map((s) => {
      const raw = p.scores ? p.scores[s.key] : undefined;
      const v = (typeof raw === "number") ? raw : null;
      const cls = s.key === "sideEffectSeverity" ? " danger" : "";
      if (v == null) {
        return `<div class="score-row">
  <div class="score-label">${s.label}</div>
  <div class="score-na">no transcript-backed data</div>
  <div></div>
</div>`;
      }
      // hide the bar entirely when score === 1 (effectively "none")
      if (v === 1 && s.key !== "sideEffectSeverity") {
        return `<div class="score-row">
  <div class="score-label">${s.label}</div>
  <div class="score-na">~negligible</div>
  <div class="score-num">1</div>
</div>`;
      }
      return `<div class="score-row">
  <div class="score-label">${s.label}</div>
  <div class="score-bar"><div class="score-fill${cls}" style="width:${v * 10}%"></div></div>
  <div class="score-num">${v}</div>
</div>`;
    }).join("");

    const stacksContaining = STACKS.filter((s) => s.peptides.includes(pepId));
    const stackHtml = stacksContaining.length
      ? `<div class="modal-section"><div class="modal-section-title">Appears in stacks</div>
        <div>${stacksContaining.map((s) => `<span class="protocol-tag">${s.name}</span>`).join("")}</div></div>`
      : "";

    const transcripts = (p.transcripts || []).map((t) => `<span class="protocol-tag">${t.replace(/\.txt$/, "")}</span>`).join("");

    const videos = (p.informativeVideos || []).map((v) => {
      const url = typeof v === "string" ? v : v.url;
      const title = typeof v === "string" ? url : (v.title || url);
      return `<a class="video-link" href="${url}" target="_blank" rel="noopener"><span class="video-link-icon">▶ YT</span>${title}</a>`;
    }).join("");

    const cheap = GLP1_IDS.has(p.id)
      ? `<div class="cheap-ozempic">
          <div class="cheap-ozempic-title">💸 How to get cheap Ozempic / GLP-1s</div>
          <div>Crémieux's writeup is the canonical guide for sourcing semaglutide / tirzepatide / retatrutide affordably (compounding pharmacies, telehealth, pricing math).</div>
          <div style="margin-top:8px"><a href="${CHEAP_OZEMPIC_URL}" target="_blank" rel="noopener">cremieux.xyz/p/how-to-get-cheap-ozempic →</a></div>
         </div>` : "";

    byId("modal-body").innerHTML = `
<span class="modal-cat-pill" style="background:${cat.color}1a;color:${cat.color};border:1px solid ${cat.color}55">${cat.name}</span>
<h2>${p.name}</h2>
${aliases ? `<div class="modal-aliases">${aliases}</div>` : ""}

<div class="modal-section">
  <div class="modal-section-title">What it does</div>
  <p style="margin:0;line-height:1.6">${p.whatItDoes}</p>
</div>

${p.notableQuote ? `
<div class="modal-section">
  <div class="modal-section-title">From the transcripts</div>
  <div class="modal-quote">“${p.notableQuote.text}”
    <div class="modal-quote-attr">— ${(p.notableQuote.transcript || "").replace(/\.txt$/, "")}</div>
  </div>
</div>` : ""}

<div class="modal-section">
  <div class="modal-section-title">Scores (1–10)</div>
  <div class="scores-grid">${scoreRows}</div>
</div>

<div class="modal-section">
  <div class="modal-section-title">Profile</div>
  <div class="modal-meta-grid">
    <div class="meta-row"><div class="meta-row-label">Tier</div><div><span class="tier-badge tier-${p.tier || "C"}">${p.tier || "C"}</span></div></div>
    <div class="meta-row"><div class="meta-row-label">Cycled</div><div>${p.cycled ? "Yes ↻" : "No"}</div></div>
    <div class="meta-row"><div class="meta-row-label">Half-life / dose</div><div style="font-size:12px;color:var(--text-dim)">${p.halfLifeOrDose || "—"}</div></div>
    <div class="meta-row"><div class="meta-row-label">Administration</div><div style="font-size:12px;color:var(--text-dim)">${p.administration || "—"}</div></div>
    <div class="meta-row"><div class="meta-row-label">Legal status</div><div style="font-size:12px;color:var(--text-dim)">${p.legalStatus || p.regulatoryStatus || "—"}</div></div>
    ${p.brandNames && p.brandNames.length ? `<div class="meta-row"><div class="meta-row-label">Brand names</div><div>${p.brandNames.join(", ")}</div></div>` : ""}
    ${p.moleculeWeight ? `<div class="meta-row"><div class="meta-row-label">Mol. weight</div><div>${p.moleculeWeight} Da</div></div>` : ""}
  </div>
</div>

${p.safetyProfile ? `<div class="modal-section"><div class="modal-section-title">Safety profile</div><p style="margin:0;line-height:1.6">${p.safetyProfile}</p></div>` : ""}

${cheap}

${stackHtml}

${videos ? `<div class="modal-section"><div class="modal-section-title">Informative videos</div><div class="video-list">${videos}</div></div>` : ""}

${transcripts ? `<div class="modal-section"><div class="modal-section-title">Transcripts referencing this peptide</div><div>${transcripts}</div></div>` : ""}

<div class="modal-section">
  <a href="#/pedia/${p.id}" onclick="setTimeout(()=>document.querySelector('.mode-btn[data-mode=pedia]').click(),0);return true" style="color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:12px">→ Open in Peptide Pedia</a>
</div>
    `;
    byId("modal-backdrop").classList.add("show");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    byId("modal-backdrop").classList.remove("show");
    document.body.style.overflow = "";
  }
  byId("modal-close").addEventListener("click", closeModal);
  byId("modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* ================== PROTOCOL BUILDER ================== */
  const GOAL_SCORE_MAP = {
    weightloss: ["weightLoss"], muscle: ["muscleGrowth"], recovery: ["recovery"],
    sleep: ["sleep"], cognitive: ["cognitive"], hairSkin: ["hairSkin"],
    longevity: ["humanResearch", "recovery"], libido: [], immune: [],
  };
  const GOAL_CANDIDATES = {
    weightloss: ["semaglutide", "tirzepatide", "retatrutide", "aod-9604", "tesamorelin"],
    muscle: ["growth-hormone", "tesamorelin", "ipamorelin", "cjc-1295", "mk-677", "igf-1-lr3", "peg-mgf"],
    recovery: ["bpc-157", "tb-500", "ghk-cu", "thymosin-alpha-1"],
    sleep: ["dsip", "epitalon", "mk-677", "ipamorelin"],
    cognitive: ["cerebrolysin", "semax", "selank", "dihexa", "methylene-blue"],
    hairSkin: ["ghk-cu", "melanotan-i", "melanotan-ii"],
    longevity: ["epitalon", "mots-c", "thymosin-alpha-1", "ghk-cu"],
    libido: ["pt-141", "kisspeptin-10", "melanotan-ii"],
    immune: ["thymosin-alpha-1", "ll-37", "kpv", "bpc-157"],
  };
  const RISK_TIERS = {
    conservative: ["S", "A"],
    moderate: ["S", "A", "B", "C"],
    adventurous: ["S", "A", "B", "C", "D", "F"],
  };
  function labelForGoal(g) {
    return ({weightloss:"fat loss",muscle:"muscle growth",recovery:"recovery",sleep:"sleep",cognitive:"cognition",hairSkin:"hair / skin",longevity:"longevity",libido:"libido",immune:"immune / gut"})[g] || g;
  }
  function buildProtocol(form) {
    const goals = Array.from(form.querySelectorAll('input[name="goal"]:checked')).map((i) => i.value);
    const risk = form.querySelector('input[name="risk"]:checked').value;
    const cyclePref = form.querySelector('input[name="cycle"]:checked').value;
    const allowedTiers = new Set(RISK_TIERS[risk]);
    if (goals.length === 0) return { goals, picks: [], message: "Pick at least one goal — even peptide nerds need a target." };
    const picks = []; const seen = new Set();
    goals.forEach((g) => {
      const cands = (GOAL_CANDIDATES[g] || []).map((id) => pepById(id)).filter(Boolean)
        .filter((p) => allowedTiers.has(p.tier))
        .filter((p) => (cyclePref === "no" ? !p.cycled : true));
      const sk = GOAL_SCORE_MAP[g];
      cands.sort((a, b) => {
        const sa = sk.length ? sk.reduce((acc, k) => acc + (a.scores?.[k] || 0), 0) / sk.length : 0;
        const sb = sk.length ? sk.reduce((acc, k) => acc + (b.scores?.[k] || 0), 0) / sk.length : 0;
        if (sb !== sa) return sb - sa;
        return (b.scores?.humanResearch || 0) - (a.scores?.humanResearch || 0);
      });
      const top = cands[0];
      if (top && !seen.has(top.id)) { picks.push({ peptide: top, reason: `Top pick for ${labelForGoal(g)}.` }); seen.add(top.id); }
      if (g === "muscle" && cands[1] && !seen.has(cands[1].id)) { picks.push({ peptide: cands[1], reason: `Common pairing for muscle / GH axis.` }); seen.add(cands[1].id); }
      if (g === "recovery" && cands[1] && !seen.has(cands[1].id)) { picks.push({ peptide: cands[1], reason: `Often stacked for recovery (Wolverine-style).` }); seen.add(cands[1].id); }
    });
    return { goals, risk, cyclePref, picks };
  }
  function renderProtocolResult(result) {
    const root = byId("protocol-result");
    root.classList.add("show");
    if (result.message) { root.innerHTML = `<div class="protocol-result-card"><p class="protocol-empty">${result.message}</p></div>`; return; }
    if (result.picks.length === 0) { root.innerHTML = `<div class="protocol-result-card"><p class="protocol-empty">No peptides match this combination of risk + cycling tolerance. Loosen one of those constraints.</p></div>`; return; }
    const tagHtml = [
      ...result.goals.map((g) => `<span class="protocol-tag">${labelForGoal(g)}</span>`),
      `<span class="protocol-tag">${result.risk} risk</span>`,
      result.cyclePref === "no" ? `<span class="protocol-tag">no cycling</span>` : "",
    ].join("");
    const rows = result.picks.map(({ peptide, reason }) => {
      const cat = catById(peptide.category);
      return `<div class="protocol-row" style="border-left-color:${cat.color}">
  <div class="protocol-row-name" data-id="${peptide.id}">${peptide.name}<span style="color:var(--text-mute);margin-left:8px;font-family:'JetBrains Mono',monospace;font-size:11px">${cat.name}</span></div>
  <div class="protocol-row-reason">${reason} ${peptide.cycled ? "Cycle on/off." : ""} Half-life: ${peptide.halfLifeOrDose || "n/a"}</div>
</div>`;
    }).join("");
    root.innerHTML = `
<div class="protocol-result-card">
  <h3>Suggested protocol</h3>
  <div>${tagHtml}</div>
  <div class="protocol-stack-list">${rows}</div>
  <div class="protocol-disclaimer">
    Educational only. None of this is medical advice. Most peptides on this map are research compounds — not FDA-approved for the use cases discussed. Talk to a clinician who knows peptides before you start anything injectable.
  </div>
</div>`;
    root.querySelectorAll(".protocol-row-name").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => openModal(el.dataset.id));
    });
  }
  byId("protocol-form").addEventListener("submit", (e) => {
    e.preventDefault();
    renderProtocolResult(buildProtocol(e.target));
    byId("protocol-result").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ================== PEPTIDE PEDIA (Wikipedia view) ================== */
  function renderPediaSidebar(activeId) {
    const groups = CATS.map((c) => ({ ...c, items: PEPTIDES.filter((p) => p.category === c.id).sort((a,b) => a.name.localeCompare(b.name)) }));
    const search = (byId("pedia-search")?.value || "").toLowerCase().trim();
    const filtered = (peps) => search ? peps.filter((p) => (p.name + " " + (p.aliases||[]).join(" ")).toLowerCase().includes(search)) : peps;
    const legend = `<div class="pedia-nav-legend"><span class="nonpeptide-dot"></span> not technically a peptide</div>`;
    byId("pedia-nav").innerHTML = legend + groups.map((g) => {
      const items = filtered(g.items);
      if (!items.length) return "";
      return `
<div class="pedia-nav-cat" style="color:${g.color === '#FFB000' ? '#a25a00' : g.color === '#39FF14' ? '#1a8a05' : g.color === '#00E5FF' ? '#0090a8' : g.color === '#B26BFF' ? '#5b2ba0' : '#a01b4d'}">${g.name}</div>
${items.map((p) => `<a class="pedia-nav-link${p.id === activeId ? ' active' : ''}" href="#/pedia/${p.id}" data-id="${p.id}">${p.name}${p.isPeptide === false ? '<span class="nonpeptide-dot" title="Not technically a peptide (small molecule)"></span>' : ''}<span class="pedia-nav-tier">${p.tier || ""}</span></a>`).join("")}`;
    }).join("");
    document.querySelectorAll(".pedia-nav-link").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        renderPedia(a.dataset.id);
      });
    });
  }

  function expandSeeAlso(text) {
    return text.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
      const p = pepById(id);
      const display = label || (p ? p.name : id);
      if (!p) return display;
      return `<a href="#/pedia/${p.id}" data-pedia-id="${p.id}">${display}</a>`;
    });
  }
  function expandCitations(text) {
    return text.replace(/\[(\d+)\]/g, (_, n) => `<sup><a href="#cite-${n}">[${n}]</a></sup>`);
  }
  function safeHTML(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderPedia(pepId) {
    const p = pepById(pepId);
    location.hash = `#/pedia/${pepId}`;
    renderPediaSidebar(pepId);
    if (!p) {
      byId("pedia-article").innerHTML = `<div class="pedia-empty"><h2>Not found</h2></div>`;
      return;
    }
    const cat = catById(p.category);
    const wiki = p.wiki; // may be undefined if agent hasn't run yet
    const cheap = GLP1_IDS.has(p.id) ? `
<div class="pedia-stub">
  <strong>How to get cheap Ozempic.</strong> Crémieux maintains the canonical sourcing guide for affordable GLP-1s: <a href="${CHEAP_OZEMPIC_URL}" target="_blank" rel="noopener">cremieux.xyz/p/how-to-get-cheap-ozempic</a>.
</div>` : "";

    const stub = !wiki ? `<div class="pedia-stub">This entry is a stub. The Pedia agent is still writing the full article — check back in a minute. Meanwhile here's the structured profile we have.</div>` : "";

    const lede = wiki?.lede ? `<p>${expandCitations(expandSeeAlso(wiki.lede))}</p>` : `<p>${expandCitations(expandSeeAlso(p.whatItDoes || ""))}</p>`;

    // Build TOC from sections that have content (or fall back to a stable list)
    const sections = wiki?.sections?.filter((s) => s.body && s.body.trim()) || fallbackSections(p);
    const toc = sections.length ? `
<div class="pedia-toc">
  <div class="pedia-toc-title">Contents</div>
  <ol>${sections.map((s) => `<li><a href="#sec-${s.id}">${s.title}</a></li>`).join("")}</ol>
</div>` : "";

    const sectionsHtml = sections.map((s) => `
<h2 id="sec-${s.id}">${s.title}</h2>
<div>${expandCitations(expandSeeAlso(s.body))}</div>`).join("");

    // Infobox
    const infobox = `
<aside class="pedia-infobox">
  <h4>${p.name}</h4>
  <div class="pedia-infobox-vial">
    ${vialSvg(cat.color, p.scores?.humanResearch ? Math.max(0.18, p.scores.humanResearch / 10) : 0.25)}
  </div>
  ${p.aliases && p.aliases.length ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Also known as</div><div class="pedia-infobox-value">${p.aliases.join(", ")}</div></div>` : ""}
  ${p.brandNames && p.brandNames.length ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Brand names</div><div class="pedia-infobox-value">${p.brandNames.join(", ")}</div></div>` : ""}
  <div class="pedia-infobox-row"><div class="pedia-infobox-label">Class</div><div class="pedia-infobox-value">${cat.name}</div></div>
  ${p.isPeptide === false ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Note</div><div class="pedia-infobox-value"><span class="nonpeptide-dot"></span> Not technically a peptide — small molecule / non-peptide commonly grouped with peptides.</div></div>` : ""}
  ${p.molecularStructure ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Structure</div><div class="pedia-infobox-value">${p.molecularStructure}</div></div>` : ""}
  ${p.moleculeWeight ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Mol. weight</div><div class="pedia-infobox-value">${p.moleculeWeight} Da</div></div>` : ""}
  ${p.administration ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Administration</div><div class="pedia-infobox-value">${p.administration}</div></div>` : ""}
  ${p.halfLifeOrDose ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Half-life / dose</div><div class="pedia-infobox-value">${p.halfLifeOrDose}</div></div>` : ""}
  ${p.legalStatus || p.regulatoryStatus ? `<div class="pedia-infobox-row"><div class="pedia-infobox-label">Legal status</div><div class="pedia-infobox-value">${p.legalStatus || p.regulatoryStatus}</div></div>` : ""}
  <div class="pedia-infobox-row"><div class="pedia-infobox-label">Tier (Tatem)</div><div class="pedia-infobox-value"><span class="tier-badge tier-${p.tier || "C"}">${p.tier || "C"}</span></div></div>
  <div class="pedia-infobox-row"><div class="pedia-infobox-label">Cycled</div><div class="pedia-infobox-value">${p.cycled ? "Yes ↻" : "No"}</div></div>
</aside>`;

    // References
    const refs = wiki?.references && wiki.references.length ? `
<section class="pedia-references">
  <h2>References</h2>
  <ol>
    ${wiki.references.map((r) => `<li id="cite-${r.id}"><a href="${r.url || '#'}" target="_blank" rel="noopener">${r.label}</a>${r.source ? ` <code>${r.source.replace(/\.txt$/, "")}</code>` : ""}</li>`).join("")}
  </ol>
</section>` : (p.transcripts && p.transcripts.length ? `
<section class="pedia-references">
  <h2>Sources</h2>
  <ol>
    ${p.transcripts.map((t, i) => `<li id="cite-${i+1}"><code>${t.replace(/\.txt$/, "")}</code></li>`).join("")}
  </ol>
</section>` : "");

    // Viral posts (e.g. Michael Morelli / X threads cited as a source)
    const viral = p.viralPosts && p.viralPosts.length ? `
<section class="pedia-viral">
  <h2>Viral posts</h2>
  <ul>${p.viralPosts.map((v) => `<li><a href="${v.url || '#'}" target="_blank" rel="noopener">${safeHTML(v.author || "X post")}</a>${v.text ? `: “${safeHTML(v.text)}”` : ""}${v.engagement ? ` <span class="pedia-viral-eng">(${safeHTML(v.engagement)})</span>` : ""}</li>`).join("")}</ul>
</section>` : "";

    byId("pedia-article").innerHTML = `
<h1>${p.name}</h1>
<p class="pedia-subtitle">${p.aliases && p.aliases.length ? "Also known as " + p.aliases.join(", ") + ". " : ""}${cat.name}.${p.isPeptide === false ? ` <span class="nonpeptide-dot"></span> <span class="nonpeptide-note">Not technically a peptide.</span>` : ""}</p>
${cheap}
${stub}
<div class="pedia-layout">
  <div class="pedia-body">
    ${lede}
    ${toc}
    ${sectionsHtml}
    ${refs}
    ${viral}
  </div>
  ${infobox}
</div>
`;
    // wire internal pedia links
    document.querySelectorAll("[data-pedia-id]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        renderPedia(a.dataset.pediaId);
      });
    });
    window.scrollTo({ top: 0 });
  }

  // Fallback wiki sections if `wiki` field isn't populated yet
  function fallbackSections(p) {
    const out = [];
    if (p.whatItDoes) out.push({ id: "summary", title: "Summary", body: p.whatItDoes });
    if (p.history) out.push({ id: "history", title: "History", body: p.history });
    if (p.administration) out.push({ id: "administration", title: "Administration", body: p.administration });
    if (p.halfLifeOrDose) out.push({ id: "dosing", title: "Dosing", body: p.halfLifeOrDose });
    if (p.legalStatus || p.regulatoryStatus) out.push({ id: "legal", title: "Regulatory status", body: p.legalStatus || p.regulatoryStatus });
    if (p.safetyProfile) out.push({ id: "safety", title: "Safety profile", body: p.safetyProfile });
    const stacks = STACKS.filter((s) => s.peptides.includes(p.id));
    if (stacks.length) out.push({ id: "stacks", title: "Common stacks", body: stacks.map((s) => `<strong>${s.name}.</strong> ${s.purpose}`).join("<br><br>") });
    if (p.notableQuote) out.push({ id: "quote", title: "Notable quote", body: `<em>"${p.notableQuote.text}"</em> — ${(p.notableQuote.transcript || "").replace(/\.txt$/, "")}` });
    return out;
  }

  // Search wiring
  byId("pedia-search").addEventListener("input", () => {
    renderPediaSidebar((location.hash.replace(/^#\/pedia\//, "") || PEPTIDES[0].id));
  });

  // Hash routing
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#/pedia/")) setMode("pedia");
    else if (location.hash.startsWith("#/talk/")) setMode("talk");
  });

  /* ================== TALK / SLIDE DECK ================== */
  const SLIDES = window.SLIDES || [];

  function mdToHtml(md) {
    if (!md) return "";
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const inline = (s) =>
      esc(s)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const lines = md.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (!ln.trim()) { i++; continue; }
      if (ln.startsWith("> ")) {
        const q = [];
        while (i < lines.length && lines[i].startsWith(">")) {
          q.push(lines[i].replace(/^>\s?/, "").trim());
          i++;
        }
        out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>");
        continue;
      }
      if (ln.startsWith("#### ")) { out.push("<h4>" + inline(ln.slice(5)) + "</h4>"); i++; continue; }
      const mUl = /^(\s*)[-*] (.*)/.exec(ln);
      if (mUl) {
        out.push("<ul>");
        while (i < lines.length) {
          const m = /^(\s*)[-*] (.*)/.exec(lines[i]);
          if (!m) break;
          out.push("<li>" + inline(m[2]) + "</li>");
          i++;
        }
        out.push("</ul>");
        continue;
      }
      const mOl = /^(\s*)\d+\. (.*)/.exec(ln);
      if (mOl) {
        out.push("<ol>");
        while (i < lines.length) {
          const m = /^(\s*)\d+\. (.*)/.exec(lines[i]);
          if (!m) break;
          out.push("<li>" + inline(m[2]) + "</li>");
          i++;
        }
        out.push("</ol>");
        continue;
      }
      // paragraph: gather until blank line
      const para = [ln];
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith("> ") && !/^(\s*)[-*] /.test(lines[i]) && !/^(\s*)\d+\. /.test(lines[i]) && !lines[i].startsWith("#### ")) {
        para.push(lines[i]); i++;
      }
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  }

  function renderTalk(index) {
    if (!SLIDES.length) {
      byId("talk-slide").innerHTML = "<p>No slides loaded.</p>"; return;
    }
    const i = Math.max(0, Math.min(SLIDES.length - 1, index));
    const s = SLIDES[i];
    location.hash = `#/talk/${i}`;
    const slideEl = byId("talk-slide");
    slideEl.className = "talk-slide kind-" + s.kind;
    let eyebrow = s.subtitle || "";
    let partLabel = s.part || "";
    slideEl.innerHTML = `
      ${partLabel ? `<div class="talk-slide-part">${partLabel}</div>` : ""}
      ${eyebrow ? `<div class="talk-slide-eyebrow">${eyebrow}</div>` : ""}
      <h1 class="talk-slide-title">${s.title}</h1>
      <div class="talk-slide-body">${mdToHtml(s.body || "")}</div>
    `;
    byId("talk-counter").textContent = `${i + 1} / ${SLIDES.length}`;
    byId("talk-progress-fill").style.width = `${((i + 1) / SLIDES.length) * 100}%`;
  }
  function talkNext() {
    const m = (location.hash || "").match(/^#\/talk\/(\d+)/);
    const i = m ? parseInt(m[1], 10) : 0;
    renderTalk(i + 1);
  }
  function talkPrev() {
    const m = (location.hash || "").match(/^#\/talk\/(\d+)/);
    const i = m ? parseInt(m[1], 10) : 0;
    renderTalk(i - 1);
  }
  byId("talk-next").addEventListener("click", talkNext);
  byId("talk-prev").addEventListener("click", talkPrev);
  byId("talk-fs").addEventListener("click", () => {
    document.body.classList.toggle("talk-fullscreen");
    if (document.body.classList.contains("talk-fullscreen")) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (document.body.dataset.mode !== "talk") return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); talkNext(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); talkPrev(); }
    else if (e.key === "f" || e.key === "F") { document.body.classList.toggle("talk-fullscreen"); }
    else if (e.key === "Home") renderTalk(0);
    else if (e.key === "End") renderTalk(SLIDES.length - 1);
  });

  /* ================== FOOT META ================== */
  function renderFootMeta() {
    byId("foot-meta").textContent =
      `${PEPTIDES.length} peptides · ${CATS.length} groups · ${STACKS.length} stacks · ${HISTORY.length} milestones`;
  }

  /* ================== INIT ================== */
  renderMarquee();
  renderLegendCats();
  renderCategories();
  populateAxes();
  renderMap();
  renderStacks();
  renderHistory();
  renderFootMeta();
  // bubble map needs a tick after layout
  setTimeout(renderBubbleMap, 50);
  window.addEventListener("resize", () => { clearTimeout(window.__bm); window.__bm = setTimeout(renderBubbleMap, 200); });

  // If launched on a #/pedia/<id> URL, switch to pedia mode
  if (location.hash.startsWith("#/pedia/")) setMode("pedia");
  else if (location.hash.startsWith("#/talk/")) setMode("talk");
})();
