// PolyGlobe 3D：three.js 自绘地球（国界线、国名、发光信号点、ISS、EONET、FIRMS 点云）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';

const R = 1;
export function ll(lat, lng, r = R) {
  const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
const COUNTRIES = [['中国', 35, 104], ['印度', 22, 79], ['俄罗斯', 61, 96], ['美国', 39, -98], ['加拿大', 58, -106], ['巴西', -10, -52], ['澳大利亚', -25, 134], ['日本', 36, 138], ['韩国', 36.5, 128], ['朝鲜', 40, 127], ['蒙古', 46.8, 103], ['哈萨克斯坦', 48, 67], ['伊朗', 32, 53], ['土耳其', 39, 35], ['沙特', 24, 45], ['埃及', 26.8, 30], ['乌克兰', 49, 32], ['德国', 51, 10], ['法国', 46, 2], ['英国', 54, -2], ['西班牙', 40, -4], ['意大利', 42.8, 12.5], ['波兰', 52, 19], ['以色列', 31, 35], ['阿富汗', 33.9, 67.7], ['巴基斯坦', 30, 69], ['缅甸', 21, 96], ['泰国', 15, 101], ['越南', 16, 107], ['印尼', -2, 118], ['马来西亚', 4, 102], ['菲律宾', 12, 122], ['苏丹', 15, 30], ['尼日利亚', 9, 8], ['南非', -29, 24], ['刚果(金)', -3, 23], ['埃塞俄比亚', 9, 40], ['墨西哥', 23, -102], ['阿根廷', -34, -64], ['委内瑞拉', 7, -66], ['中国台湾', 23.7, 121], ['伊拉克', 33, 44], ['叙利亚', 35, 38], ['也门', 15.5, 48], ['利比亚', 27, 17], ['阿尔及利亚', 28, 2], ['马里', 17, -4], ['尼日尔', 17, 8], ['乍得', 15, 19], ['秘鲁', -9, -75], ['哥伦比亚', 4, -72]];

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createGlobe(container, { onPick } = {}) {
  const W = () => container.clientWidth, H = () => container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W(), H());
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.setSize(W(), H());
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  container.appendChild(labels.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.01, 100);
  camera.position.copy(ll(25, 75, 3.1));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 1.35; controls.maxDistance = 6; controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.rotateSpeed = 0.5;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; clearTimeout(resumeT); });
  let resumeT; renderer.domElement.addEventListener('pointerup', () => { resumeT = setTimeout(() => (controls.autoRotate = true), 6000); });

  scene.add(new THREE.AmbientLight('#7d9ad0', 1.1));
  const dl = new THREE.DirectionalLight('#ffffff', 1.2); dl.position.set(3, 2, 4); scene.add(dl);
  const earth = new THREE.Group(); scene.add(earth);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshPhongMaterial({ color: '#0f2244', emissive: '#0a1530', shininess: 12 })));
  // 大气光晕
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float i = pow(0.75 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.25,0.55,1.0,1.0)*i; }'
  }));
  scene.add(atm);
  // 经纬网
  const grat = []; for (let lat = -60; lat <= 60; lat += 30) for (let lng = -180; lng < 180; lng += 4) grat.push(ll(lat, lng, R * 1.001), ll(lat, lng + 4, R * 1.001));
  for (let lng = -180; lng < 180; lng += 30) for (let lat = -88; lat < 88; lat += 4) grat.push(ll(lat, lng, R * 1.001), ll(lat + 4, lng, R * 1.001));
  earth.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grat), new THREE.LineBasicMaterial({ color: '#1f3a6a', transparent: true, opacity: 0.45 })));
  // 国界
  const borders = new THREE.Group(); earth.add(borders);
  fetch('/data/borders.json').then(r => r.json()).then(lines => {
    const pts = [];
    lines.forEach(l => { for (let i = 1; i < l.length; i++) { if (Math.abs(l[i][0] - l[i - 1][0]) > 90) continue; pts.push(ll(l[i - 1][1], l[i - 1][0], R * 1.002), ll(l[i][1], l[i][0], R * 1.002)); } });
    borders.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8fb4e8', transparent: true, opacity: 0.55 })));
  }).catch(() => {});
  // 国名
  const names = new THREE.Group(); earth.add(names);
  COUNTRIES.forEach(([n, la, lo]) => {
    const d = document.createElement('div'); d.textContent = n; d.style.cssText = 'font-size:10px;color:#cfe0ff;opacity:.85;text-shadow:0 0 3px #000;pointer-events:none';
    const o = new CSS2DObject(d); o.position.copy(ll(la, lo, R * 1.01)); o.userData.dom = d; names.add(o);
  });

  const glow = glowTexture();
  const layerGroups = {};
  const pickables = [];
  function group(id) { if (!layerGroups[id]) { layerGroups[id] = new THREE.Group(); earth.add(layerGroups[id]); } return layerGroups[id]; }
  function addGlow(id, p, color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.copy(ll(p.lat, p.lng, R * 1.01)); s.scale.setScalar(size); s.userData = { ...p, layer: id, base: size, phase: Math.random() * 6 };
    group(id).add(s); pickables.push(s); return s;
  }
  function setPoints(defs, points) {
    const color = Object.fromEntries(defs.map(d => [d.id, d.color]));
    points.forEach(p => {
      const big = p.layer === 'heat';
      addGlow(p.layer, p, color[p.layer], big ? 0.16 * p.w : 0.06 * p.w);
      if (big) addGlow(p.layer, p, '#ff2040', 0.05);
    });
  }
  function setEonet(list, color = '#ff9a2e') {
    const g = group('eonet'); g.clear(); for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.layer === 'eonet') pickables.splice(i, 1);
    list.forEach(e => addGlow('eonet', { ...e, note: 'NASA EONET 实时野火' }, color, 0.045));
  }
  function setFirms(points) {
    const g = group('firms'); g.clear();
    if (!points?.length) return;
    const pos = new Float32Array(points.length * 3);
    points.forEach((p, i) => { const v = ll(p.lat, p.lng, R * 1.004); pos.set([v.x, v.y, v.z], i * 3); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ff4d2e', size: 0.012, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  }
  // ISS
  const iss = new THREE.Group(); earth.add(iss);
  const issDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e8f4ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); issDot.scale.setScalar(0.09); iss.add(issDot);
  const issCore = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.012), new THREE.MeshBasicMaterial({ color: '#ffffff' })); iss.add(issCore);
  const trail = []; const trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.7 })); earth.add(trailLine);
  issDot.userData = { layer: 'iss', name: '国际空间站 ISS' }; pickables.push(issDot);
  function setIss(d) {
    const alt = R * (1 + d.altitude / 6371);
    const v = ll(d.lat, d.lng, alt); iss.position.copy(v); issCore.lookAt(0, 0, 0);
    issDot.userData = { layer: 'iss', name: '国际空间站 ISS', lat: d.lat, lng: d.lng, note: `高度 ${d.altitude.toFixed(0)} km · 速度 ${Math.round(d.velocity).toLocaleString()} km/h` };
    trail.push(v.clone()); if (trail.length > 200) trail.shift();
    trailLine.geometry.dispose(); trailLine.geometry = new THREE.BufferGeometry().setFromPoints(trail);
  }
  function locateIss() { controls.autoRotate = false; const target = iss.position.clone().normalize().multiplyScalar(camera.position.length()); flyTo = target; }
  let flyTo = null;

  function setVisible(id, on) {
    if (id === 'borders') { borders.visible = on; return; }
    if (id === 'names') { names.visible = on; names.children.forEach(o => (o.userData.dom.style.display = on ? '' : 'none')); return; }
    group(id).visible = on;
  }

  // 点选
  const ray = new THREE.Raycaster(); ray.params.Sprite = {}; const ptr = new THREE.Vector2(); let down;
  renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const vis = pickables.filter(s => s.parent?.visible !== false && s.parent?.parent?.visible !== false);
    const hits = ray.intersectObjects(vis, false);
    const camDir = camera.position.clone().normalize();
    const front = hits.find(h => h.object.getWorldPosition(new THREE.Vector3()).normalize().dot(camDir) > 0.1);
    if (front) { flyTo = front.object.getWorldPosition(new THREE.Vector3()).normalize().multiplyScalar(camera.position.length()); controls.autoRotate = false; onPick?.(front.object.userData); }
  });

  let raf, disposed = false; const clock = new THREE.Clock(); const tmp = new THREE.Vector3();
  function loop() {
    if (disposed) return; raf = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    for (const s of pickables) if (s.userData.base) s.scale.setScalar(s.userData.base * (1 + 0.18 * Math.sin(t * 2 + s.userData.phase)));
    issDot.scale.setScalar(0.08 + 0.02 * Math.sin(t * 4));
    if (flyTo) { camera.position.lerp(flyTo, 0.06); camera.position.setLength(flyTo.length()); if (camera.position.distanceTo(flyTo) < 0.01) flyTo = null; }
    // 背面的国名隐藏
    const cd = camera.position.clone().normalize();
    if (names.visible) names.children.forEach(o => { o.getWorldPosition(tmp); o.userData.dom.style.visibility = tmp.normalize().dot(cd) > 0.25 ? 'visible' : 'hidden'; });
    controls.update(); renderer.render(scene, camera); labels.render(scene, camera);
  }
  loop();
  const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); labels.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
  ro.observe(container);
  return { setPoints, setEonet, setFirms, setIss, locateIss, setVisible, dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); labels.domElement.remove(); } };
}
