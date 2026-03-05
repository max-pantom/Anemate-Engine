const svgNS = 'http://www.w3.org/2000/svg';
const canvas = document.getElementById('canvas');
const layersEl = document.getElementById('layers');
const animTarget = document.getElementById('animTarget');
const animationList = document.getElementById('animationList');

const state = {
  tool: 'select',
  drawing: null,
  points: [],
  selected: null,
  dragOffset: null,
  id: 1,
  animations: []
};

const ui = {
  fill: document.getElementById('fill'),
  stroke: document.getElementById('stroke'),
  strokeWidth: document.getElementById('strokeWidth'),
  posX: document.getElementById('posX'),
  posY: document.getElementById('posY')
};

function pickPoint(evt) {
  const pt = canvas.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function styleShape(el) {
  el.setAttribute('fill', ui.fill.value);
  el.setAttribute('stroke', ui.stroke.value);
  el.setAttribute('stroke-width', ui.strokeWidth.value);
}

function addLayer(el) {
  el.dataset.layerId = `layer-${state.id++}`;
  canvas.appendChild(el);
  setSelected(el);
  refreshLayers();
}

function refreshLayers() {
  const layers = [...canvas.querySelectorAll('[data-layer-id]')];
  layersEl.innerHTML = '';
  animTarget.innerHTML = '';
  layers.forEach((layer, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${layer.tagName} (${layer.dataset.layerId})`;
    li.onclick = () => setSelected(layer);
    layersEl.appendChild(li);

    const option = document.createElement('option');
    option.value = layer.dataset.layerId;
    option.textContent = layer.dataset.layerId;
    animTarget.appendChild(option);
  });
}

function setSelected(el) {
  if (state.selected) state.selected.classList.remove('selected');
  state.selected = el;
  if (!el) return;
  el.classList.add('selected');
  const box = el.getBBox();
  ui.posX.value = Math.round(box.x);
  ui.posY.value = Math.round(box.y);
}

function createShape(tool, point) {
  let el;
  if (tool === 'rect') {
    el = document.createElementNS(svgNS, 'rect');
    el.setAttribute('x', point.x);
    el.setAttribute('y', point.y);
    el.setAttribute('width', 1);
    el.setAttribute('height', 1);
  } else if (tool === 'ellipse') {
    el = document.createElementNS(svgNS, 'ellipse');
    el.setAttribute('cx', point.x);
    el.setAttribute('cy', point.y);
    el.setAttribute('rx', 1);
    el.setAttribute('ry', 1);
  } else if (tool === 'line') {
    el = document.createElementNS(svgNS, 'line');
    el.setAttribute('x1', point.x);
    el.setAttribute('y1', point.y);
    el.setAttribute('x2', point.x);
    el.setAttribute('y2', point.y);
    el.setAttribute('fill', 'none');
  } else if (tool === 'path') {
    el = document.createElementNS(svgNS, 'path');
    el.setAttribute('d', `M ${point.x} ${point.y}`);
    el.setAttribute('fill', 'none');
    state.points = [`M ${point.x} ${point.y}`];
  }
  styleShape(el);
  return el;
}

canvas.addEventListener('mousedown', (evt) => {
  const point = pickPoint(evt);
  const target = evt.target.closest('[data-layer-id]');

  if (state.tool === 'select') {
    if (target) {
      setSelected(target);
      const b = target.getBBox();
      state.dragOffset = { dx: point.x - b.x, dy: point.y - b.y };
    } else {
      setSelected(null);
    }
    return;
  }

  state.drawing = createShape(state.tool, point);
  addLayer(state.drawing);
});

canvas.addEventListener('mousemove', (evt) => {
  const point = pickPoint(evt);

  if (state.tool === 'select' && state.selected && state.dragOffset && evt.buttons) {
    const b = state.selected.getBBox();
    const nx = point.x - state.dragOffset.dx;
    const ny = point.y - state.dragOffset.dy;
    const dx = nx - b.x;
    const dy = ny - b.y;
    state.selected.setAttribute('transform', `translate(${dx}, ${dy})`);
    return;
  }

  if (!state.drawing) return;

  if (state.tool === 'rect') {
    state.drawing.setAttribute('width', Math.abs(point.x - Number(state.drawing.getAttribute('x'))));
    state.drawing.setAttribute('height', Math.abs(point.y - Number(state.drawing.getAttribute('y'))));
  } else if (state.tool === 'ellipse') {
    state.drawing.setAttribute('rx', Math.abs(point.x - Number(state.drawing.getAttribute('cx'))));
    state.drawing.setAttribute('ry', Math.abs(point.y - Number(state.drawing.getAttribute('cy'))));
  } else if (state.tool === 'line') {
    state.drawing.setAttribute('x2', point.x);
    state.drawing.setAttribute('y2', point.y);
  } else if (state.tool === 'path') {
    state.points.push(`L ${point.x} ${point.y}`);
    state.drawing.setAttribute('d', state.points.join(' '));
  }
});

window.addEventListener('mouseup', () => {
  state.drawing = null;
  state.dragOffset = null;
  state.points = [];
});

ui.posX.addEventListener('change', () => {
  if (!state.selected) return;
  const box = state.selected.getBBox();
  const dx = Number(ui.posX.value) - box.x;
  const prev = state.selected.getAttribute('transform') || 'translate(0,0)';
  const [, tx = 0, ty = 0] = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(prev) || [];
  state.selected.setAttribute('transform', `translate(${Number(tx) + dx}, ${Number(ty)})`);
});

ui.posY.addEventListener('change', () => {
  if (!state.selected) return;
  const box = state.selected.getBBox();
  const dy = Number(ui.posY.value) - box.y;
  const prev = state.selected.getAttribute('transform') || 'translate(0,0)';
  const [, tx = 0, ty = 0] = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(prev) || [];
  state.selected.setAttribute('transform', `translate(${Number(tx)}, ${Number(ty) + dy})`);
});

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    canvas.style.cursor = state.tool === 'select' ? 'default' : 'crosshair';
  });
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab, .tab-panel').forEach((n) => n.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('addAnimation').addEventListener('click', () => {
  const targetId = animTarget.value;
  if (!targetId) return;
  const item = {
    id: `anim-${Date.now()}`,
    targetId,
    property: document.getElementById('animProperty').value,
    from: document.getElementById('animFrom').value,
    to: document.getElementById('animTo').value,
    duration: document.getElementById('animDuration').value,
    loop: document.getElementById('animLoop').value
  };
  state.animations.push(item);
  renderAnimations();
});

function renderAnimations() {
  animationList.innerHTML = '';
  state.animations.forEach((anim) => {
    const li = document.createElement('li');
    li.textContent = `${anim.targetId}: ${anim.property} ${anim.from}→${anim.to} (${anim.duration}s)`;
    animationList.appendChild(li);
  });
}

function applyAnimations() {
  canvas.querySelectorAll('animate, animateTransform').forEach((n) => n.remove());
  state.animations.forEach((anim) => {
    const target = canvas.querySelector(`[data-layer-id="${anim.targetId}"]`);
    if (!target) return;

    let node;
    if (anim.property === 'rotate') {
      node = document.createElementNS(svgNS, 'animateTransform');
      node.setAttribute('attributeName', 'transform');
      node.setAttribute('type', 'rotate');
      const box = target.getBBox();
      node.setAttribute('from', `${anim.from} ${box.x + box.width / 2} ${box.y + box.height / 2}`);
      node.setAttribute('to', `${anim.to} ${box.x + box.width / 2} ${box.y + box.height / 2}`);
    } else {
      node = document.createElementNS(svgNS, 'animate');
      node.setAttribute('attributeName', anim.property === 'x' ? 'x' : anim.property === 'y' ? 'y' : 'opacity');
      node.setAttribute('from', anim.from);
      node.setAttribute('to', anim.to);
    }
    node.setAttribute('dur', `${anim.duration}s`);
    node.setAttribute('repeatCount', anim.loop);
    node.setAttribute('fill', 'freeze');
    target.appendChild(node);
  });
}

document.getElementById('playAnimations').addEventListener('click', () => {
  applyAnimations();
  canvas.querySelectorAll('animate, animateTransform').forEach((n) => n.beginElement?.());
});

document.getElementById('clearAnimations').addEventListener('click', () => {
  state.animations = [];
  renderAnimations();
  canvas.querySelectorAll('animate, animateTransform').forEach((n) => n.remove());
});

document.getElementById('extrudeSelected').addEventListener('click', () => {
  if (!state.selected) return;
  const depth = Number(document.getElementById('extrudeDepth').value);
  const ox = Number(document.getElementById('extrudeX').value);
  const oy = Number(document.getElementById('extrudeY').value);
  for (let i = depth; i > 0; i -= 1) {
    const clone = state.selected.cloneNode(true);
    clone.classList.remove('selected');
    clone.setAttribute('fill', '#2a2a2a');
    clone.setAttribute('stroke', '#414141');
    clone.setAttribute('opacity', String(0.12 + i / (depth * 8)));
    clone.setAttribute('transform', `translate(${ox * i * 0.5}, ${oy * i * 0.5})`);
    clone.dataset.layerId = `layer-${state.id++}`;
    canvas.insertBefore(clone, state.selected);
  }
  refreshLayers();
});

document.getElementById('exportSvg').addEventListener('click', () => {
  applyAnimations();
  const data = new XMLSerializer().serializeToString(canvas);
  document.getElementById('exportOutput').value = data;
  const blob = new Blob([data], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anemate-export.svg';
  a.click();
  URL.revokeObjectURL(url);
});

refreshLayers();
