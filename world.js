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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* cinematic grade: vignette + chromatic aberration (boost-reactive) + film grain */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberration: { value: 0.0012 }, uVignette: { value: 0.9 }, uGrain: { value: 0.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: [
    'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime, uAberration, uVignette, uGrain;',
    'float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }',
    'void main(){',
    '  vec2 d = vUv - 0.5;',
    '  float r = texture2D(tDiffuse, vUv - d * uAberration).r;',
    '  float g = texture2D(tDiffuse, vUv).g;',
    '  float b = texture2D(tDiffuse, vUv + d * uAberration).b;',
    '  vec3 col = vec3(r, g, b);',
    '  float vig = smoothstep(0.95, 0.25, length(d) * uVignette);',
    '  col *= mix(0.68, 1.0, vig);',
    '  col += (rand(vUv + fract(uTime)) - 0.5) * uGrain;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n'),
};
let gradePass = null;

/* flowing-energy road material: bright bands stream along each copper trace */
function roadMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uBright: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uTime, uBright; uniform vec3 uColor;',
      'void main(){',
      '  float flow = fract(vUv.x * 5.0 - uTime * 0.55);',
      '  float band = smoothstep(0.0, 0.10, flow) * smoothstep(0.42, 0.10, flow);',
      '  vec3 col = uColor * (0.30 + band * 2.4) * uBright;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
}

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
let bgGrid, starfield, voidGlyphs, nextZap = 5;

/* ---------- felix.run: drive-the-packet state ---------- */
let driveMode = false;
let packet = null, packetLight = null;
const trail = [];
const drive = {
  pos: new THREE.Vector3(0, 0.9, -16),  // open south edge, facing into the board
  heading: 0,            // yaw; forward = (sin h, cos h)
  vel: new THREE.Vector3(),
  speed: 0,
  boost: 0,              // 0..1 smoothed
};
const keys = Object.create(null);
let joyX = 0, joyY = 0;  // touch joystick: steer (+right), thrust (+forward)
let dockedZone = null;   // spawn in open space — nothing docked, free to roam
let camFov = 55;
let introActive = false; // sky hero-shot + instructions before the drop-in
const visited = new Set();
let wasBoost = false;
const shards = []; let fragsTaken = 0; let turbo = false;
const journeyArches = [];

/* ---------- procedural Web-Audio (no asset files; unlocked by the drop gesture) ---------- */
let actx = null, masterGain = null, audioMuted = false, audioReady = false;
let engOsc = null, engSub = null, engGain = null, engFilter = null;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  masterGain = actx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(actx.destination);
  // ambient pad: a soft low chord through a slow-sweeping lowpass
  const padGain = actx.createGain(); padGain.gain.value = 0;
  const padFilt = actx.createBiquadFilter(); padFilt.type = 'lowpass'; padFilt.frequency.value = 600; padFilt.Q.value = 0.7;
  padGain.connect(padFilt); padFilt.connect(masterGain);
  [110, 164.81, 220, 277.18].forEach((f, i) => {
    const o = actx.createOscillator(); o.type = i > 1 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 5;
    o.connect(padGain); o.start();
  });
  padGain.gain.setTargetAtTime(0.13, actx.currentTime, 3);
  const lfo = actx.createOscillator(); lfo.frequency.value = 0.045;
  const lfoG = actx.createGain(); lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(padFilt.frequency); lfo.start();
  // engine: sub + sawtooth through a lowpass, modulated by speed
  engGain = actx.createGain(); engGain.gain.value = 0;
  engFilter = actx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 400;
  engGain.connect(masterGain);
  engOsc = actx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55; engOsc.connect(engFilter);
  engSub = actx.createOscillator(); engSub.type = 'sine'; engSub.frequency.value = 40; engSub.connect(engFilter);
  engFilter.connect(engGain);
  engOsc.start(); engSub.start();
  audioReady = true;
  applyMute();
}
function applyMute() {
  const btn = $('#world-mute'); if (btn) { btn.textContent = audioMuted ? '♪ off' : '♪ on'; btn.classList.toggle('is-off', audioMuted); }
  if (masterGain && actx) {
    const now = actx.currentTime, g = masterGain.gain;
    // linearRamp reaches EXACTLY the target (setTargetAtTime is asymptotic and
    // leaves an audible residual) — snap to true silence, gently fade back in.
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (audioMuted) g.linearRampToValueAtTime(0, now + 0.08);
    else g.linearRampToValueAtTime(0.85, now + 0.4);
  }
}
function toggleMute() { audioMuted = !audioMuted; try { localStorage.setItem('felix-muted', audioMuted ? '1' : '0'); } catch (e) {} applyMute(); }
function updateEngineAudio(speed, boost) {
  if (!audioReady) return;
  const sp = Math.min(Math.abs(speed) / 26, 1);
  const now = actx.currentTime;
  engOsc.frequency.setTargetAtTime(55 + sp * 130 + boost * 50, now, 0.08);
  engSub.frequency.setTargetAtTime(38 + sp * 30, now, 0.08);
  engFilter.frequency.setTargetAtTime(300 + sp * 1500 + boost * 600, now, 0.08);
  engGain.gain.setTargetAtTime(0.03 + sp * 0.11, now, 0.12);
}
function blip(freqs, dur, vol) {
  if (!audioReady) return;
  freqs.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(masterGain);
    const t0 = actx.currentTime + i * 0.1;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + (dur || 0.5));
    o.start(t0); o.stop(t0 + (dur || 0.5) + 0.05);
  });
}
function dockChime() { blip([493.88, 659.25, 783.99], 0.55, 0.16); }
function collectChime() { blip([880, 1318.5], 0.3, 0.14); }
function boostWhoosh() {
  if (!audioReady) return;
  const dur = 0.5, sr = actx.sampleRate, buf = actx.createBuffer(1, sr * dur, sr), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 1.2;
  const g = actx.createGain(); g.gain.value = 0.18;
  src.connect(f); f.connect(g); g.connect(masterGain);
  f.frequency.setValueAtTime(500, actx.currentTime); f.frequency.exponentialRampToValueAtTime(2600, actx.currentTime + dur);
  g.gain.setValueAtTime(0.18, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  src.start();
}
const LITE = !!(window.__FELIX && window.__FELIX.lite);
const useBloom = !LITE;
let benchStart = 0, benchFrames = 0, benchStage = 0, benchGrace = 0;
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
  const geo = new THREE.TubeGeometry(curve, 60, 0.12, 8, false);
  const mat = roadMaterial(color);
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
  renderer.setClearColor(0x0a1018, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1018, 0.0085);
  camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 400);
  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x3a4a66, 1.5));
  const key = new THREE.DirectionalLight(0xbcd0ff, 1.2);
  key.position.set(18, 40, 24);
  scene.add(key);
  const rim = new THREE.DirectionalLight(GREEN, 0.25);
  rim.position.set(-20, 12, -20);
  scene.add(rim);

  buildBackground();
  buildVoidGlyphs();

  // board
  const boardTex = makeBoardTexture();
  boardTex.repeat.set(3, 2.2);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(72, 0.6, 50),
    new THREE.MeshStandardMaterial({ map: boardTex, color: 0x16291c, roughness: 0.75, metalness: 0.3, emissive: 0x0a1a10, emissiveIntensity: 0.25 })
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
  buildSkillSigns();
  buildJourneyArches();
  buildPacket();
  buildCollectibles();

  if (useBloom) setupComposer();
  built = true;
}

/* ---------- the business-side fork: a second board the Journey trace splits toward ---------- */
let bizBoard, bizLabelEl;
const GATE = { x: -31, z: -8 };   // F van Dijk Ltd board+chip (bottom-left); dock it to portal across
const bizForkPos = new THREE.Vector3(GATE.x, 2, GATE.z);
let bizGate = null;
let portaling = false;            // true once the business-portal cinematic has started
function buildBusinessFork() {
  // the F van Dijk Ltd board lives on the playfield now: drive into its chip to dock (like any
  // other chip) and the portal cinematic fires instead of opening a side panel.
  const g = new THREE.Group();
  g.position.set(GATE.x, 0, GATE.z);
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.5, 9),
    new THREE.MeshStandardMaterial({ color: 0x0a1422, roughness: 0.6, metalness: 0.5, emissive: BLUE, emissiveIntensity: 0.16 })
  );
  b.userData.zone = 'business';
  g.add(b);
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(12, 0.5, 9)),
    new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.5 })
  ));
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0x0c1a2c, metalness: 0.7, roughness: 0.4, emissive: BLUE, emissiveIntensity: 0.22 })
  );
  chip.position.y = 0.75; chip.userData.zone = 'business';
  g.add(chip);
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 2.2),
    new THREE.MeshBasicMaterial({ map: makeChipLabelTexture('fvandijk.ltd', '#a9ccff'), transparent: true })
  );
  lbl.rotation.x = -Math.PI / 2; lbl.position.set(0, 1.28, 0);
  g.add(lbl);
  // portal "opening": a dark iris on the chip that scales open + a light beam (hidden until dock)
  const ghole = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.MeshBasicMaterial({ color: 0x01040a }));
  ghole.rotation.x = -Math.PI / 2; ghole.position.set(0, 1.3, 0); ghole.scale.setScalar(0.001); g.add(ghole);
  const gbeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 12, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  gbeam.position.set(0, 6.75, 0); gbeam.scale.y = 0.001; g.add(gbeam);
  scene.add(g);
  bizBoard = b;
  const glight = new THREE.PointLight(BLUE, 0, 22, 2); glight.position.set(GATE.x, 2.5, GATE.z); scene.add(glight);
  bizGate = { hole: ghole, beam: gbeam, light: glight };

  // the blue wire: a distinct route from the CPU (felix.c) that threads the gap between the About
  // and Journey chips, then curves down to the business board — never crossing another chip
  const wy = 0.28;
  const wireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, wy, 1),
    new THREE.Vector3(-10, wy, 0),
    new THREE.Vector3(-18, wy, -1),      // threads between About and Journey
    new THREE.Vector3(-25, wy, -4.5),
    new THREE.Vector3(GATE.x, wy, GATE.z),
  ], false, 'catmullrom', 0.2);
  const wireMat = roadMaterial(BLUE);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 90, 0.12, 8, false), wireMat));
  traceMats.push(wireMat);
  buildPulses(wireCurve, 0x7fc4ff, 3, 0.085);

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
    if (c.traceMat) { if (c.traceMat.uniforms) c.traceMat.uniforms.uBright.value = 0.12; else c.traceMat.emissiveIntensity = 0.04; }
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
  if (c.traceMat && c.traceMat.uniforms) tl.to(c.traceMat.uniforms.uBright, { value: 1, duration: 0.4 }, '<0.05');
  else if (c.traceMat) tl.to(c.traceMat, { emissiveIntensity: 0.7, duration: 0.4 }, '<0.05');
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

/* faint binary bits drifting in the void, the same green as the data-mote orbs —
   subtle "inside a computer" atmosphere, paired with occasional electric zaps (spawnZap). */
const _glyphCache = {};
function makeGlyphTex(text, hex) {
  const key = text + '|' + hex;
  if (_glyphCache[key]) return _glyphCache[key];
  const c = document.createElement('canvas');
  const font = '600 40px "JetBrains Mono", ui-monospace, monospace';
  let ctx = c.getContext('2d');
  ctx.font = font;
  const w = Math.max(48, Math.ceil(ctx.measureText(text).width) + 20);
  c.width = w; c.height = 56;
  ctx = c.getContext('2d');
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = hex;
  ctx.fillText(text, w / 2, 30);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  _glyphCache[key] = { tex: tex, aspect: w / 56 };
  return _glyphCache[key];
}
function buildVoidGlyphs() {
  const bits = ['0', '1', '0', '1', '1', '0', '10', '01', '110', '001'];
  const grp = new THREE.Group();
  const N = LITE ? 26 : 46;
  for (let i = 0; i < N; i++) {
    const g = makeGlyphTex(bits[(Math.random() * bits.length) | 0], '#7effb0'); // same green as the orbs
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: g.tex, transparent: true, opacity: 0.3 + Math.random() * 0.3,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    const r = 48 + Math.random() * 132, a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * r, -8 + Math.random() * 64, Math.sin(a) * r);
    const sc = 2.6 + Math.random() * 3.4;
    s.scale.set(sc * g.aspect, sc, 1);
    grp.add(s);
  }
  scene.add(grp);
  voidGlyphs = grp;
}

/* occasional electric zap — a brief jagged arc that flashes through the void */
function spawnZap() {
  if (!scene) return;
  const ang = Math.random() * Math.PI * 2;
  const r1 = 18 + Math.random() * 55, r2 = 18 + Math.random() * 55;
  const a2 = ang + (Math.random() - 0.5) * 1.6;
  const A = new THREE.Vector3(Math.cos(ang) * r1, 1 + Math.random() * 32, Math.sin(ang) * r1);
  const B = new THREE.Vector3(Math.cos(a2) * r2, 1 + Math.random() * 32, Math.sin(a2) * r2);
  const SEG = 9, pts = [];
  for (let i = 0; i <= SEG; i++) {
    const p = A.clone().lerp(B, i / SEG);
    if (i > 0 && i < SEG) { p.x += (Math.random() - 0.5) * 7; p.y += (Math.random() - 0.5) * 7; p.z += (Math.random() - 0.5) * 7; }
    pts.push(p);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xcfffe6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const bolt = new THREE.Line(geo, mat);
  scene.add(bolt);
  const done = () => { scene.remove(bolt); geo.dispose(); mat.dispose(); };
  if (window.gsap && !reduceMotion) window.gsap.fromTo(mat, { opacity: 0.95 }, { opacity: 0, duration: 0.3 + Math.random() * 0.2, ease: 'power2.in', onUpdate: requestRender, onComplete: done });
  else setTimeout(done, 180);
  requestRender();
}

function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.8);
  composer.addPass(bloom);
  gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass); // last pass → renders to screen
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
  buildChecklist();
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
    if (d.id === 'projects') mountAStarInProjects(clone);
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

/* live A* pathfinder — injected into the Scotland Yard AI project card (real CS, not art) */
function mountAStarInProjects(root) {
  const cards = Array.prototype.slice.call(root.querySelectorAll('.proc-card'));
  const ai = cards.find((c) => /scotland|AI Project/i.test(c.textContent));
  if (!ai) return;
  const wrap = ai.querySelector('.shot-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const cv = document.createElement('canvas');
  cv.width = 480; cv.height = 270; cv.style.width = '100%'; cv.style.display = 'block';
  wrap.appendChild(cv);
  const bar = ai.querySelector('.mini-bar');
  if (bar) { const tn = Array.prototype.slice.call(bar.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim()); if (tn) tn.textContent = 'scotland-yard-ai — live A* search'; }
  runAStar(cv);
}
function runAStar(canvas) {
  const ctx = canvas.getContext('2d');
  const COLS = 26, ROWS = 15;
  const idx = (x, y) => y * COLS + x;
  let walls, openList, came, gScore, fScore, closed, start, goal, done, path, pauseT;
  const hh = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  function reset() {
    walls = new Uint8Array(COLS * ROWS);
    for (let i = 0; i < walls.length; i++) if (Math.random() < 0.27) walls[i] = 1;
    start = { x: 1, y: ROWS >> 1 }; goal = { x: COLS - 2, y: ROWS >> 1 };
    walls[idx(start.x, start.y)] = 0; walls[idx(goal.x, goal.y)] = 0;
    openList = [start]; came = {}; gScore = {}; fScore = {}; closed = new Uint8Array(COLS * ROWS);
    gScore[idx(start.x, start.y)] = 0; fScore[idx(start.x, start.y)] = hh(start.x, start.y);
    done = false; path = null; pauseT = 0;
  }
  function step() {
    if (!openList.length) { done = true; path = []; return; }
    let bi = 0; for (let i = 1; i < openList.length; i++) if (fScore[idx(openList[i].x, openList[i].y)] < fScore[idx(openList[bi].x, openList[bi].y)]) bi = i;
    const cur = openList.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      done = true; path = []; let cx = cur.x, cy = cur.y;
      while (came[idx(cx, cy)] !== undefined) { path.push(idx(cx, cy)); const p = came[idx(cx, cy)]; cx = p.x; cy = p.y; }
      path.push(idx(start.x, start.y)); return;
    }
    closed[idx(cur.x, cur.y)] = 1;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => {
      const nx = cur.x + d[0], ny = cur.y + d[1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
      const ni = idx(nx, ny);
      if (walls[ni] || closed[ni]) return;
      const tg = gScore[idx(cur.x, cur.y)] + 1;
      if (gScore[ni] === undefined || tg < gScore[ni]) {
        came[ni] = { x: cur.x, y: cur.y }; gScore[ni] = tg; fScore[ni] = tg + hh(nx, ny);
        if (!openList.some((o) => o.x === nx && o.y === ny)) openList.push({ x: nx, y: ny });
      }
    });
  }
  function draw() {
    const w = canvas.width, hgt = canvas.height, cw = w / COLS, chh = hgt / ROWS;
    ctx.fillStyle = '#06100b'; ctx.fillRect(0, 0, w, hgt);
    const onOpen = new Uint8Array(COLS * ROWS); openList.forEach((o) => { onOpen[idx(o.x, o.y)] = 1; });
    const onPath = new Uint8Array(COLS * ROWS); if (path) path.forEach((i) => { onPath[i] = 1; });
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = idx(x, y); let c = null;
      if (walls[i]) c = '#0e1922';
      else if (onPath[i]) c = '#ffd66a';
      else if (closed[i]) c = 'rgba(34,197,94,0.30)';
      else if (onOpen[i]) c = 'rgba(125,211,252,0.5)';
      if (c) { ctx.fillStyle = c; ctx.fillRect(x * cw + 1, y * chh + 1, cw - 2, chh - 2); }
    }
    ctx.fillStyle = '#22c55e'; ctx.fillRect(start.x * cw + 1, start.y * chh + 1, cw - 2, chh - 2);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(goal.x * cw + 1, goal.y * chh + 1, cw - 2, chh - 2);
  }
  function loop() {
    if (!canvas.isConnected) return; // panel closed → stop the loop
    if (!done) { step(); step(); }
    else if (++pauseT > 80) reset();
    draw();
    requestAnimationFrame(loop);
  }
  reset(); loop();
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
  markVisited(id);
  // menu/keyboard/auto navigation warps the packet to the port so driving resumes coherently
  if (packet && id !== dockedZone) {
    const c = chips[id];
    drive.pos.set(c.pos.x, drive.pos.y, c.pos.z - (d.d / 2 + 3));
    drive.heading = 0; drive.vel.set(0, 0, 0); drive.speed = 0;
    packet.position.copy(drive.pos);
    dockedZone = id;
  }
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

/* ============================================================
   felix.run — pilot the packet (arcade hover, hand-rolled feel)
   ============================================================ */
const SHARD_POS = [[0, -8], [-12, 3], [12, 3], [-9, -16], [9, -16], [0, 24], [25, 18]];
function buildCollectibles() {
  const geo = new THREE.OctahedronGeometry(0.62, 0);
  SHARD_POS.forEach((p) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x07201f, emissive: 0x3ce0c6, emissiveIntensity: 1.5, metalness: 0.5, roughness: 0.3 }));
    m.position.set(p[0], 1.2, p[1]);
    scene.add(m);
    shards.push({ mesh: m, x: p[0], z: p[1], taken: false });
  });
}
function updateFrags() {
  const el = $('#world-frags');
  if (el) { el.textContent = '◆ ' + fragsTaken + ' / 7'; el.classList.add('is-on'); if (fragsTaken > 0) el.classList.add('got'); }
  if (fragsTaken >= shards.length && !turbo) {
    turbo = true;
    if (packet && packet.children[0]) packet.children[0].material.emissive.setHex(0xffd66a);
    const h = $('#world-hint'); if (h) { h.textContent = 'all 7 fragments collected — turbo unlocked ⚡'; h.style.opacity = '1'; }
    dockChime();
  }
}

/* crisp sign text (auto-fits) */
function makeSignTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d'); x.clearRect(0, 0, 512, 128);
  x.fillStyle = color || '#9effc0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 58; x.font = 'bold ' + fs + 'px "JetBrains Mono", monospace';
  while (x.measureText(text).width > 480 && fs > 20) { fs -= 4; x.font = 'bold ' + fs + 'px "JetBrains Mono", monospace'; }
  x.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
}
function lerpV(ax, az, bx, bz, t) { return new THREE.Vector3(ax + (bx - ax) * t, 0, az + (bz - az) * t); }

/* skill road-signs: gantries you drive under along the CPU→Skills lane */
function buildSkillSigns() {
  const cpu = chips.cpu.pos, sk = chips.skills.pos;
  const dir = Math.atan2(cpu.x - sk.x, cpu.z - sk.z); // face back toward the approach
  const labels = ['React · TS', 'Node · Go', 'Python · C', 'SQL · Haskell'];
  const postMat = new THREE.MeshStandardMaterial({ color: 0x12202c, metalness: 0.7, roughness: 0.4, emissive: GREEN, emissiveIntensity: 0.08 });
  labels.forEach((label, i) => {
    const p = lerpV(cpu.x, cpu.z, sk.x, sk.z, 0.32 + i * 0.16);
    const g = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.28, 4, 0.28);
    const L = new THREE.Mesh(postGeo, postMat); L.position.set(-3.4, 2, 0); g.add(L);
    const R = new THREE.Mesh(postGeo, postMat); R.position.set(3.4, 2, 0); g.add(R);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.55, 0.4), postMat); beam.position.y = 4; g.add(beam);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: GREEN })));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: makeSignTexture(label, '#9effc0'), transparent: true }));
    sign.position.set(0, 4, 0.24); g.add(sign);
    g.position.set(p.x, 0, p.z); g.rotation.y = dir;
    scene.add(g);
  });
}

/* journey milestone arches that light as you pass, along the CPU→Journey lane */
function buildJourneyArches() {
  const cpu = chips.cpu.pos, jr = chips.journey.pos;
  const dir = Math.atan2(jr.x - cpu.x, jr.z - cpu.z);
  const stops = ['2016 · Alun School', '2021 · Sixth Form', '2023 · Bristol BSc', 'F van Dijk Ltd'];
  stops.forEach((label, i) => {
    const p = lerpV(cpu.x, cpu.z, jr.x, jr.z, 0.32 + i * 0.17);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x101826, metalness: 0.6, roughness: 0.4, emissive: GREEN, emissiveIntensity: 0.05 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 8, 28, Math.PI), mat);
    g.add(arch);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.3), new THREE.MeshBasicMaterial({ map: makeSignTexture(label, '#bfe0ff'), transparent: true, opacity: 0.85 }));
    sign.position.set(0, 3.7, 0); g.add(sign);
    g.position.set(p.x, 0, p.z); g.rotation.y = dir;
    scene.add(g);
    journeyArches.push({ group: g, mat, x: p.x, z: p.z, lit: false });
  });
}

function buildPacket() {
  const g = new THREE.Group();
  // chamfered glowing core
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85, 0),
    new THREE.MeshStandardMaterial({ color: 0x0a1f14, emissive: GREEN, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.25 })
  );
  g.add(core);
  // bright wire shell
  g.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 0)),
    new THREE.LineBasicMaterial({ color: 0xaaffcc, transparent: true, opacity: 0.9 })
  ));
  // under-glow disc (hover pad)
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glow.rotation.x = -Math.PI / 2; glow.position.y = -0.8;
  g.add(glow);
  packetLight = new THREE.PointLight(GREEN, 2.2, 14, 2);
  packetLight.position.y = 0.4;
  g.add(packetLight);
  g.position.copy(drive.pos);
  scene.add(g);
  packet = g;

  // contrail: a short ribbon of fading quads
  const tmat = new THREE.MeshBasicMaterial({ color: 0x6effa6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), tmat.clone());
    seg.rotation.x = -Math.PI / 2; seg.visible = false;
    scene.add(seg);
    trail.push({ mesh: seg, life: 0 });
  }
}

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const PORT_R = 6, EXIT_R = 9;
const _fwd = new THREE.Vector3();
let trailTick = 0;

function updateDrive(dt) {
  // ----- input → controls -----
  const thrust = clamp(((keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 0.7 : 0)) + joyY, -1, 1);
  // chase cam looks toward +z, which mirrors world-x on screen: positive steer => screen-left.
  // So left input (A / joystick-left) must produce positive steer for "left = turns left".
  const steer = clamp(((keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0)) - joyX, -1, 1);
  const wantBoost = !!(keys['shift'] && thrust > 0);
  if (wantBoost && !wasBoost) boostWhoosh();
  wasBoost = wantBoost;
  drive.boost += ((wantBoost ? 1 : 0) - drive.boost) * Math.min(1, dt * 6);

  const MAX = (turbo ? 34 : 26) + drive.boost * 16;
  const ACC = (turbo ? 42 : 34) + drive.boost * 26;
  // longitudinal speed
  drive.speed += thrust * ACC * dt;
  drive.speed *= (1 - 1.6 * dt);                 // drag
  drive.speed = clamp(drive.speed, -10, MAX);
  if (Math.abs(drive.speed) < 0.02) drive.speed = 0;

  // steering scales with speed (can't pivot when parked); reverse flips it
  const steerAuth = clamp(Math.abs(drive.speed) / 10, 0, 1) * (drive.speed < 0 ? -1 : 1);
  drive.heading += steer * 2.4 * dt * steerAuth;

  // velocity with a little grip/slip for drift feel
  _fwd.set(Math.sin(drive.heading), 0, Math.cos(drive.heading));
  const desired = _fwd.clone().multiplyScalar(drive.speed);
  drive.vel.x += (desired.x - drive.vel.x) * Math.min(1, dt * 8);
  drive.vel.z += (desired.z - drive.vel.z) * Math.min(1, dt * 8);
  drive.pos.x += drive.vel.x * dt;
  drive.pos.z += drive.vel.z * dt;

  // keep on the board
  if (drive.pos.x < -34 || drive.pos.x > 34) { drive.pos.x = clamp(drive.pos.x, -34, 34); drive.vel.x *= -0.3; }
  if (drive.pos.z < -24 || drive.pos.z > 30) { drive.pos.z = clamp(drive.pos.z, -24, 30); drive.vel.z *= -0.3; }

  // push out of chip footprints (simple AABB)
  DISTRICTS.forEach((d) => {
    const hw = d.w / 2 + 1, hd = d.d / 2 + 1;
    const dx = drive.pos.x - d.x, dz = drive.pos.z - d.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      if (hw - Math.abs(dx) < hd - Math.abs(dz)) { drive.pos.x = d.x + Math.sign(dx || 1) * hw; drive.vel.x *= -0.2; }
      else { drive.pos.z = d.z + Math.sign(dz || 1) * hd; drive.vel.z *= -0.2; }
    }
  });

  // visuals
  const bob = Math.sin(clock.elapsedTime * 6) * 0.06;
  packet.position.set(drive.pos.x, drive.pos.y + bob, drive.pos.z);
  packet.rotation.y = drive.heading;
  packet.rotation.z = -steer * steerAuth * 0.35;          // lean into turns
  packet.children[0].rotation.x += dt * 2;                 // spin core
  if (packetLight) packetLight.intensity = 2.0 + drive.boost * 2.5;

  // contrail
  trailTick += dt;
  if (trailTick > 0.03 && Math.abs(drive.speed) > 3) {
    trailTick = 0;
    const seg = trail.find((s) => s.life <= 0) || trail[0];
    seg.mesh.position.set(drive.pos.x, 0.2, drive.pos.z);
    seg.life = 1;
  }
  trail.forEach((s) => {
    if (s.life > 0) {
      s.life -= dt * 1.8;
      s.mesh.visible = s.life > 0;
      s.mesh.material.opacity = Math.max(0, s.life) * 0.5;
      const sc = 0.4 + (1 - s.life) * 1.0;
      s.mesh.scale.set(sc, sc, sc);
    }
  });

  // ----- light journey arches as you pass under them -----
  for (let i = 0; i < journeyArches.length; i++) {
    const a = journeyArches[i];
    if (a.lit) continue;
    if (Math.hypot(drive.pos.x - a.x, drive.pos.z - a.z) < 4.2) {
      a.lit = true;
      if (window.gsap) window.gsap.to(a.mat, { emissiveIntensity: 0.85, duration: 0.5, onUpdate: requestRender });
      else a.mat.emissiveIntensity = 0.85;
    }
  }

  // ----- collect data-fragments -----
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (s.taken) continue;
    if (Math.hypot(drive.pos.x - s.x, drive.pos.z - s.z) < 2.6) {
      s.taken = true; s.mesh.visible = false; fragsTaken++; collectChime(); updateFrags();
    }
  }

  // ----- dock the F van Dijk Ltd chip (same port radius as any chip) → portal across instead of a panel -----
  if (!portaling && Math.hypot(drive.pos.x - GATE.x, drive.pos.z - GATE.z) < PORT_R) { enterBusinessPortal(); return; }

  // ----- docking: arrive at a district → boot it (nearest-within-port, hysteresis on exit) -----
  let near = null, nd = 1e9;
  for (const d of DISTRICTS) {
    const c = chips[d.id];
    const dist = Math.hypot(drive.pos.x - c.pos.x, drive.pos.z - c.pos.z);
    if (dist < nd) { nd = dist; near = d.id; }
  }
  if (near && nd < PORT_R) {
    if (dockedZone !== near) { dockedZone = near; drive.speed *= 0.3; dockChime(); goTo(near, true); }
  } else if (nd > EXIT_R) {
    dockedZone = null;
  }

  updateEngineAudio(drive.speed, drive.boost);
}

const _ct = new THREE.Vector3();
function updateChaseCam(dt) {
  _fwd.set(Math.sin(drive.heading), 0, Math.cos(drive.heading));
  const sp = clamp(Math.abs(drive.speed) / 26, 0, 1);
  // target = packet + slight up + look-ahead in travel direction
  _ct.set(drive.pos.x + _fwd.x * (2 + sp * 4), drive.pos.y + 1.6, drive.pos.z + _fwd.z * (2 + sp * 4));
  view.target.lerp(_ct, Math.min(1, dt * 4));
  view.theta = lerpAngle(view.theta, drive.heading + Math.PI, Math.min(1, dt * 3.5));
  const targetR = 13 + sp * 3 + drive.boost * 2;
  view.radius += (targetR - view.radius) * Math.min(1, dt * 3);
  view.phi += (0.92 - view.phi) * Math.min(1, dt * 3);
  // speed → FOV punch
  const targetFov = 55 + sp * 8 + drive.boost * 6;
  camFov += (targetFov - camFov) * Math.min(1, dt * 3);
  if (Math.abs(camera.fov - camFov) > 0.05) { camera.fov = camFov; camera.updateProjectionMatrix(); }
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

  // startup FPS benchmark → graceful two-stage downgrade (never yanks a capable machine).
  // Only measure *steady-state driving* over a contiguous window: the intro is an idle
  // orbit and the one-time drop renders a big shader/texture-compile hitch — neither is
  // representative, and measuring them used to cause a false bail right after landing.
  if (benchStage < 2) {
    if (driveMode && !isFlying && !panelOpen() && t > benchGrace) {
      if (benchStart === 0) { benchStart = t; benchFrames = 0; }
      benchFrames++;
      if (t - benchStart > 2.5) {
        const fps = benchFrames / (t - benchStart);
        if (benchStage === 0) {
          // stage 1: if struggling, shed the most expensive effect (bloom) and re-measure
          if (fps < 48 && composer) composer = null;
          benchStage = 1; benchStart = 0;
        } else {
          // stage 2: only bail to the classic site if even the lightened world is unusable
          if (fps < 22) { autoExitClassic(); return; }
          benchStage = 2;
        }
      }
    } else {
      benchStart = 0; // window interrupted (intro / flying / panel) → restart when driving resumes
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

  // flowing-energy roads
  for (let i = 0; i < traceMats.length; i++) {
    const m = traceMats[i];
    if (m && m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = t;
  }

  // spin/bob the collectible fragments
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (s.taken) continue;
    s.mesh.rotation.y = t * 1.5; s.mesh.rotation.x = t * 0.8;
    s.mesh.position.y = 1.2 + Math.sin(t * 2 + s.x) * 0.25;
  }

  // drifting void
  if (starfield) starfield.rotation.y += dt * 0.012;
  if (voidGlyphs) voidGlyphs.rotation.y -= dt * 0.006; // binary layer drifts the other way for subtle parallax
  if (!reduceMotion && t > nextZap && !panelOpen()) { nextZap = t + 3.5 + Math.random() * 5; spawnZap(); }

  if (introActive && packet) {
    // sky hero shot: packet hovers/spins above the board, camera slowly orbits
    packet.rotation.y += dt * 0.5;
    packet.position.set(0, 42 + Math.sin(t * 1.2) * 0.7, -16);
    view.theta += dt * 0.06;
  } else if (driveMode && packet && !isFlying && !panelOpen()) {
    // felix.run: drive the packet; the chase cam feeds the same view model
    updateDrive(dt);
    updateChaseCam(dt);
  } else if (!dragging && !isFlying) {
    // momentum for drag-to-pan / orbit when the user lets go (overview mode)
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

  if (gradePass) { gradePass.uniforms.uTime.value = t; gradePass.uniforms.uAberration.value = 0.0011 + drive.boost * 0.004; }
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
  // hand off from the cinematic boot to the sky intro (reduced-motion stays in click/overview mode)
  if (!reduceMotion) setTimeout(startIntro, 2400);
}

/* ---------- intro: hover in the sky over a hero view, then drop in ---------- */
function startIntro() {
  if (driveMode) return;
  introActive = true;
  if (window.gsap) { window.gsap.killTweensOf(view); window.gsap.killTweensOf(view.target); }
  if (packet) packet.position.set(0, 42, -16);
  view.target.set(0, 2, 0); view.radius = 76; view.theta = 0; view.phi = 0.5;
  const el = $('#world-intro'); if (el) { el.hidden = false; el.style.opacity = ''; }
  // touch devices: relabel the keyboard-centric prompts
  if (matchMedia('(pointer: coarse)').matches) {
    const go = $('#world-intro .intro-go'); if (go) go.textContent = 'tap to drop in ▾';
    const hint = $('#world-hint'); if (hint) hint.textContent = 'left stick to drive · BOOST to dash · arrive at a chip to open it · dock below to jump';
  }
  requestRender();
}

function startDrop() {
  if (!introActive) return;
  introActive = false;
  try { const m = localStorage.getItem('felix-muted'); audioMuted = m === '1' || (m === null && reduceMotion); } catch (e) { audioMuted = reduceMotion; }
  initAudio(); // the drop gesture unlocks WebAudio
  const el = $('#world-intro');
  if (el) { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => { el.hidden = true; }, 420); }
  isFlying = true;
  if (packet) { packet.rotation.y = 0; packet.rotation.z = 0; } // fall facing forward so driving doesn't snap the orientation
  if (window.gsap && !reduceMotion) {
    window.gsap.killTweensOf(view); window.gsap.killTweensOf(view.target);
    window.gsap.to(packet.position, { y: 0.9, duration: 1.2, ease: 'bounce.out', onUpdate: requestRender });
    window.gsap.to(view, { radius: 13, theta: Math.PI, phi: 0.92, duration: 1.2, ease: 'power2.inOut', onUpdate: requestRender });
    window.gsap.to(view.target, { x: 0, y: 1.6, z: -13, duration: 1.2, ease: 'power2.inOut', onUpdate: requestRender, onComplete: finishDrop });
    setTimeout(landingFlash, 850);
  } else { finishDrop(); }
}

function finishDrop() {
  drive.pos.set(0, 0.9, -16); drive.heading = 0; drive.vel.set(0, 0, 0); drive.speed = 0;
  dockedZone = null;
  // chase-cam resting pose (heading 0 → forward +z)
  const rest = { tx: 0, ty: drive.pos.y + 1.6, tz: drive.pos.z + 2 };
  function beginDriving() {
    isFlying = false; driveMode = true;
    benchStart = 0; benchFrames = 0; benchStage = 0; benchGrace = clock.elapsedTime + 1.2; // skip the warm-up
    document.documentElement.classList.add('world-driving'); // reveal touch joystick
    const cl = $('#world-checklist'); if (cl) cl.classList.add('is-on');
    const h = $('#world-hint'); if (h) { h.style.opacity = '1'; hideHintSoon(); }
  }
  // ease from the close landing pose out into the driving view, THEN hand to the chase cam
  // (avoids the hard snap the chase-cam catch-up used to make right as the bounce settled)
  if (window.gsap && !reduceMotion) {
    isFlying = true; // hold the chase cam idle during the settle
    window.gsap.to(view.target, { x: rest.tx, y: rest.ty, z: rest.tz, duration: 1.0, ease: 'power2.inOut', onUpdate: requestRender });
    window.gsap.to(view, { radius: 13, phi: 0.92, theta: Math.PI, duration: 1.0, ease: 'power2.inOut', onUpdate: requestRender, onComplete: beginDriving });
  } else {
    view.target.set(rest.tx, rest.ty, rest.tz); view.radius = 13; view.phi = 0.92; view.theta = Math.PI;
    beginDriving();
  }
}

function landingFlash() {
  if (!scene) return;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.85, 36),
    new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.18, -16); scene.add(ring);
  if (window.gsap) {
    window.gsap.to(ring.scale, { x: 16, y: 16, z: 16, duration: 0.9, ease: 'power2.out', onUpdate: requestRender });
    window.gsap.to(ring.material, { opacity: 0, duration: 0.9, ease: 'power2.out', onComplete: () => { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); } });
  }
}

/* ---------- business portal: drive in → dive → turn blue → hand off to fvandijk.ltd ---------- */
function openBizGate() {
  if (!bizGate) return;
  if (!window.gsap || reduceMotion) { bizGate.hole.scale.setScalar(1); return; }
  window.gsap.to(bizGate.hole.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'power2.out', onUpdate: requestRender });
  window.gsap.to(bizGate.beam.scale, { y: 1, duration: 1.2, ease: 'power2.out', onUpdate: requestRender });
  window.gsap.to(bizGate.beam.material, { opacity: 0.45, duration: 0.7, ease: 'power2.out', onUpdate: requestRender });
  window.gsap.to(bizGate.light, { intensity: 3.8, duration: 0.7, onUpdate: requestRender });
}

function showPortalOverlay() {
  let ov = document.getElementById('world-portal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'world-portal'; ov.innerHTML = '<span class="wp-dot"></span>'; document.body.appendChild(ov); }
  requestAnimationFrame(() => ov.classList.add('is-on'));
}

function goToBusiness() {
  try { sessionStorage.setItem('felix-arrival', '1'); } catch (e) {}
  window.location.href = 'business.html';
}

function enterBusinessPortal() {
  if (portaling) return;
  portaling = true;
  isFlying = true;                       // freeze the drive loop; gsap drives the cinematic
  drive.speed = 0; drive.vel.set(0, 0, 0);
  openBizGate();
  try { boostWhoosh(); } catch (e) {}
  if (!window.gsap || reduceMotion || !packet) { goToBusiness(); return; }
  const core = packet.children[0], wire = packet.children[1], glow = packet.children[2];
  const cFrom = new THREE.Color(GREEN), cTo = new THREE.Color(BLUE), cTmp = new THREE.Color();
  const wFrom = new THREE.Color(0xaaffcc), wTo = new THREE.Color(0xaaccff), wTmp = new THREE.Color();
  const col = { v: 0 };
  // 1) glide onto the open gate and hover
  window.gsap.to(packet.position, { x: GATE.x, z: GATE.z, duration: 0.7, ease: 'power2.out', onUpdate: requestRender });
  // 2) clearly shift green -> blue while it hovers (drawn out for legibility)
  window.gsap.to(col, { v: 1, duration: 1.3, delay: 0.55, ease: 'sine.inOut', onUpdate: () => {
    cTmp.copy(cFrom).lerp(cTo, col.v);
    if (core && core.material.emissive) core.material.emissive.copy(cTmp);
    if (glow && glow.material.color) glow.material.color.copy(cTmp);
    if (wire && wire.material.color) wire.material.color.copy(wTmp.copy(wFrom).lerp(wTo, col.v));
    if (packetLight) packetLight.color.copy(cTmp);
    requestRender();
  } });
  // 3) only then dive through, slowly, camera following down
  window.gsap.to(packet.position, { y: -6, duration: 1.5, delay: 1.5, ease: 'power2.in', onUpdate: requestRender });
  window.gsap.to(packet.scale, { x: 0.25, y: 0.25, z: 0.25, duration: 1.5, delay: 1.5, ease: 'power2.in', onUpdate: requestRender });
  window.gsap.to(view.target, { x: GATE.x, y: 0.5, z: GATE.z, duration: 2.0, ease: 'power2.inOut', onUpdate: requestRender });
  window.gsap.to(view, { radius: 9, phi: 0.3, duration: 2.0, ease: 'power2.in', onUpdate: requestRender });
  setTimeout(showPortalOverlay, 2150);
  setTimeout(goToBusiness, 3200);
}

/* ---------- exploration checklist ---------- */
function buildChecklist() {
  const el = $('#world-checklist'); if (!el) return;
  el.innerHTML = '<p class="cl-head mono">EXPLORE <span id="cl-count">0/' + DISTRICTS.length + '</span></p>' +
    DISTRICTS.map((d) => `<div class="cl-row" data-cl="${d.id}"><span class="cl-box" aria-hidden="true">▢</span><span class="cl-name">${d.cpu ? 'felix.c' : d.name}</span></div>`).join('');
}
function markVisited(id) {
  if (visited.has(id) || !DISTRICTS.find((d) => d.id === id)) return;
  visited.add(id);
  const row = document.querySelector('.cl-row[data-cl="' + id + '"]');
  if (row) { row.classList.add('is-done'); const b = row.querySelector('.cl-box'); if (b) b.textContent = '☑'; }
  const cnt = $('#cl-count'); if (cnt) cnt.textContent = visited.size + '/' + DISTRICTS.length;
  if (visited.size === DISTRICTS.length) {
    const head = $('#world-checklist .cl-head'); if (head) { head.classList.add('cl-complete'); head.firstChild.textContent = 'EXPLORED ✓ '; }
  }
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
  try { localStorage.setItem('felix-view2', 'world'); } catch (e) {}
  if (actx && actx.state === 'suspended' && !audioMuted) actx.resume(); // returning from classic view: bring audio back
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
  // session-only fallback: never persist, so a perf dip can't permanently override the 3D default
  exitWorld(false);
  console.info('felix.os → switched to fast (classic) view for performance');
}

function exitWorld(persist) {
  try {
    if (persist === false) sessionStorage.setItem('felix-skip3d', '1'); // perf bail → classic for this load only
    else localStorage.setItem('felix-view2', 'classic');               // explicit choice sticks
  } catch (e) {}
  // Full reload so the classic site initialises against a VISIBLE DOM. Booting in 3D hides
  // #main (html.world-on), so its scroll/pin/morph choreography measured a display:none hero
  // and an in-page reveal left it broken. A reload is the same clean path as clicking the tabs.
  if (location.hash) history.replaceState(null, '', location.pathname);
  location.reload();
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
  $('#world-classic-btn').addEventListener('click', () => exitWorld(true)); // explicit choice → persist
  $('#world-panel .wpanel-close').addEventListener('click', closePanel);
  const introEl = $('#world-intro');
  if (introEl) introEl.addEventListener('click', () => { if (introActive) startDrop(); });
  const muteBtn = $('#world-mute');
  if (muteBtn) muteBtn.addEventListener('click', toggleMute);

  // touch controls: virtual joystick + boost button
  if (matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('world-touch');
  const joy = $('#world-joy'); const knob = joy && joy.querySelector('.joy-knob');
  if (joy) {
    let jid = null, jcx = 0, jcy = 0; const R = 42;
    const moveJoy = (e) => {
      let dx = e.clientX - jcx, dy = e.clientY - jcy; const m = Math.hypot(dx, dy);
      if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      joyX = clamp(dx / R, -1, 1); joyY = clamp(-dy / R, -1, 1);
      if (knob) knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    };
    const endJoy = (e) => { if (e.pointerId === jid) { jid = null; joyX = 0; joyY = 0; if (knob) knob.style.transform = 'translate(-50%,-50%)'; } };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jcx = r.left + r.width / 2; jcy = r.top + r.height / 2; try { joy.setPointerCapture(jid); } catch (er) {} moveJoy(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) moveJoy(e); });
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  }
  const boostBtn = $('#world-boost');
  if (boostBtn) {
    boostBtn.addEventListener('pointerdown', (e) => { keys['shift'] = true; e.preventDefault(); });
    const bEnd = () => { keys['shift'] = false; };
    boostBtn.addEventListener('pointerup', bEnd); boostBtn.addEventListener('pointercancel', bEnd); boostBtn.addEventListener('pointerleave', bEnd);
  }
  // driving keys
  window.addEventListener('keydown', (e) => {
    if (!document.documentElement.classList.contains('world-on')) return;
    if (e.target && e.target.matches && e.target.matches('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (introActive) { if (k === 'c') { exitWorld(); return; } e.preventDefault(); startDrop(); return; }
    if (k === 'c') { exitWorld(); return; }
    if (k === 'm') { toggleMute(); return; }
    if (e.key === 'Escape') { closePanel(); return; }
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(k)) {
      keys[k === ' ' ? 'space' : k] = true;
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      hideHintSoon();
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= DISTRICTS.length) goTo(DISTRICTS[n - 1].id, true);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keys[k === ' ' ? 'space' : k] = false;
  });
  // dropping a panel resumes driving from the port (don't re-dock immediately handled by dockedZone)
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
