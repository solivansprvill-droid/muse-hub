// Agent 指挥中心 3D：9 个工位、低多边形小人、头顶状态气泡、点击选中
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';

export const STATE_TEXT = { work: '认真工作', slack: '摸鱼中', think: '思考中', happy: '开心', angry: '生气', drink: '喝水', toilet: '上厕所', idle: '待机', walk: '走动中', chat: '聊天中' };
const AWAY = new Set(['drink', 'toilet', 'walk', 'chat']);
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
function box(w, h, d, m, x, y, z, p) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m instanceof THREE.Material ? m : mat(m)); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; }
function codeTex() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 80; const c = cv.getContext('2d');
  c.fillStyle = '#0c2a18'; c.fillRect(0, 0, 128, 80);
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 3 ? '#3ee07a' : '#b8ffcf'; c.fillRect(8 + (i % 2) * 8, 6 + i * 9, 30 + Math.random() * 70, 4); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const DESKS = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) DESKS.push(new THREE.Vector3((c - 1) * 4.2, 0, (r - 1) * 4.2));
const SPOTS = { drink: new THREE.Vector3(7, 0, -6.3), toilet: new THREE.Vector3(-7.4, 0, -6.6) };

export function createAgentFloor(container, { onSelect } = {}) {
  const W = () => container.clientWidth, H = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W(), H());
  renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.setSize(W(), H());
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f1ede3');
  const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.1; controls.minDistance = 3; controls.maxDistance = 40;
  controls.autoRotateSpeed = 0.6;
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc6b0', 1.2));
  const sun = new THREE.DirectionalLight('#fff7e8', 1.5); sun.position.set(8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), mat('#efe6d2')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  box(18, 3.2, 0.2, '#e4e7e3', 0, 1.6, -8, scene); box(0.2, 3.2, 16, '#e9ece8', -9, 1.6, 0, scene);
  for (let i = 0; i < 6; i++) box(2, 1.6, 0.05, '#cfe0ea', -6.5 + i * 2.6, 1.9, -7.88, scene);
  // 墙上的牌子
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 128; const sc = sign.getContext('2d');
  sc.fillStyle = '#2e8b4f'; sc.font = 'italic bold 64px Georgia'; sc.fillText("Muse's", 10, 70); sc.font = '28px sans-serif'; sc.fillStyle = '#6a7d6f'; sc.fillText('AGENT OFFICE', 14, 112);
  const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: st, transparent: true })); signM.position.set(5.5, 2.6, -7.88); scene.add(signM);
  // 饮水机、厕所门、绿植
  box(0.6, 1.2, 0.6, '#ffffff', 7.4, 0.6, -7.2, scene); const water = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 16), mat('#7cc4ff', { transparent: true, opacity: 0.7 })); water.position.set(7.4, 1.5, -7.2); scene.add(water);
  box(1.4, 2.4, 0.1, '#b9a07a', -7.4, 1.2, -7.88, scene); box(0.1, 0.1, 0.1, '#444', -6.9, 1.2, -7.8, scene);
  const plant = (x, z) => { box(0.5, 0.5, 0.5, '#c46f38', x, 0.25, z, scene); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat('#4caf68', { flatShading: true })); l.position.set(x, 1.1, z); l.castShadow = true; scene.add(l); };
  plant(-8.2, 7); plant(8.2, 7); plant(8.2, -2); plant(-8.2, -2);

  // 工位
  const chairs = [];
  DESKS.forEach((p, i) => {
    const g = new THREE.Group(); g.position.copy(p); scene.add(g);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.75, 40), mat('#b9dcb8')); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = true; g.add(rug);
    box(2, 0.08, 1, '#fafafa', 0, 0.9, -0.5, g); box(0.08, 0.9, 0.9, '#e2e2e2', -0.95, 0.45, -0.5, g); box(0.08, 0.9, 0.9, '#e2e2e2', 0.95, 0.45, -0.5, g);
    [-0.42, 0.42].forEach(x => {
      box(0.06, 0.3, 0.06, '#333', x, 1.08, -0.8, g);
      box(0.8, 0.5, 0.05, '#222', x, 1.42, -0.8, g);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.44), new THREE.MeshBasicMaterial({ map: codeTex() })); s.position.set(x, 1.42, -0.77); g.add(s);
    });
    box(0.7, 0.03, 0.22, '#444', 0, 0.95, -0.25, g);
    box(0.12, 0.14, 0.12, ['#e57373', '#9575cd', '#4fc3f7'][i % 3], 0.75, 1.0, -0.3, g);
    const chair = new THREE.Group(); chair.position.set(0, 0, 0.45); g.add(chair);
    box(0.6, 0.08, 0.6, '#5d8f6a', 0, 0.55, 0, chair); box(0.6, 0.7, 0.08, '#5d8f6a', 0, 0.95, 0.3, chair); box(0.06, 0.5, 0.06, '#555', 0, 0.28, 0, chair);
    chairs.push(chair);
  });

  // 小人
  const people = new Map();
  function makePerson(a) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.6, 10), mat(a.color || '#8e7cc3')); body.position.y = 0.95; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), mat('#f2c9a0')); head.position.y = 1.45; head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.255, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(['#4a2e1e', '#2b2b2b', '#a0522d', '#7a1f2b'][a.desk % 4])); hair.position.y = 1.47; hair.rotation.x = -0.25; g.add(hair);
    const legs = []; [-0.12, 0.12].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), mat('#3c4a6b')); l.position.set(x, 0.38, 0); l.castShadow = true; g.add(l); legs.push(l); });
    const arms = []; [-0.33, 0.33].forEach(x => { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.45, 0.11), mat(a.color || '#8e7cc3')); ar.position.set(x, 1.0, 0); g.add(ar); arms.push(ar); });
    const props = { phone: box(0.08, 0.14, 0.02, '#111', 0.15, 1.2, -0.3, g), cup: new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), mat('#fff')) };
    props.cup.position.set(0.33, 1.05, -0.12); g.add(props.cup);
    // 标签 & 气泡
    const lab = document.createElement('div'); lab.className = 'label3d';
    lab.innerHTML = `<span class="dot" style="background:#2e8b4f"></span>${a.id} ${a.name} · ${a.nick}`;
    lab.addEventListener('pointerdown', e => { e.stopPropagation(); onSelect?.(a.id); });
    const labObj = new CSS2DObject(lab); labObj.position.set(0, 2.15, 0); g.add(labObj);
    const bub = document.createElement('div'); bub.className = 'bubble3d';
    const bubObj = new CSS2DObject(bub); bubObj.position.set(0.45, 1.85, 0); g.add(bubObj);
    g.userData = { id: a.id };
    g.traverse(o => { if (o.isMesh) o.userData.agentId = a.id; });
    scene.add(g);
    const desk = DESKS[a.desk % 9];
    const p = { a, g, body, head, legs, arms, props, lab, bub, dot: lab.querySelector('.dot'), seat: desk.clone().add(new THREE.Vector3(0, 0, 0.45)), pos: desk.clone().add(new THREE.Vector3(0, 0, 0.45)), target: null, show: 'work', nextAuto: 0, away: false };
    g.position.copy(p.pos);
    return p;
  }

  function desiredState(p, now) {
    const a = p.a;
    if (a.mode === 'manual') return a.status;
    const hasWork = a.tasks?.some(t => t.state === 'doing');
    if (now > p.nextAuto) {
      p.nextAuto = now + 8000 + Math.random() * 14000;
      const pool = hasWork ? ['work', 'work', 'work', 'work', 'think', 'think', 'slack', 'drink', 'toilet', 'walk', 'chat', 'happy'] : ['idle', 'idle', 'slack', 'walk', 'drink', 'chat'];
      p.auto = pool[Math.floor(Math.random() * pool.length)];
    }
    return p.auto || (hasWork ? 'work' : 'idle');
  }

  function setAgents(list) {
    const ids = new Set(list.map(a => a.id));
    for (const [id, p] of people) if (!ids.has(id)) { scene.remove(p.g); people.delete(id); }
    list.forEach(a => {
      let p = people.get(a.id);
      if (!p) { p = makePerson(a); people.set(a.id, p); }
      if (p.a.mode !== a.mode || p.a.status !== a.status) p.nextAuto = 0;
      p.a = a;
      p.lab.innerHTML = `<span class="dot" style="background:${a.tasks?.some(t => t.state === 'doing') ? '#2e8b4f' : '#aab3ab'}"></span>${a.id} ${a.name} · ${a.nick}`;
    });
  }

  const tmp = new THREE.Vector3();
  function walkTo(p, target, dt, t) {
    tmp.copy(target).sub(p.pos); tmp.y = 0;
    const d = tmp.length();
    if (d < 0.05) { p.legs.forEach(l => (l.rotation.x = 0)); return true; }
    tmp.normalize();
    p.pos.addScaledVector(tmp, Math.min(d, dt * 1.6));
    p.g.rotation.y = Math.atan2(tmp.x, tmp.z);
    p.legs[0].rotation.x = Math.sin(t * 10) * 0.6; p.legs[1].rotation.x = -Math.sin(t * 10) * 0.6;
    p.arms[0].rotation.x = -Math.sin(t * 10) * 0.5; p.arms[1].rotation.x = Math.sin(t * 10) * 0.5;
    return false;
  }

  const clock = new THREE.Clock();
  let raf, disposed = false, mode = 'overview', tour = 0, focusId = null;
  const camGoal = { pos: new THREE.Vector3(12, 12, 14), look: new THREE.Vector3(0, 0, 0), active: true };
  function setView(v, id) {
    mode = v; focusId = id || null;
    if (v === 'overview') { camGoal.pos.set(12, 12, 14); camGoal.look.set(0, 0.5, 0); camGoal.active = true; }
    if (v === 'boss') { camGoal.pos.set(0, 3.2, 10.5); camGoal.look.set(0, 0.8, -1); camGoal.active = true; }
    if (v === 'patrol') { tour = 0; camGoal.active = false; }
    if (v === 'focus' && id) camGoal.active = true;
  }
  setView('overview');
  camera.position.copy(camGoal.pos);
  controls.target.copy(camGoal.look);
  renderer.domElement.addEventListener('pointerdown', () => { if (mode !== 'patrol') camGoal.active = false; });

  // 点击小人
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(scene.children, true).find(h => h.object.userData.agentId);
    if (hit) onSelect?.(hit.object.userData.agentId);
  });

  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, now = performance.now();
    for (const p of people.values()) {
      const s = desiredState(p, now);
      p.show = s;
      let atSeat = false;
      if (s === 'drink' || s === 'toilet') { const arrived = walkTo(p, SPOTS[s], dt, t); p.g.visible = !(s === 'toilet' && arrived); }
      else if (s === 'walk') { if (!p.target || walkTo(p, p.target, dt, t)) p.target = new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 12); }
      else if (s === 'chat') { const others = [...people.values()].filter(o => o !== p); const o = others[p.a.desk % others.length]; if (o) { const tgt = o.pos.clone().add(new THREE.Vector3(0.9, 0, 0.6)); if (walkTo(p, tgt, dt, t)) { p.g.lookAt(o.pos.x, 0, o.pos.z); p.arms[1].rotation.x = -0.8 + Math.sin(t * 6) * 0.3; } } }
      else { p.g.visible = true; atSeat = walkTo(p, p.seat, dt, t); }
      if (!['toilet'].includes(s)) p.g.visible = true;
      p.g.position.copy(p.pos);
      p.props.phone.visible = s === 'slack' && atSeat; p.props.cup.visible = s === 'drink';
      p.body.material.emissive?.set(s === 'angry' ? '#661111' : '#000000');
      if (atSeat) {
        p.g.rotation.y = Math.PI; // 面向显示器
        const sit = ['work', 'think', 'slack', 'angry'].includes(s);
        p.g.position.y = s === 'happy' ? Math.abs(Math.sin(t * 6)) * 0.35 : sit ? -0.18 : 0;
        p.legs.forEach(l => (l.rotation.x = sit ? -1.4 : 0));
        if (s === 'work') { p.arms[0].rotation.x = -1.2 + Math.sin(t * 16) * 0.12; p.arms[1].rotation.x = -1.2 + Math.cos(t * 16) * 0.12; p.head.rotation.set(0.15, 0, 0); }
        else if (s === 'think') { p.arms[1].rotation.x = -2.2; p.arms[0].rotation.x = 0; p.head.rotation.set(0, 0, Math.sin(t) * 0.2); }
        else if (s === 'slack') { p.arms[0].rotation.x = 0; p.arms[1].rotation.x = -1.6; p.head.rotation.set(0.4, 0, 0); p.g.position.y -= 0.05; }
        else if (s === 'angry') { p.g.position.x += Math.sin(t * 40) * 0.03; p.arms.forEach(a => (a.rotation.x = -2.6)); }
        else if (s === 'happy') { p.arms.forEach(a => (a.rotation.x = -3)); p.head.rotation.set(0, 0, 0); }
        else { p.arms.forEach(a => (a.rotation.x = 0)); p.head.rotation.set(0, Math.sin(t * 0.7) * 0.5, 0); }
      }
      p.bub.textContent = STATE_TEXT[s] || s;
      p.bub.style.color = s === 'slack' ? '#d9822b' : s === 'angry' ? '#d23a4c' : s === 'work' ? '#2e8b4f' : '#4b6bd6';
      p.bub.parentElement && (p.bub.style.display = p.g.visible ? '' : 'none');
      p.lab.style.display = p.g.visible ? '' : 'none';
    }
    // 镜头
    if (mode === 'patrol') {
      tour += dt * 0.12;
      const k = tour % 1, idx = Math.floor((tour % 1) * 9), d = DESKS[idx];
      camera.position.lerp(new THREE.Vector3(d.x + 2.6, 2.6, d.z + 3.2), 0.03);
      controls.target.lerp(new THREE.Vector3(d.x, 1, d.z - 0.3), 0.05);
      void k;
    } else if (mode === 'focus' && focusId && people.get(focusId)) {
      const p = people.get(focusId);
      if (camGoal.active) { camera.position.lerp(new THREE.Vector3(p.pos.x + 1.6, 2.6, p.pos.z + 2.4), 0.05); controls.target.lerp(new THREE.Vector3(p.pos.x, 1.1, p.pos.z), 0.08); }
    } else if (camGoal.active) {
      camera.position.lerp(camGoal.pos, 0.05); controls.target.lerp(camGoal.look, 0.08);
      if (camera.position.distanceTo(camGoal.pos) < 0.05) camGoal.active = false;
    }
    controls.update();
    renderer.render(scene, camera); labels.render(scene, camera);
  }
  loop();
  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); labels.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  ro.observe(container);

  return {
    setAgents, setView,
    setAutoRotate(on) { controls.autoRotate = on; },
    displayStates() { const o = {}; for (const [id, p] of people) o[id] = p.show; return o; },
    findSlacker() { for (const [id, p] of people) if (p.show === 'slack') return id; return null; },
    isAway: s => AWAY.has(s),
    dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); labels.domElement.remove(); }
  };
}
