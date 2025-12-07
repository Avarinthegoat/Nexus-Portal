// assets/editor.js
// Module-style editor logic for Nexus Portal editor.html
const CANVAS_W = 64, CANVAS_H = 32;

const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d', {alpha:true});
canvas.style.width = `${CANVAS_W * 8}px`;
canvas.style.height = `${CANVAS_H * 8}px`;
canvas.width = CANVAS_W; canvas.height = CANVAS_H;

const preview2d = document.getElementById('preview2d');
const p2 = preview2d.getContext('2d');

let layers = []; // {canvas, ctx, name, visible}
let active = 0;
let tool = 'pixel';
let brushSize = 1;
let color = '#7C3AED';
let symmetry = 'none';
let undoStack = [], redoStack = [];

// UI refs
const brushRange = document.getElementById('brushSize');
const zoomRange = document.getElementById('zoomRange');
const symmetrySelect = document.getElementById('symmetry');
const colorPicker = document.getElementById('colorPicker');
const quickPalette = document.getElementById('quickPalette');
const layersList = document.getElementById('layersList');
const addLayerBtn = document.getElementById('addLayer');
const mergeLayerBtn = document.getElementById('mergeLayer');
const importInput = document.getElementById('importInput');
const clearBtn = document.getElementById('clearCanvas');
const exportBtn = document.getElementById('exportPNG');
const saveRemoteBtn = document.getElementById('saveRemote');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function makeLayer(name='Layer'){
  const c = document.createElement('canvas'); c.width = CANVAS_W; c.height = CANVAS_H;
  const cx = c.getContext('2d');
  cx.clearRect(0,0,CANVAS_W,CANVAS_H);
  return {canvas:c, ctx:cx, name, visible:true};
}
function ensureLayer(){
  if (layers.length === 0) {
    layers.push(makeLayer('Base'));
    active = 0;
  }
}
ensureLayer();

function renderMain(){
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  layers.forEach(L=>{
    if (L.visible) ctx.drawImage(L.canvas,0,0);
  });
  updatePreview2d();
}
function updatePreview2d(){
  p2.clearRect(0,0,preview2d.width,preview2d.height);
  p2.imageSmoothingEnabled = false;
  p2.drawImage(canvas, 0, 0, preview2d.width, preview2d.height);
}
renderMain();

// quick palette
const baseColors = ['#000000','#ffffff','#7C3AED','#00FFE1','#FF2EC9','#FF7A00','#00A1FF','#7cffb2'];
baseColors.forEach(c => {
  const btn = document.createElement('button');
  btn.style.background = c; btn.className = 'qp';
  btn.style.width='28px'; btn.style.height='28px'; btn.style.borderRadius='6px';
  btn.style.border='1px solid rgba(0,0,0,0.4)';
  btn.addEventListener('click', ()=>{ color=c; colorPicker.value=c;});
  quickPalette.appendChild(btn);
});

// layer UI
function renderLayersUI(){
  layersList.innerHTML = '';
  layers.forEach((L,i)=>{
    const el = document.createElement('div'); el.className = 'layer-row';
    el.style.display='flex'; el.style.justifyContent='space-between'; el.style.alignItems='center';
    el.style.padding='6px'; el.style.borderRadius='6px';
    el.style.background = i===active ? 'linear-gradient(90deg, rgba(138,43,226,0.06), transparent)' : 'transparent';
    el.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
      <button class="select-layer" data-i="${i}">${i===active? '◀' : '▫'}</button>
      <span style="font-size:13px">${L.name}</span>
    </div>
    <div style="display:flex;gap:6px">
      <button class="toggle-vis" data-i="${i}">${L.visible? '👁' : '◻'}</button>
      <button class="del-layer" data-i="${i}">✖</button>
    </div>`;
    layersList.appendChild(el);
  });
  // attach handlers
  layersList.querySelectorAll('.select-layer').forEach(b => b.onclick = (e)=>{
    active = parseInt(b.dataset.i); renderLayersUI();
  });
  layersList.querySelectorAll('.toggle-vis').forEach(b => b.onclick = (e)=>{
    const i = parseInt(b.dataset.i); layers[i].visible = !layers[i].visible; renderMain(); renderLayersUI();
  });
  layersList.querySelectorAll('.del-layer').forEach(b => b.onclick = (e)=>{
    const i = parseInt(b.dataset.i);
    if (layers.length===1) return alert('Need at least one layer.');
    layers.splice(i,1);
    active = Math.max(0, active-1);
    pushHistory();
    renderMain(); renderLayersUI();
  });
}
renderLayersUI();

// history
function pushHistory(){
  const snap = layers.map(L => L.canvas.toDataURL());
  undoStack.push(snap);
  if (undoStack.length>40) undoStack.shift();
  redoStack = [];
  updateUndoUI();
}
function restoreSnapshot(arr){
  arr.forEach((d,i)=>{
    const img = new Image();
    img.onload = () => {
      layers[i].ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
      layers[i].ctx.drawImage(img,0,0);
      renderMain();
    };
    img.src = d;
  });
}
function updateUndoUI(){
  undoBtn.disabled = undoStack.length===0;
  redoBtn.disabled = redoStack.length===0;
}
undoBtn.onclick = ()=> {
  if (!undoStack.length) return;
  const prev = undoStack.pop();
  redoStack.push(layers.map(L=>L.canvas.toDataURL()));
  restoreSnapshot(prev);
  updateUndoUI();
};
redoBtn.onclick = ()=> {
  if (!redoStack.length) return;
  const next = redoStack.pop();
  undoStack.push(layers.map(L=>L.canvas.toDataURL()));
  restoreSnapshot(next);
  updateUndoUI();
};

// drawing
let drawing = false;
let lastPos = null;

function eventToCell(e){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);
  return {x,y};
}

canvas.onmousedown = (e) => { drawing=true; pushHistory(); drawAt(e); };
canvas.onmouseup = () => { drawing=false; lastPos=null; };
canvas.onmousemove = (e) => { if (drawing) drawAt(e); };
canvas.ontouchstart = (e)=>{ drawing=true; pushHistory(); drawAt(e); e.preventDefault(); };
canvas.ontouchend = ()=>{ drawing=false; lastPos=null; };
canvas.ontouchmove = (e)=>{ if (drawing) drawAt(e); e.preventDefault(); };

function drawAt(e){
  const c = eventToCell(e);
  const L = layers[active];
  if (!L) return;
  if (tool === 'pixel') {
    drawSquare(L.ctx, c.x, c.y, brushSize, color);
    applySymmetry(L.ctx);
  } else if (tool === 'eraser') {
    eraseSquare(L.ctx, c.x, c.y, brushSize);
    applySymmetry(L.ctx);
  } else if (tool === 'fill') {
    floodFill(L.ctx, c.x, c.y, hexToRgba(color));
  } else if (tool === 'eyedrop') {
    const px = ctx.getImageData(c.x,c.y,1,1).data;
    const hex = rgbaToHex(px[0],px[1],px[2]);
    color = hex; colorPicker.value = hex;
  }
  renderMain();
}

function drawSquare(cctx, x, y, size, col){
  const half = Math.floor(size/2);
  cctx.fillStyle = col;
  cctx.fillRect(x-half, y-half, size, size);
}
function eraseSquare(cctx, x, y, size){
  const half = Math.floor(size/2);
  cctx.clearRect(x-half, y-half, size, size);
}
function applySymmetry(cctx){
  if (symmetry === 'vertical') {
    const tmp = document.createElement('canvas'); tmp.width = CANVAS_W; tmp.height = CANVAS_H;
    const t = tmp.getContext('2d');
    t.translate(CANVAS_W,0); t.scale(-1,1);
    t.drawImage(layers[active].canvas, 0,0);
    cctx.drawImage(tmp,0,0);
  } else if (symmetry === 'horizontal') {
    const tmp = document.createElement('canvas'); tmp.width = CANVAS_W; tmp.height = CANVAS_H;
    const t = tmp.getContext('2d');
    t.translate(0,CANVAS_H); t.scale(1,-1);
    t.drawImage(layers[active].canvas, 0,0);
    cctx.drawImage(tmp,0,0);
  }
}

// flood fill
function floodFill(cctx, startX, startY, fillRGBA){
  const w = CANVAS_W, h = CANVAS_H;
  const img = cctx.getImageData(0,0,w,h);
  const data = img.data;
  const idx = (startY*w + startX)*4;
  const target = [data[idx],data[idx+1],data[idx+2],data[idx+3]];
  const matchTarget = (i) => data[i] === target[0] && data[i+1] === target[1] && data[i+2] === target[2] && data[i+3] === target[3];
  // if target already fill color, stop
  if (target[0]===fillRGBA.r && target[1]===fillRGBA.g && target[2]===fillRGBA.b) return;
  const stack = [[startX,startY]];
  while(stack.length){
    const [x,y] = stack.pop();
    if (x<0||y<0||x>=w||y>=h) continue;
    const i = (y*w + x)*4;
    if (!matchTarget(i)) continue;
    data[i]=fillRGBA.r; data[i+1]=fillRGBA.g; data[i+2]=fillRGBA.b; data[i+3]=255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  cctx.putImageData(img,0,0);
}

function hexToRgba(hex){
  hex = hex.replace('#','');
  const n = parseInt(hex,16);
  return { r: (n>>16)&255, g:(n>>8)&255, b:n&255, a:255 };
}
function rgbaToHex(r,g,b){
  const h = (n)=> n.toString(16).padStart(2,'0');
  return '#' + h(r) + h(g) + h(b);
}

// UI bindings
document.querySelectorAll('.tool-btn').forEach(b=>{
  b.onclick = ()=>{
    document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    tool = b.dataset.tool;
  };
});
brushRange.oninput = (e)=> brushSize = parseInt(e.target.value);
zoomRange.oninput = (e)=> {
  const scale = parseInt(e.target.value);
  canvas.style.width = (CANVAS_W * scale) + 'px';
  canvas.style.height = (CANVAS_H * scale) + 'px';
};
symmetrySelect.onchange = (e)=> symmetry = e.target.value;
colorPicker.oninput = (e)=> color = e.target.value;

addLayerBtn.onclick = ()=> {
  layers.push(makeLayer('Layer '+(layers.length+1)));
  active = layers.length-1;
  pushHistory(); renderLayersUI(); renderMain();
};
mergeLayerBtn.onclick = ()=> {
  if (layers.length<2) return;
  const top = layers.pop();
  layers[layers.length-1].ctx.drawImage(top.canvas,0,0);
  active = layers.length-1;
  pushHistory(); renderLayersUI(); renderMain();
};
clearBtn.onclick = ()=> {
  layers.forEach(L=> L.ctx.clearRect(0,0,CANVAS_W,CANVAS_H));
  pushHistory(); renderMain();
};

importInput.onchange = (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; img.onload = ()=> {
    layers[active].ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
    layers[active].ctx.drawImage(img,0,0,CANVAS_W,CANVAS_H);
    pushHistory(); renderMain();
  }};
  reader.readAsDataURL(f);
};

exportBtn.onclick = ()=>{
  const out = document.createElement('canvas'); out.width = CANVAS_W; out.height = CANVAS_H;
  const octx = out.getContext('2d');
  layers.forEach(L=>{ if (L.visible) octx.drawImage(L.canvas,0,0); });
  const url = out.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = 'nexus_cape.png'; a.click();
};

// basic remote save (placeholder: stores dataURL into localStorage; replace with Firebase Storage + Firestore)
saveRemoteBtn.onclick = ()=>{
  const out = document.createElement('canvas'); out.width = CANVAS_W; out.height = CANVAS_H;
  const octx = out.getContext('2d');
  layers.forEach(L=>{ if (L.visible) octx.drawImage(L.canvas,0,0); });
  const dataUrl = out.toDataURL('image/png');
  // store in localStorage as demo
  const id = 'cape_' + Date.now();
  localStorage.setItem(id, dataUrl);
  alert('Saved locally as ' + id + ' (replace this with Firebase Storage upload code)');
};

// initial history
pushHistory(); renderLayersUI(); renderMain();

// ---------- THREE.JS 3D PREVIEW ----------
const threeContainer = document.getElementById('threeContainer');
let scene, camera, renderer, controls, mesh, texture;

function initThree(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 3.5);

  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  threeContainer.innerHTML = '';
  threeContainer.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 6;

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(1,2,3);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff,0.4));

  // simple cape mesh: a plane geometry slightly folded (simple cloth approximation)
  const geometry = new THREE.PlaneGeometry(2.0, 2.0, 20, 20);
  // add a slight bend to simulate cape
  for (let i=0;i<geometry.attributes.position.count;i++){
    const y = geometry.attributes.position.getY(i);
    const x = geometry.attributes.position.getX(i);
    // bend along x axis: create curved effect
    geometry.attributes.position.setZ(i, Math.sin((x+1.0)*Math.PI*0.5) * 0.12 * (1 - Math.abs(y)/1.0));
  }
  geometry.computeVertexNormals();

  texture = new THREE.Texture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({map: texture, side: THREE.DoubleSide, metalness:0.0, roughness:0.6});
  mesh = new THREE.Mesh(geometry, mat);
  mesh.rotation.x = -0.12;
  mesh.rotation.y = Math.PI;
  scene.add(mesh);

  animateThree();
  window.addEventListener('resize', onResize);
}

function onResize(){
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
  camera.updateProjectionMatrix();
}

function animateThree(){
  requestAnimationFrame(animateThree);
  texture.needsUpdate = true;
  controls.update();
  renderer.render(scene, camera);
}

initThree();

// keep preview updated at an interval to avoid heavy loops
setInterval(()=>{
  renderMain();
  texture.needsUpdate = true;
}, 200);
