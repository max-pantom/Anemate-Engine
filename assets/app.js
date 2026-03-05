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
  panning: false,
  panStart: null,
  viewBoxStart: null,
  spaceDown: false,
  history: [],
  historyIndex: -1
};

const byId = (id) => document.getElementById(id);
const getViewBox = () => {
  const [x, y, w, h] = stage.getAttribute("viewBox").split(" ").map(Number);
  return { x, y, w, h };
};
const setViewBox = ({ x, y, w, h }) => stage.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);

const getStyles = () => ({
  fill: byId("fillColor").value,
  stroke: byId("strokeColor").value,
  strokeWidth: byId("strokeWidth").value
});

const snapPoint = (x, y) => {
  if (!byId("snapToggle").checked) return { x, y };
  const grid = Number(byId("gridSize").value) || 24;
  return {
    x: Math.round(x / grid) * grid,
    y: Math.round(y / grid) * grid
  };
};

const saveHistory = () => {
  const snapshot = {
    stage: stage.innerHTML,
    viewBox: stage.getAttribute("viewBox")
  };
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > 80) state.history.shift();
  state.historyIndex = state.history.length - 1;
};

const restoreHistory = (index) => {
  const shot = state.history[index];
  if (!shot) return;
  stage.innerHTML = shot.stage;
  stage.setAttribute("viewBox", shot.viewBox);
  state.historyIndex = index;
  selectElement(null);
};

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
const activateTool = (tool) => {
  state.tool = tool;
  state.pathPoints = [];
  tools.forEach((b) => b.classList.toggle("is-active", b.dataset.tool === tool));
  statusEl.textContent = `Tool: ${state.tool}`;
};
tools.forEach((btn) => {
  btn.addEventListener("click", () => activateTool(btn.dataset.tool));
});

const pointOnStage = (evt) => {
  const pt = stage.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(stage.getScreenCTM().inverse());
};

const applyStyles = (el) => {
  const styles = getStyles();
  el.setAttribute("fill", styles.fill);
  el.setAttribute("stroke", styles.stroke);
  el.setAttribute("stroke-width", styles.strokeWidth);
};

const selectElement = (el) => {
  if (state.selected) state.selected.classList.remove("selected");
  state.selected = el;
  if (el) el.classList.add("selected");
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
  el.dataset.name = `Shape ${++state.shapeCount}`;
  applyStyles(el);
  stage.appendChild(el);
  return el;
};

const startPan = (evt) => {
  state.panning = true;
  state.panStart = pointOnStage(evt);
  state.viewBoxStart = getViewBox();
};

const panTo = (evt) => {
  const p = pointOnStage(evt);
  const dx = p.x - state.panStart.x;
  const dy = p.y - state.panStart.y;
  const next = {
    x: state.viewBoxStart.x - dx,
    y: state.viewBoxStart.y - dy,
    w: state.viewBoxStart.w,
    h: state.viewBoxStart.h
  };
  setViewBox(next);
};

stage.addEventListener("mousedown", (evt) => {
  const pRaw = pointOnStage(evt);
  const p = snapPoint(pRaw.x, pRaw.y);
  state.start = p;

  if (evt.button === 1 || state.tool === "pan" || state.spaceDown) {
    startPan(evt);
    return;
  }

  if (state.tool === "select") {
    const target = evt.target !== stage ? evt.target : null;
    selectElement(target);
    if (target) {
      state.dragging = true;
      state.dragOrigin = p;
      if (target.tagName === "rect") {
        state.itemOrigin = { x: +target.getAttribute("x"), y: +target.getAttribute("y") };
      }
      if (target.tagName === "circle") {
        state.itemOrigin = { x: +target.getAttribute("cx"), y: +target.getAttribute("cy") };
      }
      if (target.tagName === "polyline") {
        state.itemOrigin = target.getAttribute("points");
      }
    }
    return;
  }

  state.drawing = createShape(state.tool, p.x, p.y);
  selectElement(state.drawing);
});

stage.addEventListener("mousemove", (evt) => {
  const pRaw = pointOnStage(evt);
  const p = snapPoint(pRaw.x, pRaw.y);

  if (state.panning) {
    panTo(evt);
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
      const moved = state.itemOrigin
        .trim()
        .split(" ")
        .map((pair) => pair.split(",").map(Number))
        .map(([x, y]) => `${x + dx},${y + dy}`)
        .join(" ");
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
  const shouldSave = state.drawing || state.dragging || state.panning;
  state.drawing = null;
  state.start = null;
  state.dragging = false;
  state.dragOrigin = null;
  state.itemOrigin = null;
  state.panning = false;
  state.panStart = null;
  state.viewBoxStart = null;
  if (shouldSave) saveHistory();
});

window.addEventListener("keydown", (evt) => {
  if (evt.code === "Space") {
    state.spaceDown = true;
    evt.preventDefault();
  }
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "z") {
    evt.preventDefault();
    if (evt.shiftKey) {
      if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1);
    } else if (state.historyIndex > 0) {
      restoreHistory(state.historyIndex - 1);
    }
  }
});

window.addEventListener("keyup", (evt) => {
  if (evt.code === "Space") state.spaceDown = false;
});

stage.addEventListener("wheel", (evt) => {
  evt.preventDefault();
  const vb = getViewBox();
  const zoomFactor = evt.deltaY < 0 ? 0.92 : 1.08;
  const pointer = pointOnStage(evt);
  const nextW = vb.w * zoomFactor;
  const nextH = vb.h * zoomFactor;
  const ratioX = (pointer.x - vb.x) / vb.w;
  const ratioY = (pointer.y - vb.y) / vb.h;
  setViewBox({
    x: pointer.x - nextW * ratioX,
    y: pointer.y - nextH * ratioY,
    w: nextW,
    h: nextH
  });
}, { passive: false });

byId("extrudeBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const depth = Number(byId("extrudeDepth").value);
  const base = state.selected;
  const group = document.createElementNS(SVG_NS, "g");
  for (let i = depth; i >= 1; i -= 1) {
    const clone = base.cloneNode(true);
    clone.classList.remove("selected");
    clone.removeAttribute("data-name");
    clone.setAttribute("opacity", (0.04 + i * 0.03).toFixed(2));
    clone.setAttribute("transform", `translate(${i * 2}, ${i * 2})`);
    group.appendChild(clone);
  }
  const top = base.cloneNode(true);
  top.removeAttribute("class");
  group.appendChild(top);
  stage.replaceChild(group, base);
  selectElement(group);
  saveHistory();
  statusEl.textContent = "Extruded into layered group";
});

const templates = {
  slideRight: { type: "translate", from: "0 0", to: "140 0", dur: 1.8 },
  pulse: { type: "scale", from: "1", to: "1.25", dur: 1.2 },
  spin: { type: "rotate", from: "0 200 200", to: "360 200 200", dur: 2.4 },
  fade: { type: "opacity", from: "0.15", to: "1", dur: 1.5 },
  bounce: { type: "translate", from: "0 0", to: "0 -90", dur: 0.8 }
};

byId("applyTemplateBtn").addEventListener("click", () => {
  const name = byId("animTemplate").value;
  if (name === "custom") return;
  const tpl = templates[name];
  byId("animType").value = tpl.type;
  byId("animFrom").value = tpl.from;
  byId("animTo").value = tpl.to;
  byId("animDur").value = tpl.dur;
  statusEl.textContent = `Loaded template: ${name}`;
});

const appendAnimation = () => {
  if (!state.selected) return;
  const type = byId("animType").value;
  const from = byId("animFrom").value.trim();
  const to = byId("animTo").value.trim();
  const dur = Number(byId("animDur").value || 2);

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
  anim.setAttribute("repeatCount", "indefinite");
  state.selected.appendChild(anim);
  saveHistory();

  const li = document.createElement("li");
  li.textContent = `${state.selected.dataset.name || state.selected.tagName}: ${type} ${from} → ${to} (${dur}s)`;
  byId("animList").appendChild(li);
};

byId("addAnimBtn").addEventListener("click", appendAnimation);
byId("clearAnimBtn").addEventListener("click", () => {
  if (!state.selected) return;
  state.selected.querySelectorAll("animate, animateTransform").forEach((a) => a.remove());
  byId("animList").innerHTML = "";
  saveHistory();
});

byId("playBtn").addEventListener("click", () => stage.unpauseAnimations());
byId("pauseBtn").addEventListener("click", () => stage.pauseAnimations());
byId("stopBtn").addEventListener("click", () => {
  stage.setCurrentTime(0);
  stage.pauseAnimations();
});

byId("duplicateBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const clone = state.selected.cloneNode(true);
  clone.classList.remove("selected");
  clone.dataset.name = `Shape ${++state.shapeCount}`;
  clone.setAttribute("transform", "translate(20,20)");
  stage.appendChild(clone);
  selectElement(clone);
  saveHistory();
});

byId("deleteBtn").addEventListener("click", () => {
  if (!state.selected) return;
  state.selected.remove();
  selectElement(null);
  saveHistory();
});

byId("frontBtn").addEventListener("click", () => {
  if (!state.selected) return;
  stage.appendChild(state.selected);
  saveHistory();
});

byId("backBtn").addEventListener("click", () => {
  if (!state.selected) return;
  stage.prepend(state.selected);
  saveHistory();
});

byId("undoBtn").addEventListener("click", () => {
  if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1);
});

byId("redoBtn").addEventListener("click", () => {
  if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1);
});

byId("zoomInBtn").addEventListener("click", () => {
  const vb = getViewBox();
  setViewBox({ x: vb.x + vb.w * 0.04, y: vb.y + vb.h * 0.04, w: vb.w * 0.92, h: vb.h * 0.92 });
  saveHistory();
});

byId("zoomOutBtn").addEventListener("click", () => {
  const vb = getViewBox();
  setViewBox({ x: vb.x - vb.w * 0.04, y: vb.y - vb.h * 0.04, w: vb.w * 1.08, h: vb.h * 1.08 });
  saveHistory();
});

byId("resetViewBtn").addEventListener("click", () => {
  setViewBox(INITIAL_VIEWBOX);
  saveHistory();
});

byId("importSvg").addEventListener("change", async (evt) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const imported = doc.querySelector("svg");
  if (!imported) return;

  while (imported.firstChild) {
    const child = imported.firstChild;
    imported.removeChild(child);
    stage.appendChild(document.importNode(child, true));
  }

  saveHistory();
  statusEl.textContent = `Imported: ${file.name}`;
  evt.target.value = "";
});

byId("clearBtn").addEventListener("click", () => {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  byId("animList").innerHTML = "";
  saveHistory();
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

saveHistory();
