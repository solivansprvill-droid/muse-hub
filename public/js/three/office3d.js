// Muse 总裁办公室 3D 场景（three.js，等距视角，可拖动旋转/缩放/平移）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }); }
function box(w, h, d, color, x, y, z, parent, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function screenTexture(draw, w = 512, h = 320) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const update = data => { draw(cv.getContext('2d'), w, h, data); tex.needsUpdate = true; };
  return { tex, update };
}
const STATUS_COLOR = { doing: '#2bc4a4', waiting: '#e8a03a', scheduled: '#8b6cf0', shelved: '#7d8696', done: '#40c070' };
const STATUS_NAME = { doing: '正在干', waiting: '等你', scheduled: '定时', shelved: '搁置', done: '已完成' };

function drawTasks(c, w, h, d = {}) {
  c.fillStyle = '#0d1422'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1b2638'; c.fillRect(0, 0, w, 40);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(20 + i * 18, 20, 6, 0, 7); c.fill(); });
  c.fillStyle = '#e8eef8'; c.font = 'bold 20px sans-serif'; c.fillText(d.title || 'Muse 工作台', 80, 27);
  const tasks = (d.tasks || []).slice(0, 6);
  if (!tasks.length) { c.fillStyle = '#7d8aa0'; c.font = '20px sans-serif'; c.fillText('目前没有进行中的任务', 24, 90); return; }
  tasks.forEach((t, i) => {
    const y = 66 + i * 44;
    c.fillStyle = STATUS_COLOR[t.status] || '#888'; c.fillRect(20, y - 16, 64, 24);
    c.fillStyle = '#081018'; c.font = 'bold 14px sans-serif'; c.fillText(STATUS_NAME[t.status] || '', 28, y + 1);
    c.fillStyle = '#dfe7f3'; c.font = '18px sans-serif'; c.fillText(t.title.slice(0, 18), 96, y + 2);
    c.fillStyle = '#5f6d84'; c.font = '13px sans-serif'; c.fillText((t.detail || '').slice(0, 30), 96, y + 20);
  });
}
function drawCode(c, w, h, d = {}) {
  c.fillStyle = '#0b121c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1b2638'; c.fillRect(0, 0, w, 34);
  c.fillStyle = '#9fb0c8'; c.font = '16px monospace'; c.fillText((d.current ? '▶ ' + d.current : '● 待命中').slice(0, 26), 14, 23);
  const t = d.t || 0;
  for (let i = 0; i < 11; i++) {
    const len = 80 + ((i * 97 + Math.floor(t)) % 260);
    c.fillStyle = ['#2bc4a4', '#5d9be8', '#c792ea', '#e8a03a', '#7d8aa0'][i % 5];
    c.fillRect(20 + (i % 3) * 18, 50 + i * 24, len, 9);
  }
}

export function createOffice(container, { onReady } = {}) {
  const W = () => container.clientWidth, H = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#25335a');
  const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 200);
  camera.position.set(7.5, 6.2, 8.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.2, 0); controls.enableDamping = true; controls.minDistance = 4; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI / 2.05;
  controls.update();

  scene.add(new THREE.HemisphereLight('#c8d8ff', '#3a3040', 0.9));
  const sun = new THREE.DirectionalLight('#fff3dd', 1.6); sun.position.set(5, 9, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
  const lamp = new THREE.PointLight('#ffd9a0', 6, 6); lamp.position.set(-1.6, 2.4, -0.6); scene.add(lamp);

  const room = new THREE.Group(); scene.add(room);
  // 地板（瓷砖）
  const tile = document.createElement('canvas'); tile.width = tile.height = 128; const tc = tile.getContext('2d');
  tc.fillStyle = '#3e4a63'; tc.fillRect(0, 0, 128, 128); tc.strokeStyle = '#33405a'; tc.lineWidth = 3; tc.strokeRect(0, 0, 128, 128);
  const ft = new THREE.CanvasTexture(tile); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(8, 8); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  // 地毯
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), mat('#34508e')); rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.01, 0.6); rug.receiveShadow = true; room.add(rug);
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), mat('#9a3c4c')); rug2.rotation.x = -Math.PI / 2; rug2.position.set(3.6, 0.012, 1.6); room.add(rug2);
  // 墙
  box(12, 5, 0.2, '#2b3c6e', 0, 2.5, -6, room);
  box(0.2, 5, 12, '#2f4276', -6, 2.5, 0, room);
  // 大窗户 + 城市夜景
  const city = document.createElement('canvas'); city.width = 1024; city.height = 512; const cc = city.getContext('2d');
  const g = cc.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#2c4a8a'); g.addColorStop(1, '#6d8fd0'); cc.fillStyle = g; cc.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) {
    const bw = 30 + Math.random() * 60, bh = 120 + Math.random() * 330, x = Math.random() * 1024;
    cc.fillStyle = `hsl(222, 35%, ${18 + Math.random() * 14}%)`; cc.fillRect(x, 512 - bh, bw, bh);
    for (let wy = 512 - bh + 10; wy < 500; wy += 16) for (let wx = x + 5; wx < x + bw - 6; wx += 11) if (Math.random() < 0.35) { cc.fillStyle = Math.random() < 0.5 ? '#ffd88a' : '#9fd0ff'; cc.fillRect(wx, wy, 5, 7); }
  }
  const cityTex = new THREE.CanvasTexture(city); cityTex.colorSpace = THREE.SRGBColorSpace;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), new THREE.MeshBasicMaterial({ map: cityTex })); win.position.set(-0.6, 2.4, -5.88); room.add(win);
  for (let i = 0; i <= 4; i++) box(0.08, 3.3, 0.1, '#e9eef7', -3.2 + i * 1.3, 2.4, -5.84, room);
  box(5.4, 0.1, 0.12, '#e9eef7', -0.6, 4.02, -5.84, room); box(5.4, 0.1, 0.12, '#e9eef7', -0.6, 0.8, -5.84, room); box(5.4, 0.08, 0.1, '#e9eef7', -0.6, 2.4, -5.84, room);
  // 后墙大显示屏（任务板）
  const wallScreen = screenTexture(drawTasks, 768, 360);
  box(3.4, 1.7, 0.08, '#111', 3.6, 3.1, -5.86, room);
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.55), new THREE.MeshBasicMaterial({ map: wallScreen.tex })); ws.position.set(3.6, 3.1, -5.8); room.add(ws);
  // 书架（左墙）
  const shelf = new THREE.Group(); shelf.position.set(-5.5, 0, -2.4); room.add(shelf);
  box(0.8, 3.2, 2.4, '#b9773d', 0, 1.6, 0, shelf);
  for (let s = 0; s < 4; s++) {
    box(0.7, 0.06, 2.3, '#8d5a2c', 0.06, 0.4 + s * 0.75, 0, shelf);
    let z = -1.05; while (z < 1.0) { const bw = 0.08 + Math.random() * 0.1; box(0.5, 0.45 + Math.random() * 0.15, bw, ['#d0453b', '#3b7bd0', '#e0b33b', '#3bb07a', '#8b4bd0', '#e07a3b'][Math.floor(Math.random() * 6)], 0.12, 0.68 + s * 0.75, z + bw / 2, shelf); z += bw + 0.02; }
  }
  // L 形办公桌
  const desk = new THREE.Group(); desk.position.set(-0.4, 0, -1.6); room.add(desk);
  const wood = mat('#d79b5c'), wood2 = mat('#b97a3e');
  box(4.2, 0.12, 1.5, wood, 0, 1.0, 0, desk);
  box(1.4, 0.95, 1.4, wood2, -1.35, 0.48, 0, desk); box(1.4, 0.95, 1.4, wood2, 1.35, 0.48, 0, desk);
  for (let k = 0; k < 3; k++) { box(1.3, 0.02, 0.02, '#6d4523', -1.35, 0.25 + k * 0.3, 0.71, desk); box(1.3, 0.02, 0.02, '#6d4523', 1.35, 0.25 + k * 0.3, 0.71, desk); }
  // 显示器 ×2
  const monA = screenTexture(drawTasks, 512, 320), monB = screenTexture(drawCode, 512, 320);
  [[-0.65, monA], [0.75, monB]].forEach(([x, s], i) => {
    const m = new THREE.Group(); m.position.set(x, 1.06, -0.35); m.rotation.y = i ? -0.18 : 0.18; desk.add(m);
    box(0.1, 0.45, 0.1, '#222', 0, 0.22, 0, m); box(0.45, 0.03, 0.3, '#222', 0, 0.01, 0, m);
    box(1.25, 0.8, 0.06, '#15181e', 0, 0.85, 0, m);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.73), new THREE.MeshBasicMaterial({ map: s.tex })); sc.position.set(0, 0.85, 0.035); m.add(sc);
  });
  box(1.1, 0.03, 0.35, '#2a2e36', 0.05, 1.08, 0.25, desk); // 键盘
  box(0.12, 0.03, 0.18, '#2a2e36', 0.85, 1.08, 0.28, desk); // 鼠标
  // 台灯
  const lampG = new THREE.Group(); lampG.position.set(-1.7, 1.06, -0.2); desk.add(lampG);
  box(0.25, 0.04, 0.25, '#222', 0, 0.02, 0, lampG); const arm = box(0.04, 0.8, 0.04, '#222', 0.1, 0.4, 0, lampG); arm.rotation.z = -0.4;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 16, 1, true), mat('#222')); shade.position.set(0.3, 0.8, 0); shade.rotation.z = 2.4; lampG.add(shade);
  // 杯子、地球仪
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 16), mat('#f2f2f2')); cup.position.set(1.6, 1.13, 0.2); desk.add(cup);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), mat('#3a7bd0')); globe.position.set(-1.95, 1.3, 0.35); desk.add(globe);
  // 椅子
  const chair = new THREE.Group(); chair.position.set(-0.1, 0, -0.35); room.add(chair);
  box(0.75, 0.1, 0.75, '#2a2d34', 0, 0.62, 0, chair); box(0.75, 0.9, 0.1, '#2a2d34', 0, 1.1, 0.37, chair);
  box(0.06, 0.55, 0.06, '#555', 0, 0.32, 0, chair);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const leg = box(0.4, 0.04, 0.06, '#444', Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2, chair); leg.rotation.y = -a; }
  // Muse 机器人
  const bot = new THREE.Group(); bot.position.set(-0.1, 0.68, -0.45); room.add(bot);
  const white = mat('#eef2f7', { roughness: 0.4 }), dark = mat('#2a2f3a');
  const torso = box(0.62, 0.7, 0.42, white, 0, 0.45, 0, bot);
  const head = new THREE.Group(); head.position.set(0, 1.05, 0); bot.add(head);
  box(0.55, 0.45, 0.45, white, 0, 0, 0, head); const face = box(0.45, 0.28, 0.02, '#1a2333', 0, 0, -0.23, head);
  const eyeL = box(0.07, 0.07, 0.01, '#5ff2d0', -0.1, 0.02, -0.245, head, { emissive: '#3fe0c0', emissiveIntensity: 1 });
  const eyeR = box(0.07, 0.07, 0.01, '#5ff2d0', 0.1, 0.02, -0.245, head, { emissive: '#3fe0c0', emissiveIntensity: 1 });
  const armL = new THREE.Group(); armL.position.set(-0.38, 0.72, 0); bot.add(armL); box(0.14, 0.5, 0.14, white, 0, -0.2, -0.12, armL).rotation.x = -1.0;
  const armR = new THREE.Group(); armR.position.set(0.38, 0.72, 0); bot.add(armR); box(0.14, 0.5, 0.14, white, 0, -0.2, -0.12, armR).rotation.x = -1.0;
  box(0.22, 0.2, 0.55, dark, -0.16, 0, -0.2, bot); box(0.22, 0.2, 0.55, dark, 0.16, 0, -0.2, bot);
  box(0.18, 0.6, 0.18, dark, -0.16, -0.3, -0.45, bot); box(0.18, 0.6, 0.18, dark, 0.16, -0.3, -0.45, bot);
  bot.rotation.y = Math.PI; // 面向显示器
  // 沙发 + 茶几
  const sofa = new THREE.Group(); sofa.position.set(3.9, 0, -2.4); room.add(sofa);
  const orange = mat('#d9824a'), orange2 = mat('#c46f38');
  box(2.8, 0.45, 1.1, orange, 0, 0.35, 0, sofa); box(2.8, 0.8, 0.3, orange2, 0, 0.75, -0.45, sofa);
  box(0.3, 0.65, 1.1, orange2, -1.4, 0.55, 0, sofa); box(0.3, 0.65, 1.1, orange2, 1.4, 0.55, 0, sofa);
  box(0.5, 0.45, 0.15, '#f0c94a', -0.7, 0.8, -0.25, sofa).rotation.z = 0.15;
  const table = new THREE.Group(); table.position.set(3.7, 0, -0.6); room.add(table);
  box(1.6, 0.06, 0.8, mat('#e6d5bd', { transparent: true, opacity: 0.85 }), 0, 0.5, 0, table);
  [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]].forEach(([x, z]) => box(0.06, 0.5, 0.06, '#7a5a3a', x, 0.25, z, table));
  box(0.4, 0.04, 0.3, '#3a6fd0', -0.3, 0.55, 0, table);
  const trash = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 16), mat('#7d8696')); trash.position.set(1.9, 0.25, 0.4); room.add(trash);
  const plant = new THREE.Group(); plant.position.set(5.2, 0, -5.2); room.add(plant);
  box(0.5, 0.5, 0.5, '#c46f38', 0, 0.25, 0, plant); const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat('#3e9e5a', { flatShading: true })); leaf.position.y = 1; plant.add(leaf);

  let state = { tasks: [], current: null, working: false };
  function setState(s) {
    state = { ...state, ...s };
    const active = (state.tasks || []).filter(t => t.status !== 'done');
    monA.update({ title: 'Muse 工作中', tasks: active });
    wallScreen.update({ title: 'Muse 工作板 · 全部任务', tasks: state.tasks });
    monB.update({ current: state.current, t: performance.now() / 300 });
  }
  setState({});

  let raf, last = 0, disposed = false;
  const clock = new THREE.Clock();
  function loop(now) {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    if (state.working) { armL.rotation.x = Math.sin(t * 14) * 0.08; armR.rotation.x = Math.cos(t * 14) * 0.08; head.rotation.x = 0.1 + Math.sin(t * 2) * 0.03; }
    else { armL.rotation.x = armR.rotation.x = 0; head.rotation.y = Math.sin(t * 0.6) * 0.4; }
    bot.position.y = 0.68 + Math.sin(t * 2) * 0.01;
    eyeL.scale.y = eyeR.scale.y = (t % 4) < 0.12 ? 0.1 : 1;
    if (now - last > 400) { monB.update({ current: state.current, t: t * 3 }); last = now; }
    controls.update();
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  ro.observe(container);
  onReady?.();
  return {
    setState,
    dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); scene.traverse(o => { o.geometry?.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); }); }); }
  };
}
