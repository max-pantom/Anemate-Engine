const SVG_NS = "http://www.w3.org/2000/svg";
const stage = document.getElementById("stage");
const statusEl = document.getElementById("status");

const INITIAL_VIEWBOX = { x: 0, y: 0, w: 1200, h: 760 };

const state = {
  tool: "select",
  selected: null,
  drawing: null,
  start: null,
  dragging: false,
  dragOrigin: null,
  itemOrigin: null,
  pathPoints: [],
  shapeCount: 0,
  nextId: 1,
  snapEnabled: false,
  spacePan: false,
  panning: false,
  panOrigin: null,
  viewBox: { ...INITIAL_VIEWBOX },
  history: [],
  redo: []
};

const byId = (id) => document.getElementById(id);
const getStyles = () => ({
  fill: byId("fillColor").value,
  stroke: byId("strokeColor").value,
  strokeWidth: byId("strokeWidth").value
});

const easingMap = {
  linear: null,
  ease: "0.25 0.1 0.25 1",
  "ease-in": "0.42 0 1 1",
  "ease-out": "0 0 0.58 1",
  "ease-in-out": "0.42 0 0.58 1"
};

const templates = {
  float: [
    { type: "translate", from: "0 0", to: "0 -25", dur: 2.2 }
  ],
  pulse: [
    { type: "scale", from: "1 1", to: "1.12 1.12", dur: 1.1 }
  ],
  spin: [
    { type: "rotate", from: "0 300 200", to: "360 300 200", dur: 2.4 }
  ],
  fadeInOut: [
    { type: "opacity", from: "1", to: "0.2", dur: 1.6 }
  ],
  bounce: [
    { type: "translate", from: "0 0", to: "0 -55", dur: 0.7 }
  ]
};

const setViewBox = ({ x, y, w, h }) => {
  state.viewBox = { x, y, w, h };
  stage.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
};

setViewBox(INITIAL_VIEWBOX);

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    panels.forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`[data-panel='${tab.dataset.tab}']`).classList.add("is-active");
  });
});

const tools = document.querySelectorAll(".tool");
tools.forEach((btn) => {
  btn.addEventListener("click", () => {
    tools.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.tool = btn.dataset.tool;
    state.pathPoints = [];
    statusEl.textContent = `Tool: ${state.tool}`;
  });
});

const pointOnStage = (evt) => {
  const pt = stage.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(stage.getScreenCTM().inverse());
};

const snap = (value) => {
  if (!state.snapEnabled) return value;
  const grid = Math.max(4, Number(byId("gridSize").value || 24));
  return Math.round(value / grid) * grid;
};

const snapPoint = ({ x, y }) => ({ x: snap(x), y: snap(y) });

const applyStyles = (el) => {
  const styles = getStyles();
  el.setAttribute("fill", styles.fill);
  el.setAttribute("stroke", styles.stroke);
  el.setAttribute("stroke-width", styles.strokeWidth);
};

const refreshLayerList = () => {
  const layerList = byId("layerList");
  if (!layerList) return;
  layerList.innerHTML = "";
  const layers = [...stage.children].reverse();
  layers.forEach((el) => {
    if (el.tagName === "defs") return;
    const li = document.createElement("li");
    const label = el.dataset.name || `${el.tagName} ${el.dataset.id || ""}`.trim();
    li.textContent = label;
    if (state.selected === el) li.classList.add("is-selected");
    li.addEventListener("click", () => selectElement(el));
    layerList.appendChild(li);
  });
};

const selectElement = (el) => {
  if (state.selected) state.selected.classList.remove("selected");
  state.selected = el;
  if (el) el.classList.add("selected");
  refreshLayerList();
};

const recordHistory = () => {
  state.history.push({
    markup: stage.innerHTML,
    viewBox: { ...state.viewBox },
    shapeCount: state.shapeCount,
    nextId: state.nextId
  });
  if (state.history.length > 120) state.history.shift();
  state.redo = [];
};

const restoreState = (snapshot) => {
  stage.innerHTML = snapshot.markup;
  setViewBox(snapshot.viewBox);
  state.shapeCount = snapshot.shapeCount;
  state.nextId = snapshot.nextId;
  selectElement(null);
  refreshLayerList();
};

const createShape = (tool, x, y) => {
  let el;
  if (tool === "rect") {
    el = document.createElementNS(SVG_NS, "rect");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("width", 1);
    el.setAttribute("height", 1);
  }
  if (tool === "circle") {
    el = document.createElementNS(SVG_NS, "circle");
    el.setAttribute("cx", x);
    el.setAttribute("cy", y);
    el.setAttribute("r", 1);
  }
  if (tool === "path") {
    el = document.createElementNS(SVG_NS, "polyline");
    el.setAttribute("fill", "none");
    el.setAttribute("points", `${x},${y}`);
    state.pathPoints = [[x, y]];
  }
  if (!el) return null;
  el.dataset.id = String(state.nextId++);
  el.dataset.name = `Shape ${++state.shapeCount}`;
  applyStyles(el);
  stage.appendChild(el);
  refreshLayerList();
  return el;
};

const normalizeSelectable = (target) => {
  if (!target || target === stage) return null;
  let node = target;
  while (node && node.parentNode && node.parentNode !== stage) node = node.parentNode;
  return node && node !== stage ? node : null;
};

const parsePoints = (raw) => raw.trim().split(" ").map((pair) => pair.split(",").map(Number));

stage.addEventListener("mousedown", (evt) => {
  const p = snapPoint(pointOnStage(evt));
  state.start = p;

  const shouldPan = state.tool === "pan" || evt.button === 1 || state.spacePan;
  if (shouldPan) {
    recordHistory();
    state.panning = true;
    state.panOrigin = pointOnStage(evt);
    stage.classList.add("is-panning");
    statusEl.textContent = "Panning viewport";
    return;
  }

  if (state.tool === "select") {
    const target = normalizeSelectable(evt.target);
    selectElement(target);
    if (target) {
      recordHistory();
      state.dragging = true;
      state.dragOrigin = p;
      if (target.tagName === "rect") {
        state.itemOrigin = { x: +target.getAttribute("x"), y: +target.getAttribute("y") };
      }
      if (target.tagName === "circle") {
        state.itemOrigin = { x: +target.getAttribute("cx"), y: +target.getAttribute("cy") };
      }
      if (target.tagName === "polyline") {
        state.itemOrigin = parsePoints(target.getAttribute("points"));
      }
    }
    return;
  }

  recordHistory();
  state.drawing = createShape(state.tool, p.x, p.y);
  selectElement(state.drawing);
});

stage.addEventListener("mousemove", (evt) => {
  const p = snapPoint(pointOnStage(evt));

  if (state.panning) {
    const next = pointOnStage(evt);
    const dx = next.x - state.panOrigin.x;
    const dy = next.y - state.panOrigin.y;
    setViewBox({
      x: state.viewBox.x - dx,
      y: state.viewBox.y - dy,
      w: state.viewBox.w,
      h: state.viewBox.h
    });
    state.panOrigin = next;
    return;
  }

  if (state.dragging && state.selected) {
    const dx = p.x - state.dragOrigin.x;
    const dy = p.y - state.dragOrigin.y;
    const el = state.selected;
    if (el.tagName === "rect") {
      el.setAttribute("x", state.itemOrigin.x + dx);
      el.setAttribute("y", state.itemOrigin.y + dy);
    }
    if (el.tagName === "circle") {
      el.setAttribute("cx", state.itemOrigin.x + dx);
      el.setAttribute("cy", state.itemOrigin.y + dy);
    }
    if (el.tagName === "polyline") {
      const moved = state.itemOrigin.map(([x, y]) => `${x + dx},${y + dy}`).join(" ");
      el.setAttribute("points", moved);
    }
    return;
  }

  if (!state.drawing || !state.start) return;

  if (state.tool === "rect") {
    state.drawing.setAttribute("x", Math.min(state.start.x, p.x));
    state.drawing.setAttribute("y", Math.min(state.start.y, p.y));
    state.drawing.setAttribute("width", Math.abs(p.x - state.start.x));
    state.drawing.setAttribute("height", Math.abs(p.y - state.start.y));
  }

  if (state.tool === "circle") {
    const r = Math.hypot(p.x - state.start.x, p.y - state.start.y);
    state.drawing.setAttribute("r", r);
  }

  if (state.tool === "path") {
    state.pathPoints.push([p.x, p.y]);
    const points = state.pathPoints.map(([x, y]) => `${x},${y}`).join(" ");
    state.drawing.setAttribute("points", points);
  }
});

window.addEventListener("mouseup", () => {
  state.drawing = null;
  state.start = null;
  state.dragging = false;
  state.dragOrigin = null;
  state.itemOrigin = null;
  state.panning = false;
  state.panOrigin = null;
  stage.classList.remove("is-panning");
  statusEl.textContent = `Tool: ${state.tool}`;
  refreshLayerList();
});

window.addEventListener("keydown", (evt) => {
  if (evt.code === "Space") {
    state.spacePan = true;
    evt.preventDefault();
  }
});

window.addEventListener("keyup", (evt) => {
  if (evt.code === "Space") state.spacePan = false;
});

stage.addEventListener("wheel", (evt) => {
  evt.preventDefault();
  const delta = evt.deltaY > 0 ? 1.1 : 0.9;
  const nextW = Math.max(200, Math.min(3000, state.viewBox.w * delta));
  const nextH = Math.max(120, Math.min(2200, state.viewBox.h * delta));
  setViewBox({ ...state.viewBox, w: nextW, h: nextH });
});

byId("zoomInBtn").addEventListener("click", () => {
  setViewBox({ ...state.viewBox, w: state.viewBox.w * 0.9, h: state.viewBox.h * 0.9 });
});

byId("zoomOutBtn").addEventListener("click", () => {
  setViewBox({ ...state.viewBox, w: state.viewBox.w * 1.1, h: state.viewBox.h * 1.1 });
});

byId("resetViewBtn").addEventListener("click", () => setViewBox(INITIAL_VIEWBOX));

byId("snapToggle").addEventListener("click", () => {
  state.snapEnabled = !state.snapEnabled;
  byId("snapToggle").textContent = `Snap: ${state.snapEnabled ? "on" : "off"}`;
});

byId("extrudeBtn").addEventListener("click", () => {
  if (!state.selected) return;
  recordHistory();
  const depth = Number(byId("extrudeDepth").value);
  const base = state.selected;
  const group = document.createElementNS(SVG_NS, "g");
  group.dataset.id = String(state.nextId++);
  group.dataset.name = `${base.dataset.name || base.tagName} Extrude`;
  for (let i = depth; i >= 1; i -= 1) {
    const clone = base.cloneNode(true);
    clone.classList.remove("selected");
    clone.setAttribute("opacity", (0.04 + i * 0.03).toFixed(2));
    clone.setAttribute("transform", `translate(${i * 2}, ${i * 2})`);
    group.appendChild(clone);
  }
  const top = base.cloneNode(true);
  top.removeAttribute("class");
  group.appendChild(top);
  stage.replaceChild(group, base);
  selectElement(group);
  refreshLayerList();
  statusEl.textContent = "Extruded into layered group";
});

const applyAnimation = ({ type, from, to, dur }) => {
  if (!state.selected) return;
  const delay = Number(byId("animDelay").value || 0);
  const repeat = byId("animRepeat").value;
  const ease = byId("animEase").value;

  let anim;
  if (type === "opacity") {
    anim = document.createElementNS(SVG_NS, "animate");
    anim.setAttribute("attributeName", "opacity");
  } else {
    anim = document.createElementNS(SVG_NS, "animateTransform");
    anim.setAttribute("attributeName", "transform");
    anim.setAttribute("type", type);
    anim.setAttribute("additive", "sum");
  }

  anim.setAttribute("from", from);
  anim.setAttribute("to", to);
  anim.setAttribute("dur", `${dur}s`);
  anim.setAttribute("begin", `${delay}s`);
  anim.setAttribute("repeatCount", repeat);

  if (ease !== "linear") {
    anim.setAttribute("calcMode", "spline");
    anim.setAttribute("keyTimes", "0;1");
    anim.setAttribute("keySplines", easingMap[ease]);
  }

  state.selected.appendChild(anim);

  const li = document.createElement("li");
  li.textContent = `${state.selected.dataset.name || state.selected.tagName}: ${type} ${from} → ${to} (${dur}s, ${ease})`;
  byId("animList").appendChild(li);
};

const appendAnimation = () => {
  if (!state.selected) return;
  recordHistory();
  applyAnimation({
    type: byId("animType").value,
    from: byId("animFrom").value.trim(),
    to: byId("animTo").value.trim(),
    dur: Number(byId("animDur").value || 2)
  });
};

byId("addAnimBtn").addEventListener("click", appendAnimation);
byId("applyTemplateBtn").addEventListener("click", () => {
  const template = byId("animTemplate").value;
  if (!state.selected || !template || !templates[template]) return;
  recordHistory();
  templates[template].forEach(applyAnimation);
  statusEl.textContent = `Template '${template}' applied`;
});

byId("previewBtn").addEventListener("click", () => {
  const anims = stage.querySelectorAll("animate, animateTransform");
  anims.forEach((anim) => {
    if (typeof anim.beginElement === "function") anim.beginElement();
  });
  statusEl.textContent = "Animation preview restarted";
});

const assignElementMetadata = (el) => {
  if (el.nodeType !== 1) return;
  if (!el.dataset.id) el.dataset.id = String(state.nextId++);
  if (!el.dataset.name) {
    state.shapeCount += 1;
    el.dataset.name = `Imported ${el.tagName} ${state.shapeCount}`;
  }
};

const importSvgText = (text) => {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return;
  recordHistory();
  [...svg.children].forEach((child) => {
    const imported = document.importNode(child, true);
    assignElementMetadata(imported);
    stage.appendChild(imported);
  });
  selectElement(null);
  refreshLayerList();
  statusEl.textContent = "SVG imported";
};

byId("importSvgInput").addEventListener("change", async (evt) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  importSvgText(text);
  evt.target.value = "";
});

stage.addEventListener("dragover", (evt) => evt.preventDefault());
stage.addEventListener("drop", async (evt) => {
  evt.preventDefault();
  const file = evt.dataTransfer?.files?.[0];
  if (!file || !file.name.endsWith(".svg")) return;
  const text = await file.text();
  importSvgText(text);
});

byId("bringFrontBtn").addEventListener("click", () => {
  if (!state.selected) return;
  recordHistory();
  stage.appendChild(state.selected);
  refreshLayerList();
});

byId("sendBackBtn").addEventListener("click", () => {
  if (!state.selected) return;
  recordHistory();
  stage.insertBefore(state.selected, stage.firstChild);
  refreshLayerList();
});

byId("duplicateBtn").addEventListener("click", () => {
  if (!state.selected) return;
  recordHistory();
  const clone = state.selected.cloneNode(true);
  clone.classList.remove("selected");
  assignElementMetadata(clone);
  stage.appendChild(clone);
  selectElement(clone);
});

byId("deleteBtn").addEventListener("click", () => {
  if (!state.selected) return;
  recordHistory();
  stage.removeChild(state.selected);
  selectElement(null);
  refreshLayerList();
});

byId("undoBtn").addEventListener("click", () => {
  if (state.history.length === 0) return;
  state.redo.push({
    markup: stage.innerHTML,
    viewBox: { ...state.viewBox },
    shapeCount: state.shapeCount,
    nextId: state.nextId
  });
  const previous = state.history.pop();
  restoreState(previous);
  statusEl.textContent = "Undo";
});

byId("redoBtn").addEventListener("click", () => {
  if (state.redo.length === 0) return;
  state.history.push({
    markup: stage.innerHTML,
    viewBox: { ...state.viewBox },
    shapeCount: state.shapeCount,
    nextId: state.nextId
  });
  const next = state.redo.pop();
  restoreState(next);
  statusEl.textContent = "Redo";
});

byId("clearBtn").addEventListener("click", () => {
  recordHistory();
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  byId("animList").innerHTML = "";
  refreshLayerList();
});

byId("exportBtn").addEventListener("click", () => {
  const source = new XMLSerializer().serializeToString(stage);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "anemate-export.svg";
  a.click();
  URL.revokeObjectURL(url);
  statusEl.textContent = "Exported SVG";
});

refreshLayerList();
