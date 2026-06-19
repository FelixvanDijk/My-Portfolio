/* ============================================================
   felix.os — Walk Inside the Running Program
   A navigable 3D motherboard where the CV lives as glowing silicon.
   Build-free: Three.js via CDN import map. Progressive enhancement
   layered over the classic personal.html (which is the fallback).
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const GREEN = 0x22c55e;
const BLUE = 0x4a90e2;
const COPPER = 0xc9a25e;
const AMBER = 0xf59e0b;

/* district definitions — position on the board + which classic node feeds the panel */
const DISTRICTS = [
  { id: 'cpu',      name: 'felix.c',  sub: 'whoami', x: 0,   z: 1,   w: 9,  d: 9,  cpu: true,  source: '#hero-rendered', title: 'Felix van Dijk', kicker: '$ whoami' },
  { id: 'about',    name: 'About',    sub: 'readme', x: -17, z: -10, w: 7,  d: 5,  source: '.about-grid',  title: 'About', kicker: '$ cat about.md' },
  { id: 'skills',   name: 'Skills',   sub: 'pkg',    x: 17,  z: -10, w: 8,  d: 5.5,source: '.pkg-grid',    title: 'Skills', kicker: '$ pkg list --installed' },
  { id: 'projects', name: 'Projects', sub: 'ps aux', x: 0,   z: 15,  w: 12, d: 7,  big: true, source: '.proc-viewport', title: 'Projects', kicker: '$ ps aux | grep felix' },
  { id: 'journey',  name: 'Journey',  sub: 'git log',x: -19, z: 9,   w: 7,  d: 5,  source: '.commits',     title: 'Journey', kicker: '$ git log --graph' },
  { id: 'contact',  name: 'Contact',  sub: 'socket', x: 19,  z: 9,   w: 7,  d: 5,  source: '.contact-grid',title: 'Contact', kicker: '$ open /dev/socket' },
];

let renderer, scene, camera, composer, raf = 0, built = false, running = false;
let clock;
let bgGrid, starfield;
const LITE = !!(window.__FELIX && window.__FELIX.lite);
const useBloom = !LITE;
let benchStart = 0, benchFrames = 0, benchStage = 0;
const chips = {};            // id -> { group, mesh, pos }
const labelEls = {};         // id -> DOM button
const dockEls = {};          // id -> DOM button
let pulseSystems = [];       // { mesh, curve, offsets, count, speed }
let traceMats = [];
let currentZone = null;

/* camera view model: everything derived from this */
const view = {
  target: new THREE.Vector3(0, 2, 0),
  radius: 50, theta: 0.0, phi: 0.66,
};
const panVel = { x: 0, z: 0 };   // inertia for drag-to-pan
let orbitVel = 0;                 // inertia for right-drag orbit
let isFlying = false;            // true while a camera flight tween runs
function clampTarget() {
  view.target.x = clamp(view.target.x, -34, 34);
  view.target.z = clamp(view.target.z, -24, 30);
}
const OVERVIEW = { target: new THREE.Vector3(0, 3.5, 1), radius: 44, theta: 0.0, phi: 0.82 };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FELIX = window.__FELIX || { shouldBoot: false };

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function spherical(out, target, radius, theta, phi) {
  const sp = Math.sin(phi);
  out.set(
    target.x + radius * sp * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * sp * Math.cos(theta)
  );
  return out;
}

/* ---------- procedural PCB texture ---------- */
function makeBoardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#06110b';
  x.fillRect(0, 0, 1024, 1024);
  // subtle solder-mask mottle
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = `rgba(20,${60 + Math.random() * 40 | 0},40,0.05)`;
    const r = 2 + Math.random() * 5;
    x.beginPath();
    x.arc(Math.random() * 1024, Math.random() * 1024, r, 0, 7);
    x.fill();
  }
  // silkscreen grid
  x.strokeStyle = 'rgba(120,150,140,0.06)';
  x.lineWidth = 1;
  for (let i = 0; i <= 1024; i += 32) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1024); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(1024, i); x.stroke();
  }
  // scattered copper pads + silkscreen marks
  for (let i = 0; i < 240; i++) {
    const px = Math.random() * 1024, py = Math.random() * 1024;
    if (Math.random() < 0.5) {
      x.fillStyle = 'rgba(150,110,50,0.5)';
      x.beginPath(); x.arc(px, py, 2.5 + Math.random() * 3, 0, 7); x.fill();
    } else {
      x.strokeStyle = 'rgba(160,180,170,0.10)';
      x.strokeRect(px, py, 8 + Math.random() * 26, 8 + Math.random() * 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- text sprite for chip tops ---------- */
function makeChipLabelTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 128);
  x.fillStyle = color || '#7fe0a0';
  x.font = 'bold 30px "JetBrains Mono", monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/* ---------- build one chip district ---------- */
function buildChip(d) {
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z);

  const accent = d.id === 'contact' ? BLUE : (d.cpu ? GREEN : GREEN);
  const h = d.cpu ? 1.8 : 1.1;

  // body
  const bodyMat = new THREE.MeshStandardMaterial({
    color: d.cpu ? 0x10161f : 0x0c1119,
    roughness: 0.5, metalness: 0.65,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(d.w, h, d.d), bodyMat);
  body.position.y = h / 2 + 0.2;
  body.userData.zone = d.id;
  g.add(body);

  // beveled top plate (emissive trim)
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f17, roughness: 0.35, metalness: 0.8,
    emissive: accent, emissiveIntensity: d.cpu ? 0.22 : 0.12,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(d.w - 0.8, 0.18, d.d - 0.8), topMat);
  top.position.y = h + 0.2;
  top.userData.zone = d.id;
  g.add(top);

  // glowing edge frame
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(d.w, h, d.d)),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.5 })
  );
  edge.position.y = h / 2 + 0.2;
  g.add(edge);

  // chip-top text label
  const labelTex = makeChipLabelTexture(d.cpu ? 'CPU' : d.name.toUpperCase());
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
  const labelGeo = new THREE.PlaneGeometry((d.cpu ? 4.6 : 4) , (d.cpu ? 2.3 : 2));
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.y = h + 0.31;
  g.add(label);

  // pins (instanced) along left/right edges
  const pinCount = Math.max(6, Math.round(d.d * 1.6));
  const pinGeo = new THREE.BoxGeometry(0.5, 0.12, 0.18);
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0xd8b86a, metalness: 1, roughness: 0.35, emissive: 0x3a2c0e, emissiveIntensity: 0.4,
  });
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, pinCount * 2);
  const m = new THREE.Matrix4();
  let pi = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < pinCount; i++) {
      const z = -d.d / 2 + (d.d / (pinCount - 1)) * i;
      m.makeTranslation(side * (d.w / 2 + 0.25), 0.35, z);
      pins.setMatrixAt(pi++, m);
    }
  }
  pins.instanceMatrix.needsUpdate = true;
  g.add(pins);

  // status LED for projects/contact flavor
  const ledColor = d.id === 'contact' ? BLUE : (d.id === 'projects' ? AMBER : GREEN);
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 1.4 })
  );
  led.position.set(d.w / 2 - 0.7, h + 0.4, d.d / 2 - 0.7);
  g.add(led);
  led.userData.blink = d.id === 'projects' || d.id === 'contact';

  scene.add(g);
  chips[d.id] = { group: g, body, top, edge, led, pos: new THREE.Vector3(d.x, h + 0.4, d.z), accent };
}

/* ---------- copper trace from CPU to a district (Manhattan-ish) ---------- */
function buildTrace(from, to, color) {
  const y = 0.28;
  const mid = new THREE.Vector3((from.x + to.x) / 2, y, from.z);
  const pts = [
    new THREE.Vector3(from.x, y, from.z),
    new THREE.Vector3(from.x, y, lerp(from.z, to.z, 0.35)),
    new THREE.Vector3(lerp(from.x, to.x, 0.5), y, lerp(from.z, to.z, 0.5)),
    new THREE.Vector3(to.x, y, lerp(from.z, to.z, 0.7)),
    new THREE.Vector3(to.x, y, to.z),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
  const geo = new THREE.TubeGeometry(curve, 40, 0.1, 7, false);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.4,
  });
  const tube = new THREE.Mesh(geo, mat);
  scene.add(tube);
  traceMats.push(mat);
  return { curve, mat };
}

/* ---------- data pulses traveling along a curve ---------- */
function buildPulses(curve, color, count, speed) {
  const geo = new THREE.SphereGeometry(0.16, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const offsets = [];
  for (let i = 0; i < count; i++) offsets.push(Math.random());
  scene.add(mesh);
  pulseSystems.push({ mesh, curve, offsets, count, speed });
}

/* ---------- assemble the whole scene ---------- */
function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas: $('#world-canvas'), antialias: !LITE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LITE ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x05070e, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070e, 0.012);
  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 400);
  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x33415a, 1.1));
  const key = new THREE.DirectionalLight(0xbcd0ff, 1.0);
  key.position.set(18, 40, 24);
  scene.add(key);
  const rim = new THREE.DirectionalLight(GREEN, 0.25);
  rim.position.set(-20, 12, -20);
  scene.add(rim);

  buildBackground();

  // board
  const boardTex = makeBoardTexture();
  boardTex.repeat.set(3, 2.2);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.6, 50),
    new THREE.MeshStandardMaterial({ map: boardTex, color: 0x0a160e, roughness: 0.8, metalness: 0.3 })
  );
  board.position.y = -0.1;
  scene.add(board);
  // board glowing rim
  const rimEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(72, 0.6, 50)),
    new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.25 })
  );
  rimEdge.position.y = -0.1;
  scene.add(rimEdge);

  scatterSMD();
  DISTRICTS.forEach(buildChip);

  // traces + pulses from CPU to each district
  const cpu = DISTRICTS[0];
  const cpuPos = new THREE.Vector3(cpu.x, 0, cpu.z);
  DISTRICTS.slice(1).forEach((d) => {
    const col = d.id === 'contact' ? BLUE : COPPER;
    const { curve, mat } = buildTrace(cpuPos, new THREE.Vector3(d.x, 0, d.z), col);
    chips[d.id].traceCurve = curve;
    chips[d.id].traceMat = mat;
    buildPulses(curve, d.id === 'contact' ? 0x7fc4ff : 0x6effa6, LITE ? 2 : 4, 0.10 + Math.random() * 0.05);
  });

  buildBusinessFork();

  if (useBloom) setupComposer();
  built = true;
}

/* ---------- the business-side fork: a second board the Journey trace splits toward ---------- */
let bizBoard, bizLabelEl;
const bizForkPos = new THREE.Vector3(-42, 2, 20);
function buildBusinessFork() {
  const g = new THREE.Group();
  g.position.set(-42, 0, 20);
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.5, 11),
    new THREE.MeshStandardMaterial({ color: 0x0a1422, roughness: 0.6, metalness: 0.5, emissive: BLUE, emissiveIntensity: 0.16 })
  );
  b.userData.zone = 'business';
  g.add(b);
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(16, 0.5, 11)),
    new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.5 })
  ));
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0x0c1a2c, metalness: 0.7, roughness: 0.4, emissive: BLUE, emissiveIntensity: 0.22 })
  );
  chip.position.y = 0.75; chip.userData.zone = 'business';
  g.add(chip);
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 2),
    new THREE.MeshBasicMaterial({ map: makeChipLabelTexture('LTD', '#a9ccff'), transparent: true })
  );
  lbl.rotation.x = -Math.PI / 2; lbl.position.set(0, 1.28, 0);
  g.add(lbl);
  scene.add(g);
  bizBoard = b;

  // the fork: a blue trace splitting off the Journey district toward the business board
  const r = buildTrace(new THREE.Vector3(-19, 0, 9), new THREE.Vector3(-42, 0, 20), BLUE);
  buildPulses(r.curve, 0x7fc4ff, 3, 0.085);

  const el = document.createElement('button');
  el.className = 'wlabel is-biz';
  el.innerHTML = '<span class="wl-pill">fvandijk.ltd ↗</span><span class="wl-sub">branch: business</span>';
  el.addEventListener('click', () => { window.location.href = 'business.html'; });
  $('#world-labels').appendChild(el);
  bizLabelEl = el;
}

/* ---------- boot cascade: power the CPU, race a clock-pulse out to each district ---------- */
function setBootDark() {
  Object.values(chips).forEach((c) => {
    c.top.material.emissiveIntensity = 0;
    c.edge.material.opacity = 0.06;
    c.led.material.emissiveIntensity = 0;
    if (c.traceMat) c.traceMat.emissiveIntensity = 0.04;
  });
}
function powerChip(c, isCpu) {
  const target = isCpu ? 0.24 : 0.12;
  if (!window.gsap) { c.top.material.emissiveIntensity = target; c.edge.material.opacity = 0.5; c.led.material.emissiveIntensity = 1.4; return; }
  window.gsap.to(c.top.material, { emissiveIntensity: target, duration: 0.5, onUpdate: requestRender });
  window.gsap.to(c.edge.material, { opacity: 0.5, duration: 0.5 });
  window.gsap.fromTo(c.led.material, { emissiveIntensity: 2.8 }, { emissiveIntensity: 1.4, duration: 0.7 });
}
function bootPulse(c, delay) {
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), new THREE.MeshBasicMaterial({ color: 0xbfffd6 }));
  dot.visible = false; scene.add(dot);
  const o = { t: 0 };
  const tl = window.gsap.timeline({ delay });
  tl.set(dot, { visible: true });
  tl.to(o, { t: 1, duration: 0.42, ease: 'power2.in', onUpdate: () => { c.traceCurve.getPointAt(o.t, dot.position); requestRender(); } });
  tl.to(c.traceMat, { emissiveIntensity: 0.7, duration: 0.4 }, '<0.05');
  tl.add(() => { scene.remove(dot); dot.geometry.dispose(); dot.material.dispose(); powerChip(c, false); });
}
function runBootCascade() {
  setBootDark();
  window.gsap.delayedCall(0.4, () => powerChip(chips.cpu, true));
  DISTRICTS.slice(1).forEach((d, i) => bootPulse(chips[d.id], 0.7 + i * 0.4));
}

/* scattered surface-mount components for board richness (instanced, ~1 draw call each) */
function scatterSMD() {
  const footprints = DISTRICTS.map((d) => ({ x: d.x, z: d.z, rx: d.w / 2 + 1.5, rz: d.d / 2 + 1.5 }));
  const free = (x, z) => !footprints.some((f) => Math.abs(x - f.x) < f.rx && Math.abs(z - f.z) < f.rz);
  // little resistors/caps (dark with faint sheen)
  const compGeo = new THREE.BoxGeometry(0.7, 0.35, 0.4);
  const compMat = new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.6, metalness: 0.5 });
  const comps = new THREE.InstancedMesh(compGeo, compMat, 160);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1, 1); const p = new THREE.Vector3();
  let ci = 0, tries = 0;
  while (ci < 160 && tries < 1200) {
    tries++;
    const x = -33 + Math.random() * 66, z = -23 + Math.random() * 46;
    if (!free(x, z)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() < 0.5 ? 0 : Math.PI / 2);
    p.set(x, 0.32, z);
    const sc = 0.6 + Math.random() * 1.1; s.set(sc, 1, sc);
    m.compose(p, q, s);
    comps.setMatrixAt(ci++, m);
  }
  comps.count = ci;
  comps.instanceMatrix.needsUpdate = true;
  scene.add(comps);
  // glowing vias (tiny emissive dots)
  const viaGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 6);
  const viaMat = new THREE.MeshStandardMaterial({ color: COPPER, emissive: 0x4a3a14, emissiveIntensity: 0.6, metalness: 1, roughness: 0.4 });
  const vias = new THREE.InstancedMesh(viaGeo, viaMat, 200);
  let vi = 0; tries = 0;
  while (vi < 200 && tries < 1400) {
    tries++;
    const x = -34 + Math.random() * 68, z = -24 + Math.random() * 48;
    if (!free(x, z)) continue;
    m.makeTranslation(x, 0.3, z);
    vias.setMatrixAt(vi++, m);
  }
  vias.count = vi;
  vias.instanceMatrix.needsUpdate = true;
  scene.add(vias);
}

/* soft round sprite for glowing point-motes */
function makeDotSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(170,255,200,0.8)');
  grd.addColorStop(1, 'rgba(170,255,200,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill();
  return new THREE.CanvasTexture(c);
}

/* the void around the board: a circuit substrate the board floats above + drifting data motes */
function buildBackground() {
  const grid = new THREE.GridHelper(280, 140, 0x1f7a4a, 0x0e3a24);
  grid.position.y = -10;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  grid.material.depthWrite = false;
  grid.material.fog = true;
  scene.add(grid);
  bgGrid = grid;

  const grid2 = new THREE.GridHelper(140, 70, 0x0a2a18, 0x0a2a18);
  grid2.position.y = -9.7;
  grid2.material.transparent = true;
  grid2.material.opacity = 0.16;
  grid2.material.depthWrite = false;
  scene.add(grid2);

  // drifting data motes (glow under bloom)
  const N = LITE ? 550 : 1300;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 48 + Math.random() * 130;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -8 + Math.random() * 66;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.25, map: makeDotSprite(), transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, color: 0x7effb0, fog: false,
  });
  starfield = new THREE.Points(g, mat);
  scene.add(starfield);
}

function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.8);
  composer.addPass(bloom);
}

/* ---------- DOM: labels, dock, panel ---------- */
function buildHud() {
  const labels = $('#world-labels');
  const dock = $('#world-dock');
  DISTRICTS.forEach((d) => {
    const b = document.createElement('button');
    b.className = 'wlabel' + (d.cpu ? ' is-cpu' : '');
    b.innerHTML = `<span class="wl-pill">${d.cpu ? 'felix.c' : d.name}</span><span class="wl-sub">${d.sub}</span>`;
    b.addEventListener('click', () => goTo(d.id, true));
    labels.appendChild(b);
    labelEls[d.id] = b;

    if (!d.cpu) {
      const p = document.createElement('button');
      p.className = 'dock-btn';
      p.textContent = d.name;
      p.addEventListener('click', () => goTo(d.id, true));
      dock.appendChild(p);
      dockEls[d.id] = p;
    }
  });
  const home = document.createElement('button');
  home.className = 'dock-btn';
  home.textContent = '⌂ Home';
  home.addEventListener('click', () => { closePanel(); flyTo(OVERVIEW); setCurrent(null); });
  dock.insertBefore(home, dock.firstChild);
}

/* remap ids inside a cloned subtree so they don't collide with the hidden classic DOM */
function remapIds(root, prefix) {
  const map = {};
  root.querySelectorAll('[id]').forEach((el) => {
    const old = el.id; const neu = prefix + old; map[old] = neu; el.id = neu;
  });
  root.querySelectorAll('[for]').forEach((el) => { if (map[el.getAttribute('for')]) el.setAttribute('for', map[el.getAttribute('for')]); });
  root.querySelectorAll('[aria-describedby]').forEach((el) => { const v = el.getAttribute('aria-describedby'); if (map[v]) el.setAttribute('aria-describedby', map[v]); });
}

function populatePanel(d) {
  const body = $('#world-panel .wpanel-body');
  body.innerHTML = '';
  $('#world-panel .wpanel-kicker').textContent = d.kicker;
  $('#world-panel .wpanel-title').textContent = d.title;

  const src = $(d.source);
  if (src) {
    const clone = src.cloneNode(true);
    remapIds(clone, 'w-' + d.id + '-');
    clone.removeAttribute('id');
    clone.removeAttribute('aria-hidden');
    // the classic source may be mid-GSAP (opacity:0 / visibility:hidden from a reveal that
    // never fired while hidden) — strip that inline state so the panel always shows in full
    var unhide = function (el) { if (el.style) { el.style.removeProperty('opacity'); el.style.removeProperty('visibility'); el.style.removeProperty('transform'); } };
    unhide(clone);
    clone.querySelectorAll('*').forEach(unhide);
    body.appendChild(clone);
    if (d.id === 'contact') wireClonedForm(clone);
    if (d.id === 'cpu') wireHeroCtas(clone);
  }
  body.scrollTop = 0;
}

/* the cloned contact form gets its own submit handler (classic scripts.js is bound to the original) */
function wireClonedForm(clone) {
  const form = clone.querySelector('form') || (clone.matches('form') ? clone : null);
  if (!form) return;
  const result = clone.querySelector('.form-result');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (result) { result.className = 'form-result mono'; result.textContent = 'compiling message…'; }
    fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then((r) => {
        if (r.ok) { if (result) { result.className = 'form-result mono ok'; result.textContent = '=> { status: 200, body: "Thanks — I\'ll reply soon." }'; } form.reset(); }
        else throw new Error('bad');
      })
      .catch(() => { if (result) { result.className = 'form-result mono err'; result.innerHTML = '=> { status: 500 } — try again or <a href="mailto:felixvandijkk@gmail.com">email me</a>.'; } });
  });
}

function wireHeroCtas(clone) {
  clone.querySelectorAll('a[href="#projects"]').forEach((a) => { a.addEventListener('click', (e) => { e.preventDefault(); goTo('projects', true); }); });
  clone.querySelectorAll('a[href="#contact"]').forEach((a) => { a.addEventListener('click', (e) => { e.preventDefault(); goTo('contact', true); }); });
}

function panelOpen() {
  var p = $('#world-panel');
  return !!(p && p.classList.contains('is-open'));
}
function openPanel(d) {
  populatePanel(d);
  $('#world-panel').classList.add('is-open');
}
function closePanel() {
  $('#world-panel').classList.remove('is-open');
}

function setCurrent(id) {
  currentZone = id;
  Object.keys(labelEls).forEach((k) => labelEls[k].classList.toggle('is-current', k === id));
  Object.keys(dockEls).forEach((k) => dockEls[k].classList.toggle('is-current', k === id));
}

/* ---------- camera flights ---------- */
function flyTo(v, dur = 1.2) {
  panVel.x = panVel.z = 0; orbitVel = 0;
  if (reduceMotion || !window.gsap) {
    view.target.copy(v.target); view.radius = v.radius; view.theta = v.theta; view.phi = v.phi;
    requestRender();
    return;
  }
  isFlying = true;
  window.gsap.killTweensOf(view);
  window.gsap.killTweensOf(view.target);
  window.gsap.to(view, { radius: v.radius, theta: v.theta, phi: v.phi, duration: dur, ease: 'power3.inOut', onUpdate: requestRender, onComplete: () => { isFlying = false; } });
  window.gsap.to(view.target, { x: v.target.x, y: v.target.y, z: v.target.z, duration: dur, ease: 'power3.inOut', onUpdate: requestRender });
}

function districtView(d) {
  const c = chips[d.id];
  const target = new THREE.Vector3(d.x, d.cpu ? 2.4 : 1.8, d.z);
  // approach angle: look from the board-south, biased slightly by the chip's x so framing varies
  const theta = clamp(d.x * 0.018, -0.5, 0.5);
  const radius = d.big ? 20 : (d.cpu ? 22 : 15);
  return { target, radius, theta, phi: 0.72 };
}

function goTo(id, openIt) {
  const d = DISTRICTS.find((x) => x.id === id);
  if (!d) return;
  setCurrent(id);
  flyTo(districtView(d));
  hideHintSoon();
  if (openIt) {
    // plain setTimeout (not gsap.delayedCall) so the panel opens even if the rAF ticker is throttled
    if (reduceMotion) openPanel(d);
    else setTimeout(() => openPanel(d), 520);
  }
  if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
}

/* ---------- interaction: raycast pick + bounded drag orbit ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false, moved = false, lastX = 0, lastY = 0, dragBtn = 0;
const pointers = new Map();   // active pointers, for multitouch pinch
let pinchDist = 0;

/* drag-to-pan: move the look-at target across the board, aligned to the view angle */
function panBy(dx, dy) {
  const k = view.radius * 0.0019;
  const s = Math.sin(view.theta), c = Math.cos(view.theta);
  const wx = -dx * k, wz = -dy * k;
  const mx = wx * c + wz * s;
  const mz = -wx * s + wz * c;
  view.target.x += mx;
  view.target.z += mz;
  clampTarget();
  panVel.x = mx; panVel.z = mz;
}

function twoPointerDist() {
  const p = [...pointers.values()];
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}

function onPointerDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (window.gsap) { window.gsap.killTweensOf(view); window.gsap.killTweensOf(view.target); }
  isFlying = false;
  panVel.x = panVel.z = 0; orbitVel = 0;
  if (pointers.size === 1) {
    dragging = true; moved = false; dragBtn = e.button;
    lastX = e.clientX; lastY = e.clientY;
  } else if (pointers.size === 2) {
    dragging = false;        // second finger down → pinch, not pan
    pinchDist = twoPointerDist();
  }
}
function onPointerMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  // pinch-to-zoom (two fingers)
  if (pointers.size >= 2) {
    const d = twoPointerDist();
    if (pinchDist > 0 && d > 0) {
      view.radius = clamp(view.radius * (pinchDist / d), 12, 78); // spread fingers → zoom in
      requestRender();
    }
    pinchDist = d;
    return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  lastX = e.clientX; lastY = e.clientY;
  if (dragBtn === 2 || e.shiftKey) {
    view.theta -= dx * 0.005;
    view.phi = clamp(view.phi - dy * 0.004, 0.16, 1.22);
    orbitVel = -dx * 0.005;
  } else {
    panBy(dx, dy);
  }
  requestRender();
}
function onPointerUp(e) {
  const hadOne = pointers.size === 1;
  const wasDrag = moved;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  if (pointers.size === 1) {
    // dropped from pinch to one finger → resume panning from the remaining finger
    const rem = [...pointers.entries()][0];
    dragging = true; moved = true; dragBtn = 0; lastX = rem[1].x; lastY = rem[1].y;
    return;
  }
  if (pointers.size > 0) return;
  dragging = false;
  if (wasDrag || !hadOne) return;   // a real drag, or the tail of a multitouch → not a tap
  doPick(e);
}
function doPick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  Object.values(chips).forEach((c) => { meshes.push(c.body, c.top); });
  if (bizBoard) meshes.push(bizBoard);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (!hit || !hit.object.userData.zone) return;
  if (hit.object.userData.zone === 'business') { window.location.href = 'business.html'; return; }
  goTo(hit.object.userData.zone, true);
}

/* ---------- render loop (render-on-demand-ish; animates pulses) ---------- */
let renderReq = true;
function requestRender() { renderReq = true; }

const _pos = new THREE.Vector3();
const _m = new THREE.Matrix4();
function frame() {
  raf = requestAnimationFrame(frame);
  if (!running) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // startup FPS benchmark → graceful two-stage downgrade (never yanks a capable machine)
  if (benchStage < 2) {
    if (benchStart === 0) benchStart = t;
    benchFrames++;
    if (t - benchStart > 2.5) {
      const fps = benchFrames / (t - benchStart);
      if (benchStage === 0) {
        // stage 1: if struggling, shed the most expensive effect (bloom) and re-measure
        if (fps < 48 && composer) composer = null;
        benchStage = 1; benchStart = t; benchFrames = 0;
      } else {
        // stage 2: only bail to the classic site if even the lightened world is unusable
        if (fps < 22) { autoExitClassic(); return; }
        benchStage = 2;
      }
    }
  }

  // pulses always animate → keep rendering, but at a calm pace
  pulseSystems.forEach((ps) => {
    for (let i = 0; i < ps.count; i++) {
      ps.offsets[i] = (ps.offsets[i] + ps.speed * dt) % 1;
      ps.curve.getPointAt(ps.offsets[i], _pos);
      _m.makeTranslation(_pos.x, _pos.y, _pos.z);
      ps.mesh.setMatrixAt(i, _m);
    }
    ps.mesh.instanceMatrix.needsUpdate = true;
  });

  // blink leds
  Object.values(chips).forEach((c) => {
    if (c.led.userData.blink) c.led.material.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.7;
  });

  // drifting void
  if (starfield) starfield.rotation.y += dt * 0.012;

  // momentum for drag-to-pan / orbit when the user lets go
  if (!dragging && !isFlying) {
    if (Math.abs(panVel.x) + Math.abs(panVel.z) > 1e-4) {
      view.target.x += panVel.x; view.target.z += panVel.z;
      panVel.x *= 0.9; panVel.z *= 0.9; clampTarget();
    }
    if (Math.abs(orbitVel) > 1e-4) { view.theta += orbitVel; orbitVel *= 0.9; }
  }

  // camera derived from the view model
  view.phi = clamp(view.phi, 0.16, 1.22);
  spherical(camera.position, view.target, view.radius, view.theta, view.phi);
  camera.lookAt(view.target);

  if (composer) composer.render(); else renderer.render(scene, camera);
  updateLabels();
}

/* project chip world positions → DOM label screen positions */
const _v = new THREE.Vector3();
function updateLabels() {
  const w = innerWidth, h = innerHeight;
  DISTRICTS.forEach((d) => {
    const el = labelEls[d.id];
    const c = chips[d.id];
    if (!el || !c) return;
    _v.copy(c.pos); _v.y += d.cpu ? 2.6 : 1.7;
    _v.project(camera);
    const behind = _v.z > 1;
    if (behind) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
    el.style.opacity = '1'; el.style.pointerEvents = 'auto';
    el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
  });
  if (bizLabelEl) {
    _v.copy(bizForkPos); _v.project(camera);
    if (_v.z > 1) { bizLabelEl.style.opacity = '0'; bizLabelEl.style.pointerEvents = 'none'; }
    else {
      bizLabelEl.style.opacity = '1'; bizLabelEl.style.pointerEvents = 'auto';
      bizLabelEl.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
    }
  }
}

/* ---------- boot ---------- */
function bootSequence() {
  const veil = $('#world-loading');
  const msg = $('#world-loading .wl-msg');
  const msgs = ['mounting /dev/felix', 'linking districts', 'powering board', 'render: online'];
  let i = 0;
  const iv = setInterval(() => { if (msg && msgs[i]) msg.textContent = msgs[i]; i++; if (i >= msgs.length) clearInterval(iv); }, 240);

  // camera descends from high above into overview
  if (window.gsap && !reduceMotion) {
    view.target.set(0, 2, 2); view.radius = 120; view.theta = 0.0; view.phi = 0.18;
    window.gsap.to(view, { radius: OVERVIEW.radius, phi: OVERVIEW.phi, duration: 2.4, ease: 'power3.inOut', onUpdate: requestRender });
    runBootCascade();
  } else {
    Object.assign(view, { radius: OVERVIEW.radius, theta: OVERVIEW.theta, phi: OVERVIEW.phi });
    view.target.copy(OVERVIEW.target);
  }
  setTimeout(() => { if (veil) veil.classList.add('is-hidden'); }, reduceMotion ? 200 : 1100);
}

let hintTimer = 0;
function hideHintSoon() {
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { const h = $('#world-hint'); if (h) h.style.opacity = '0'; }, 400);
}

/* ---------- enter / exit ---------- */
function onResize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  requestRender();
}

function enterWorld() {
  document.documentElement.classList.add('world-on');
  try { localStorage.setItem('felix-view', 'world'); } catch (e) {}
  if (!built) {
    buildScene();
    buildHud();
    addListeners();
    bootSequence();
    // restore zone from hash if present
    const z = location.hash.replace('#/', '');
    if (DISTRICTS.find((d) => d.id === z)) setTimeout(() => goTo(z, true), 600);
  }
  running = true;
  benchStart = 0; benchFrames = 0; benchStage = 0;
  clock.start();
  onResize();
  if (!raf) frame();
  document.documentElement.classList.add('world-ready'); // tells the head safety-net the world booted
}

function autoExitClassic() {
  exitWorld();
  try { localStorage.setItem('felix-view', 'classic'); } catch (e) {}
  console.info('felix.os → switched to fast (classic) view for performance');
}

function exitWorld() {
  document.documentElement.classList.remove('world-on');
  try { localStorage.setItem('felix-view', 'classic'); } catch (e) {}
  running = false;
  closePanel();
  history.replaceState(null, '', location.pathname);
}

function addListeners() {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    if (panelOpen()) return; // a panel is open → the wheel belongs to the panel, never the world
    view.radius = clamp(view.radius + Math.sign(e.deltaY) * 2.4, 12, 78);
    requestRender();
  }, { passive: true });
  // while a panel is open, the wheel ALWAYS drives the panel — over the board or the panel —
  // so scrolling is consistent everywhere and the world never zooms underneath it
  window.addEventListener('wheel', (e) => {
    if (!panelOpen()) return;
    var body = $('#world-panel .wpanel-body');
    if (!body) return;
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= body.clientHeight;
    body.scrollTop += d;
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (document.documentElement.classList.contains('world-on')) { running = true; clock.start(); }
  });
  $('#world-classic-btn').addEventListener('click', exitWorld);
  $('#world-panel .wpanel-close').addEventListener('click', closePanel);
  // number keys 1-6 jump
  window.addEventListener('keydown', (e) => {
    if (!document.documentElement.classList.contains('world-on')) return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { closePanel(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= DISTRICTS.length) goTo(DISTRICTS[n - 1].id, true);
  });
}

/* ---------- bootstrap ---------- */
function init() {
  const exploreBtn = $('#explore-btn');
  if (exploreBtn) {
    if (FELIX.webgl) exploreBtn.style.display = 'inline-flex';
    exploreBtn.addEventListener('click', enterWorld);
  }
  if (FELIX.shouldBoot && FELIX.webgl) {
    try { enterWorld(); }
    catch (err) { console.warn('world failed, staying classic', err); document.documentElement.classList.remove('world-on', 'booting'); }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
