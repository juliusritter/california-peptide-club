"use strict";
/* Shared content model + helpers for the framework PoC pages.
   Keep GRAPH in sync with site/index.html — this is the future CMS shape. */

/* Layout tightened 2026-09-01 (Julius: denser, less empty air). anchor:"top"
   means every edge targeting the node arrives at the middle of its top edge.
   `icons` (array) = travelers take turns; `icon` stays for single-icon edges
   and for the d3/jointjs pages. */
const GRAPH = {
  nodes: [
    { id:"china",        x:160,  y:60,  w:310, h:96,  title:"Chinese Manufacturers", sub:"API synthesis, Zhejiang & Hubei", accent:"red", flag:"cn" },
    { id:"five",         x:600,  y:88,  w:64,  h:64,  title:"5", sub:"", shape:"circle", accent:"green" },
    { id:"usfac",        x:1090, y:64,  w:270, h:80,  title:"US Facilities", sub:"domestic API + fill-finish" },
    { id:"grey",         x:160,  y:316, w:270, h:112, title:"“Grey Market”", sub:"research-use-only vendors", accent:"grey" },
    { id:"cpg",          x:478,  y:322, w:210, h:100, title:"CPG Brands", sub:"peptide-infused consumer goods" },
    { id:"compounding",  x:736,  y:316, w:250, h:112, title:"Compounding Pharmacies", sub:"503A / 503B" },
    { id:"pharma",       x:1064, y:316, w:280, h:112, title:"Pharma", sub:"Eli Lilly · Novo Nordisk" },
    { id:"prescription", x:768,  y:546, w:220, h:74,  title:"Prescription", sub:"" },
    { id:"telehealth",   x:1116, y:528, w:290, h:120, title:"Telehealth", sub:"independent providers & fulfillment pharmacies" },
    { id:"consumer",     x:640,  y:736, w:280, h:86,  title:"Consumer", sub:"", anchor:"top" }
  ],
  edges: [
    { id:"china-five",       from:"china", to:"five",        icon:null,        curve:0.05 },
    { id:"five-compounding", from:"five",  to:"compounding", icon:"powder",    curve:0.12, data:"china-compounding" },
    { id:"five-pharma",      from:"five",  to:"pharma",      icon:null,        curve:0.06, dotted:true },
    { id:"china-grey",       from:"china", to:"grey",        icon:null,        curve:0.04 },
    { id:"china-consumer",   from:"china", to:"consumer",    icon:"vial",      curve:-0.55, data:"china-consumer" },
    { id:"grey-consumer",    from:"grey",  to:"consumer",    icon:"vial",      curve:-0.14, data:"greymarket-consumer" },
    { id:"cpg-consumer",     from:"cpg",   to:"consumer",    icon:"chocolate", icons:["chocolate","pill"], curve:-0.08, data:"cpg-consumer" },
    { id:"compounding-rx",   from:"compounding", to:"prescription", icon:"vial", curve:0.05 },
    { id:"rx-consumer",      from:"prescription", to:"consumer",   icon:"vial", curve:0.05, data:"compounding-prescription-consumer" },
    { id:"usfac-pharma",     from:"usfac", to:"pharma",      icon:null,        curve:0.04 },
    { id:"pharma-consumer",  from:"pharma", to:"consumer",   icon:"pen",       icons:["pen","pill"], curve:0.22, data:"pharma-consumer" },
    { id:"pharma-telehealth",from:"pharma", to:"telehealth", icon:"pen",       icons:["pen","pill"], curve:-0.25 },
    { id:"telehealth-consumer", from:"telehealth", to:"consumer", icon:"pen", icons:["pen","pill"], curve:0.18, data:"pharma-telehealth-consumer" }
  ]
};
const NODE_BY_ID = {}; GRAPH.nodes.forEach(n => NODE_BY_ID[n.id] = n);

const STYLES = ["aquarelle-inkwash","aquarelle-gold","aquarelle-noir","liquid-metal","copper-engraving","neon-glass","paper-cutout","porcelain","blueprint","gilded-macro"];
const DEFAULT_STYLE = "aquarelle-gold"; /* Julius picked aquarelle-gold 2026-09-01 */
const ICON_BASE = "icons/";
const SPEED = 13;       /* px per second (halved from the original 26) */
const ICON_SIZE = 120;  /* uniform traveler size (3x the original) */
const TRAVELER_GAP = 380; /* min path px between travelers */

/* ---------- geometry ---------- */
function centerOf(b){ return { x:b.x + b.w/2, y:b.y + b.h/2 }; }
function borderPoint(b, toward){
  const c = centerOf(b);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if(b.shape === "circle"){
    const r = b.w/2, len = Math.hypot(dx,dy) || 1;
    return { x:c.x + dx/len*r, y:c.y + dy/len*r };
  }
  const hw = b.w/2, hh = b.h/2;
  const sx = dx===0 ? Infinity : hw/Math.abs(dx), sy = dy===0 ? Infinity : hh/Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x:c.x + dx*s, y:c.y + dy*s };
}
/* quadratic-bezier edge between two node boxes; curve is the lateral bow factor */
function edgeGeometry(a, b, curve){
  const ca = centerOf(a), cb = centerOf(b);
  const p1 = borderPoint(a, cb);
  /* anchor:"top" — every edge lands at the middle of the target's top edge */
  const p2 = b.anchor==="top" ? { x:b.x + b.w/2, y:b.y } : borderPoint(b, ca);
  const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
  const dx = p2.x-p1.x, dy = p2.y-p1.y, chord = Math.hypot(dx,dy) || 1;
  const nx = -dy/chord, ny = dx/chord, k = (curve||0)*chord;
  const ctrl = { x:mx + nx*k, y:my + ny*k };
  let length = 0, prev = p1;
  for(let i=1;i<=24;i++){
    const t=i/24, mt=1-t;
    const x=mt*mt*p1.x + 2*mt*t*ctrl.x + t*t*p2.x;
    const y=mt*mt*p1.y + 2*mt*t*ctrl.y + t*t*p2.y;
    length += Math.hypot(x-prev.x, y-prev.y); prev = {x,y};
  }
  const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  return { d, p1, p2, ctrl, length };
}
function travelerCount(length){ return Math.max(1, Math.round(length / TRAVELER_GAP)); }

/* ---------- PRC flag as inline SVG (30x20 units, stars angled at the primary) ---------- */
function starPath(cx, cy, r, rotDeg){
  const rot = (rotDeg||0) * Math.PI/180, inner = r*0.382, pts=[];
  for(let k=0;k<5;k++){
    const ao = -Math.PI/2 + k*2*Math.PI/5 + rot;
    const ai = ao + Math.PI/5;
    pts.push([cx + r*Math.cos(ao), cy + r*Math.sin(ao)]);
    pts.push([cx + inner*Math.cos(ai), cy + inner*Math.sin(ai)]);
  }
  return "M" + pts.map(p => p[0].toFixed(2)+","+p[1].toFixed(2)).join(" L") + " Z";
}
function flagCnSvg(scrim){
  const stars = [
    starPath(5, 5, 3, 0),
    starPath(10, 2, 1, -121), starPath(12, 4, 1, -98),
    starPath(12, 7, 1, -74),  starPath(10, 9, 1, -51)
  ].map(d => `<path d="${d}" fill="#ffde00"/>`).join("");
  const overlay = scrim ? `<rect width="30" height="20" fill="rgba(0,0,0,0.22)"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice"><rect width="30" height="20" fill="#de2910"/>${stars}${overlay}</svg>`;
}
function flagCnDataUri(){ return "data:image/svg+xml," + encodeURIComponent(flagCnSvg(true)); }

/* ---------- flow data + tooltip ---------- */
const FLOWS = {};
function loadFlows(){
  return fetch("flow-data.json").then(r=>r.json())
    .then(j=>{ (j.edges||[]).forEach(e=>FLOWS[e.id]=e); })
    .catch(()=>{});
}
function tipEl(){ return document.getElementById("tooltip"); }
function showTip(edgeDef, evt){
  const tip = tipEl();
  const d = edgeDef.data ? FLOWS[edgeDef.data] : null;
  const aT = NODE_BY_ID[edgeDef.from]?.title || "", bT = NODE_BY_ID[edgeDef.to]?.title || "";
  tip.innerHTML = `
    <div class="t-label">${aT} → ${bT}</div>
    ${d ? `
      <div class="t-note">${d.note||""}</div>
      <table>
        <tr><td class="yr">2026</td><td class="val">${d.value2026||"—"}</td></tr>
        <tr><td class="yr">2027 est.</td><td class="val">${d.value2027||"—"}</td></tr>
        <tr><td class="yr">2030 est.</td><td class="val">${d.value2030||"—"}</td></tr>
      </table>
      <div class="t-conf">confidence · ${d.confidence||"n/a"}</div>`
    : `<div class="t-note">Logistics link — no direct consumer dollar flow.</div>`}`;
  tip.classList.add("show");
  moveTip(evt);
}
function moveTip(evt){
  const tip = tipEl();
  const pad=18, w=tip.offsetWidth, h=tip.offsetHeight;
  let x=evt.clientX+pad, y=evt.clientY+pad;
  if(x+w>innerWidth-8) x=evt.clientX-w-pad;
  if(y+h>innerHeight-8) y=evt.clientY-h-pad;
  tip.style.left=x+"px"; tip.style.top=y+"px";
}
function hideTip(){ tipEl().classList.remove("show"); }

/* ---------- chrome builders ---------- */
function buildFrameworkNav(current){
  const frameworks = [
    ["hand-rolled","index.html"],
    ["react flow","reactflow-poc.html"],
    ["d3","d3-poc.html"],
    ["jointjs","jointjs-poc.html"]
  ];
  const nav = document.getElementById("fwnav");
  if(!nav) return;
  nav.innerHTML = frameworks.map(([name,href]) =>
    `<a href="${href}" class="${href===current?"current":""}">${name}</a>`).join("");
}
function buildStylebar(current, onPick){
  const bar = document.getElementById("stylebar");
  bar.innerHTML = "";
  STYLES.forEach(s=>{
    const b = document.createElement("button");
    b.textContent = s.replace(/-/g," ");
    if(s===current) b.classList.add("active");
    b.onclick = ()=>{
      [...bar.children].forEach(c=>c.classList.remove("active"));
      b.classList.add("active");
      onPick(s);
    };
    bar.appendChild(b);
  });
}
