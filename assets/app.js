const ns = 'http://www.w3.org/2000/svg';

const state = {
  tool: 'select',
  selectedId: null,
  drawing: null,
  drag: null,
  layers: [],
  keyframes: new Map(),
  playTimer: null,
};

const canvas = document.getElementById('canvas');
const layersEl = document.getElementById('layers');
const strokeEl = document.getElementById('stroke');
const fillEl = document.getElementById('fill');
const strokeWidthEl = document.getElementById('stroke-width');
const timelineList = document.getElementById('timeline-list');

const kfInputs = {
  time: document.getElementById('kf-time'),
  x: document.getElementById('kf-x'),
  y: document.getElementById('kf-y'),
  scale: document.getElementById('kf-scale'),
  rotate: document.getElementById('kf-rotate'),
  opacity: document.getElementById('kf-opacity'),
};

function uid() {
  return `shape-${crypto.randomUUID().slice(0, 8)}`;
}

function getPoint(evt) {
  const pt = canvas.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function baseStyle(el) {
  el.setAttribute('stroke', strokeEl.value);
  el.setAttribute('fill', fillEl.value);
  el.setAttribute('stroke-width', strokeWidthEl.value);
}

function setSelected(id) {
  state.selectedId = id;
  for (const shape of canvas.querySelectorAll('[data-shape="true"]')) {
    shape.classList.toggle('selected-shape', shape.dataset.id === id);
  }
  for (const li of layersEl.querySelectorAll('li')) {
    li.classList.toggle('active', li.dataset.id === id);
  }
  renderTimeline();
}

function addShape(el, name) {
  const id = uid();
  el.dataset.id = id;
  el.dataset.shape = 'true';
  el.dataset.tx = '0';
  el.dataset.ty = '0';
  el.dataset.scale = '1';
  el.dataset.rotate = '0';
  el.dataset.opacity = '1';
  canvas.append(el);
  state.layers.push({ id, name });
  renderLayers();
  setSelected(id);
}

function getSelected() {
  return state.selectedId ? canvas.querySelector(`[data-id="${state.selectedId}"]`) : null;
}

function transformOf(el) {
  return {
    x: Number(el.dataset.tx || 0),
    y: Number(el.dataset.ty || 0),
    scale: Number(el.dataset.scale || 1),
    rotate: Number(el.dataset.rotate || 0),
    opacity: Number(el.dataset.opacity || 1),
  };
}

function applyTransform(el, t) {
  el.dataset.tx = String(t.x);
  el.dataset.ty = String(t.y);
  el.dataset.scale = String(t.scale);
  el.dataset.rotate = String(t.rotate);
  el.dataset.opacity = String(t.opacity);
  el.setAttribute('transform', `translate(${t.x} ${t.y}) rotate(${t.rotate}) scale(${t.scale})`);
  el.setAttribute('opacity', t.opacity);
}

function renderLayers() {
  layersEl.innerHTML = '';
  [...state.layers].reverse().forEach((layer) => {
    const li = document.createElement('li');
    li.dataset.id = layer.id;
    li.textContent = layer.name;
    li.onclick = () => setSelected(layer.id);
    layersEl.append(li);
  });
  setSelected(state.selectedId);
}

function renderTimeline() {
  timelineList.innerHTML = '';
  const id = state.selectedId;
  if (!id) {
    timelineList.innerHTML = '<p class="muted">Select a shape to animate.</p>';
    return;
  }
  const frames = [...(state.keyframes.get(id) || [])].sort((a, b) => a.time - b.time);
  if (!frames.length) {
    timelineList.innerHTML = '<p class="muted">No keyframes yet.</p>';
    return;
  }

  frames.forEach((kf, idx) => {
    const row = document.createElement('div');
    row.className = 'kf-item';
    row.textContent = `${idx + 1}. t=${kf.time}s | x:${kf.x} y:${kf.y} scale:${kf.scale} rot:${kf.rotate} op:${kf.opacity}`;
    timelineList.append(row);
  });
}

function interpolate(a, b, t) {
  return a + (b - a) * t;
}

function getFrameAt(frames, time) {
  if (time <= frames[0].time) return frames[0];
  if (time >= frames.at(-1).time) return frames.at(-1);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (time >= a.time && time <= b.time) {
      const w = (time - a.time) / (b.time - a.time || 1);
      return {
        time,
        x: interpolate(a.x, b.x, w),
        y: interpolate(a.y, b.y, w),
        scale: interpolate(a.scale, b.scale, w),
        rotate: interpolate(a.rotate, b.rotate, w),
        opacity: interpolate(a.opacity, b.opacity, w),
      };
    }
  }
  return frames[0];
}

function playSelected() {
  stopPlayback();
  const el = getSelected();
  if (!el) return;
  const frames = [...(state.keyframes.get(el.dataset.id) || [])].sort((a, b) => a.time - b.time);
  if (frames.length < 2) return;

  const duration = frames.at(-1).time;
  const start = performance.now();

  const tick = (now) => {
    const elapsed = ((now - start) / 1000) % duration;
    const f = getFrameAt(frames, elapsed);
    applyTransform(el, f);
    state.playTimer = requestAnimationFrame(tick);
  };

  state.playTimer = requestAnimationFrame(tick);
}

function stopPlayback() {
  if (state.playTimer) {
    cancelAnimationFrame(state.playTimer);
    state.playTimer = null;
  }
}

function extrudeSelected() {
  const el = getSelected();
  if (!el) return;
  const clone = el.cloneNode(true);
  clone.classList.add('extrude-back');
  clone.removeAttribute('id');
  clone.dataset.shape = 'false';
  clone.removeAttribute('data-id');
  const t = transformOf(el);
  const darker = '#27272a';
  clone.setAttribute('fill', darker);
  clone.setAttribute('stroke', darker);
  clone.setAttribute('transform', `translate(${t.x + 8} ${t.y + 8}) rotate(${t.rotate}) scale(${t.scale})`);
  canvas.insertBefore(clone, el);
}

function exportSVG() {
  const out = canvas.cloneNode(true);

  for (const el of out.querySelectorAll('[data-shape="true"]')) {
    el.classList.remove('selected-shape');
    const id = el.dataset.id;
    const frames = [...(state.keyframes.get(id) || [])].sort((a, b) => a.time - b.time);
    if (frames.length > 1) {
      const dur = frames.at(-1).time;
      const valuesT = frames.map((f) => `${f.x} ${f.y}`).join(';');
      const valuesR = frames.map((f) => f.rotate).join(';');
      const valuesS = frames.map((f) => f.scale).join(';');
      const valuesO = frames.map((f) => f.opacity).join(';');
      const times = frames.map((f) => (f.time / dur).toFixed(4)).join(';');

      const animT = document.createElementNS(ns, 'animateTransform');
      animT.setAttribute('attributeName', 'transform');
      animT.setAttribute('type', 'translate');
      animT.setAttribute('dur', `${dur}s`);
      animT.setAttribute('repeatCount', 'indefinite');
      animT.setAttribute('calcMode', 'linear');
      animT.setAttribute('keyTimes', times);
      animT.setAttribute('values', valuesT);

      const animR = document.createElementNS(ns, 'animateTransform');
      animR.setAttribute('attributeName', 'transform');
      animR.setAttribute('type', 'rotate');
      animR.setAttribute('dur', `${dur}s`);
      animR.setAttribute('additive', 'sum');
      animR.setAttribute('repeatCount', 'indefinite');
      animR.setAttribute('calcMode', 'linear');
      animR.setAttribute('keyTimes', times);
      animR.setAttribute('values', valuesR);

      const animS = document.createElementNS(ns, 'animateTransform');
      animS.setAttribute('attributeName', 'transform');
      animS.setAttribute('type', 'scale');
      animS.setAttribute('dur', `${dur}s`);
      animS.setAttribute('additive', 'sum');
      animS.setAttribute('repeatCount', 'indefinite');
      animS.setAttribute('calcMode', 'linear');
      animS.setAttribute('keyTimes', times);
      animS.setAttribute('values', valuesS);

      const animO = document.createElementNS(ns, 'animate');
      animO.setAttribute('attributeName', 'opacity');
      animO.setAttribute('dur', `${dur}s`);
      animO.setAttribute('repeatCount', 'indefinite');
      animO.setAttribute('calcMode', 'linear');
      animO.setAttribute('keyTimes', times);
      animO.setAttribute('values', valuesO);

      el.append(animT, animR, animS, animO);
    }

    for (const key of Object.keys(el.dataset)) {
      if (key.startsWith('shape') || key === 'id' || ['tx', 'ty', 'scale', 'rotate', 'opacity'].includes(key)) {
        delete el.dataset[key];
      }
    }
  }

  for (const helper of out.querySelectorAll('[data-shape="false"]')) {
    helper.removeAttribute('data-shape');
  }

  const content = new XMLSerializer().serializeToString(out);
  const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'anemate-export.svg';
  document.body.append(a);
  a.click();
  a.remove();
}

// Tabs
for (const btn of document.querySelectorAll('#tabs button')) {
  btn.onclick = () => {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    document.getElementById(`${target}-tab`).classList.add('active');
  };
}

// Tool selection
for (const btn of document.querySelectorAll('#tool-grid button')) {
  btn.onclick = () => {
    document.querySelectorAll('#tool-grid button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
  };
}

canvas.addEventListener('mousedown', (evt) => {
  const p = getPoint(evt);
  const hit = evt.target.closest('[data-shape="true"]');

  if (state.tool === 'select') {
    if (hit) {
      setSelected(hit.dataset.id);
      state.drag = { id: hit.dataset.id, startX: p.x, startY: p.y, ...transformOf(hit) };
    } else {
      setSelected(null);
    }
    return;
  }

  let shape;
  if (state.tool === 'rect') {
    shape = document.createElementNS(ns, 'rect');
    shape.setAttribute('x', p.x);
    shape.setAttribute('y', p.y);
    shape.setAttribute('width', 1);
    shape.setAttribute('height', 1);
    baseStyle(shape);
    addShape(shape, 'Rect');
    state.drawing = { type: 'rect', shape, start: p };
  } else if (state.tool === 'circle') {
    shape = document.createElementNS(ns, 'circle');
    shape.setAttribute('cx', p.x);
    shape.setAttribute('cy', p.y);
    shape.setAttribute('r', 1);
    baseStyle(shape);
    addShape(shape, 'Circle');
    state.drawing = { type: 'circle', shape, start: p };
  } else if (state.tool === 'line') {
    shape = document.createElementNS(ns, 'line');
    shape.setAttribute('x1', p.x);
    shape.setAttribute('y1', p.y);
    shape.setAttribute('x2', p.x);
    shape.setAttribute('y2', p.y);
    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', strokeEl.value);
    shape.setAttribute('stroke-width', strokeWidthEl.value);
    addShape(shape, 'Line');
    state.drawing = { type: 'line', shape };
  } else if (state.tool === 'pen') {
    shape = document.createElementNS(ns, 'polyline');
    shape.setAttribute('points', `${p.x},${p.y}`);
    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', strokeEl.value);
    shape.setAttribute('stroke-width', strokeWidthEl.value);
    shape.setAttribute('stroke-linecap', 'round');
    shape.setAttribute('stroke-linejoin', 'round');
    addShape(shape, 'Pen');
    state.drawing = { type: 'pen', shape };
  }
});

canvas.addEventListener('mousemove', (evt) => {
  const p = getPoint(evt);

  if (state.drag) {
    const el = canvas.querySelector(`[data-id="${state.drag.id}"]`);
    const dx = p.x - state.drag.startX;
    const dy = p.y - state.drag.startY;
    applyTransform(el, { ...transformOf(el), x: state.drag.x + dx, y: state.drag.y + dy });
    return;
  }

  if (!state.drawing) return;
  const { type, shape, start } = state.drawing;

  if (type === 'rect') {
    shape.setAttribute('x', Math.min(start.x, p.x));
    shape.setAttribute('y', Math.min(start.y, p.y));
    shape.setAttribute('width', Math.abs(p.x - start.x));
    shape.setAttribute('height', Math.abs(p.y - start.y));
  } else if (type === 'circle') {
    const r = Math.hypot(p.x - start.x, p.y - start.y);
    shape.setAttribute('r', r);
  } else if (type === 'line') {
    shape.setAttribute('x2', p.x);
    shape.setAttribute('y2', p.y);
  } else if (type === 'pen') {
    shape.setAttribute('points', `${shape.getAttribute('points')} ${p.x},${p.y}`);
  }
});

window.addEventListener('mouseup', () => {
  state.drawing = null;
  state.drag = null;
});

document.getElementById('delete-btn').onclick = () => {
  const el = getSelected();
  if (!el) return;
  const id = el.dataset.id;
  el.remove();
  state.layers = state.layers.filter((l) => l.id !== id);
  state.keyframes.delete(id);
  setSelected(null);
  renderLayers();
};

document.getElementById('clear-btn').onclick = () => {
  stopPlayback();
  canvas.innerHTML = '';
  state.layers = [];
  state.keyframes.clear();
  setSelected(null);
  renderLayers();
  renderTimeline();
};

document.getElementById('extrude-btn').onclick = extrudeSelected;
document.getElementById('export-btn').onclick = exportSVG;
document.getElementById('play-btn').onclick = playSelected;
document.getElementById('stop-btn').onclick = stopPlayback;

document.getElementById('add-keyframe-btn').onclick = () => {
  const el = getSelected();
  if (!el) return;
  const id = el.dataset.id;
  const frames = state.keyframes.get(id) || [];
  frames.push({
    time: Number(kfInputs.time.value),
    x: Number(kfInputs.x.value),
    y: Number(kfInputs.y.value),
    scale: Number(kfInputs.scale.value),
    rotate: Number(kfInputs.rotate.value),
    opacity: Number(kfInputs.opacity.value),
  });
  state.keyframes.set(id, frames);
  renderTimeline();
};

renderLayers();
renderTimeline();
