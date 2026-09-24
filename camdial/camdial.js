import {
  d as V3, g as Color, i as Mesh, j as Box, k as Plane, l as Group,
  q as StdMat, u as makeTex, v as ease, w as lerp, x as clamp01,
  y as createScene, z as RoundedBox, h as BasicMat, s as seed, t as fbm
} from "/room-7JL4AUEC.js";

const S = createScene({ canvas: document.getElementById("scene"), focus: new V3(0, 0.62, 0) });
const { scene, camera, still } = S;

const N = 12;
const GAP = 0.185, RAIL_H = 1.0, BASE_Y = 0.02;
const rnd = (() => { let s = 7; return () => (s = s * 16807 % 2147483647) / 2147483647; })();

const NAMES = ["exposure","gain","brightness","contrast","saturation","sharpness",
               "white balance","focus","zoom","backlight","hue","power freq"];

const saved = Array.from({ length: N }, () => 0.28 + rnd() * 0.6);
const DEFAULT = 0.5;

const wall = new Group();
const railMat = new StdMat({ color: new Color("#1a1d22"), roughness: .55, metalness: .6 });
const fillMat = new StdMat({ color: new Color("#3ddc97"), emissive: new Color("#3ddc97"), emissiveIntensity: .75, roughness: .32, metalness: 0 });
const deadMat = new StdMat({ color: new Color("#3a4048"), roughness: .75, metalness: .1 });
const knobMat = new StdMat({ color: new Color("#eef2f6"), roughness: .38, metalness: .15 });
const C_DEAD = new Color("#39414a"), C_LIVE = new Color("#3ddc97"), C_OFF = new Color("#0e1114");

const railGeo = new RoundedBox(0.072, RAIL_H, 0.038, 2, .013);
const fillGeo = new Box(0.036, 1, 0.014);
const knobGeo = new RoundedBox(0.148, 0.056, 0.092, 2, .016);

const fills = [], knobs = [], dead = [];
const x0 = -((N - 1) * GAP) / 2;

for (let i = 0; i < N; i++) {
  const x = x0 + i * GAP;
  const rail = new Mesh(railGeo, railMat);
  rail.position.set(x, BASE_Y + RAIL_H / 2, 0);
  rail.castShadow = rail.receiveShadow = true;
  wall.add(rail);

  const f = new Mesh(fillGeo, fillMat.clone());
  f.position.set(x, BASE_Y, 0.021);
  f.scale.y = 0.0001;
  wall.add(f);
  fills.push(f);

  const k = new Mesh(knobGeo, knobMat);
  k.position.set(x, BASE_Y, 0.014);
  k.castShadow = k.receiveShadow = true;
  wall.add(k);
  knobs.push(k);
}

// soft contact shadow under the wall
const shTex = makeTex(256, 64, (d, w, h) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x / w - .5) * 2, v = (y / h - .5) * 2;
    const a = Math.max(0, 1 - Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 2.2), .5));
    const i = (y * w + x) * 4;
    d[i] = d[i+1] = d[i+2] = 0; d[i+3] = Math.pow(a, 1.6) * 165;
  }
});
const sh = new Mesh(new Plane((N - 1) * GAP + 0.6, 0.72), new BasicMat({ map: shTex, transparent: true, depthWrite: false }));
sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002;
wall.add(sh);

scene.add(wall);

// ---- scroll ----
let target = 0;
const stage = document.getElementById("stage");
const onScroll = () => {
  if (stage) {
    const span = stage.offsetHeight - innerHeight;
    const gone = -stage.getBoundingClientRect().top;
    target = span > 0 ? clamp01(gone / span) : 0;
  } else {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? scrollY / max : 0;
  }
};
addEventListener("scroll", onScroll, { passive: true });
onScroll();
let p = target;

const cnt = document.getElementById("cnt");
const log = document.getElementById("log");
let lastCount = -1, lastPhase = "";

const RESET_A = 0.30, RESET_B = 0.44, HOLD = 0.50, REST_A = 0.52, REST_B = 0.97;

S.start((t, dt) => {
  p += (target - p) * (still ? 1 : Math.min(1, dt * 4));

  const intro = ease(clamp01(p / 0.26));
  const resetK = clamp01((p - RESET_A) / (RESET_B - RESET_A));

  let restored = 0;
  for (let i = 0; i < N; i++) {
    const s = saved[i];
    // per-slider restore window, staggered left to right
    const a = REST_A + (i / N) * (REST_B - REST_A) * 0.72;
    const b = a + (REST_B - REST_A) * 0.22;
    const back = ease(clamp01((p - a) / (b - a)));
    if (back > 0.5) restored++;

    const knocked = lerp(s, DEFAULT, ease(resetK));
    const v = lerp(knocked, s, back);

    const y = BASE_Y + v * RAIL_H;
    // a little overshoot as it snaps back
    const kick = back > 0 && back < 1 ? Math.sin(back * Math.PI) * 0.035 * (s - DEFAULT > 0 ? 1 : -1) : 0;
    knobs[i].position.y = y + kick;
    knobs[i].rotation.z = (1 - back) * resetK * 0.12 * (i % 2 ? 1 : -1);
    knobs[i].scale.setScalar(1 + Math.sin(clamp01(back) * Math.PI) * 0.09);

    const f = fills[i];
    f.scale.y = Math.max(0.0001, v * RAIL_H);
    f.position.y = BASE_Y + (v * RAIL_H) / 2;
    const live = Math.max(back, 1 - resetK);
    f.material.color.lerpColors(C_DEAD, C_LIVE, live);
    f.material.emissive.lerpColors(C_OFF, C_LIVE, live);
    f.material.emissiveIntensity = 0.12 + live * 1.55;
  }

  if (cnt && restored !== lastCount) { cnt.textContent = String(restored); lastCount = restored; }
  if (log) {
    let phase;
    if (p < RESET_A) phase = "saved — scroll to cut the power";
    else if (p < HOLD) phase = "power lost — back to factory defaults";
    else if (restored < N) phase = "restoring " + NAMES[Math.min(N - 1, restored)];
    else phase = "all " + N + " controls back — 8 seconds";
    if (phase !== lastPhase) { log.textContent = phase; log.classList.toggle("done", restored === N); lastPhase = phase; }
  }

  const drift = still ? 0 : Math.sin(t * 0.00035) * 0.03;
  const ang = lerp(-0.42, 0.62, intro) + drift;
  const rad = lerp(5.6, 3.05, intro);
  const hgt = lerp(2.15, 1.12, intro);
  camera.position.set(Math.sin(ang) * rad, hgt + drift * 0.6, Math.cos(ang) * rad);
  camera.lookAt(lerp(-1.45, 0, intro), lerp(1.0, 0.56, intro), 0);
  return { fade: intro };
});
