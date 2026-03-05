const SVG_NS = "http://www.w3.org/2000/svg";
const INITIAL_VIEWBOX = { x: 0, y: 0, width: 1200, height: 760 };
const MAX_HISTORY = 60;
const stage = document.getElementById("stage");
const statusEl = document.getElementById("status");

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
  viewBox: { ...INITIAL_VIEWBOX },
  zoomPercent: 100,
  history: [],
  historyIndex: -1
};

const byId = (id) => document.getElementById(id);
const topLevelShapes = () => [...stage.children].filter((el) => !el.matches("defs"));

const getStyles = () => ({
  fill: byId("fillColor").value,
  stroke: byId("strokeColor").value,
  strokeWidth: byId("strokeWidth").value
});

const animationTemplates = {
  "slide-right": { type: "translate", from: "0 0", to: "120 0", dur: 1.2, ease: "ease-in-out" },
  bounce: { type: "translate", from: "0 0", to: "0 -45", dur: 0.7, ease: "ease-in-out" },
  spin: { type: "rotate", from: "0 300 200", to: "360 300 200", dur: 2, ease: "linear" },
  pulse: { type: "scale", from: "1 1", to: "1.3 1.3", dur: 0.8, ease: "ease-in-out" },
  "fade-in-out": { type: "opacity", from: "0.15", to: "1", dur: 1.1, ease: "ease-in-out" }
};

const setViewBox = () => {
  stage.setAttribute(
    "viewBox",
    `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.width} ${state.viewBox.height}`
  );
};

const updateZoomRange = () => {
  byId("zoomRange").value = String(Math.round(state.zoomPercent));
};

const saveHistory = () => {
  const snapshot = {
    content: stage.innerHTML,
    viewBox: { ...state.viewBox },
    shapeCount: state.shapeCount
  };

  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > MAX_HISTORY) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
};

const applyHistory = (snapshot) => {
  stage.innerHTML = snapshot.content;
  state.viewBox = { ...snapshot.viewBox };
  state.shapeCount = snapshot.shapeCount;
  selectElement(null);
  setViewBox();
  refreshLayers();
  rebuildAnimList();
};

const undo = () => {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  applyHistory(state.history[state.historyIndex]);
  statusEl.textContent = "Undo";
};

const redo = () => {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  applyHistory(state.history[state.historyIndex]);
  statusEl.textContent = "Redo";
};

const refreshLayers = () => {
  const layers = byId("layersList");
  layers.innerHTML = "";
  topLevelShapes()
    .slice()
    .reverse()
    .forEach((el) => {
      const li = document.createElement("li");
      li.textContent = el.dataset.name || el.tagName;
      if (el === state.selected) li.classList.add("is-active");
      li.addEventListener("click", () => selectElement(el));
      layers.appendChild(li);
    });
};

const rebuildAnimList = () => {
  const list = byId("animList");
  list.innerHTML = "";
  topLevelShapes().forEach((shape) => {
    [...shape.querySelectorAll("animate, animateTransform")].forEach((anim) => {
      const item = document.createElement("li");
      item.textContent = `${shape.dataset.name || shape.tagName}: ${anim.tagName} ${anim.getAttribute("from") || ""} → ${anim.getAttribute("to") || ""}`;
      list.appendChild(item);
    });
  });
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

const snapPoint = (point) => {
  if (!byId("snapToggle").checked) return point;
  const size = Math.max(4, Number(byId("gridSize").value || 24));
  return {
    x: Math.round(point.x / size) * size,
    y: Math.round(point.y / size) * size
  };
};

const applyStyles = (el) => {
  const styles = getStyles();
  el.setAttribute("fill", styles.fill);
  el.setAttribute("stroke", styles.stroke);
  el.setAttribute("stroke-width", styles.strokeWidth);
};

function selectElement(el) {
  if (state.selected) state.selected.classList.remove("selected");
  state.selected = el;
  if (el) el.classList.add("selected");
  refreshLayers();
}

const parsePolylinePoints = (pointStr) =>
  pointStr
    .trim()
    .split(" ")
    .map((pair) => pair.split(",").map(Number));

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
  refreshLayers();
  return el;
};

const startPan = (point) => {
  state.panning = true;
  state.dragOrigin = point;
  state.itemOrigin = { x: state.viewBox.x, y: state.viewBox.y };
};

stage.addEventListener("mousedown", (evt) => {
  const rawPoint = pointOnStage(evt);
  const p = snapPoint(rawPoint);
  state.start = p;

  if (state.tool === "pan") {
    startPan(rawPoint);
    return;
  }

  if (state.tool === "select") {
    const target = evt.target !== stage ? evt.target.closest("g,rect,circle,polyline,path,ellipse,line,polygon") : null;
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
      if (target.tagName === "g") {
        state.itemOrigin = target.getAttribute("transform") || "translate(0,0)";
      }
    }
    return;
  }

  state.drawing = createShape(state.tool, p.x, p.y);
  selectElement(state.drawing);
});

stage.addEventListener("mousemove", (evt) => {
  const rawPoint = pointOnStage(evt);
  const p = snapPoint(rawPoint);

  if (state.panning) {
    const dx = rawPoint.x - state.dragOrigin.x;
    const dy = rawPoint.y - state.dragOrigin.y;
    state.viewBox.x = state.itemOrigin.x - dx;
    state.viewBox.y = state.itemOrigin.y - dy;
    setViewBox();
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
      const moved = parsePolylinePoints(state.itemOrigin)
        .map(([x, y]) => `${x + dx},${y + dy}`)
        .join(" ");
      el.setAttribute("points", moved);
    }
    if (el.tagName === "g") {
      el.setAttribute("transform", `translate(${dx}, ${dy})`);
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
  if (state.drawing || state.dragging || state.panning) saveHistory();
  state.drawing = null;
  state.start = null;
  state.dragging = false;
  state.panning = false;
  state.dragOrigin = null;
  state.itemOrigin = null;
});

stage.addEventListener("wheel", (evt) => {
  evt.preventDefault();
  const scale = evt.deltaY > 0 ? 1.08 : 0.92;
  const pointer = pointOnStage(evt);
  state.viewBox.width *= scale;
  state.viewBox.height *= scale;
  state.viewBox.x = pointer.x - ((pointer.x - state.viewBox.x) * scale);
  state.viewBox.y = pointer.y - ((pointer.y - state.viewBox.y) * scale);
  state.zoomPercent = (INITIAL_VIEWBOX.width / state.viewBox.width) * 100;
  setViewBox();
  updateZoomRange();
}, { passive: false });

byId("zoomRange").addEventListener("input", (evt) => {
  const targetZoom = Number(evt.target.value);
  const centerX = state.viewBox.x + state.viewBox.width / 2;
  const centerY = state.viewBox.y + state.viewBox.height / 2;
  state.zoomPercent = targetZoom;
  state.viewBox.width = INITIAL_VIEWBOX.width * (100 / targetZoom);
  state.viewBox.height = INITIAL_VIEWBOX.height * (100 / targetZoom);
  state.viewBox.x = centerX - state.viewBox.width / 2;
  state.viewBox.y = centerY - state.viewBox.height / 2;
  setViewBox();
});

byId("resetViewBtn").addEventListener("click", () => {
  state.viewBox = { ...INITIAL_VIEWBOX };
  state.zoomPercent = 100;
  setViewBox();
  updateZoomRange();
  statusEl.textContent = "Viewport reset";
});

byId("extrudeBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const depth = Number(byId("extrudeDepth").value);
  const base = state.selected;
  const group = document.createElementNS(SVG_NS, "g");
  group.dataset.name = `${base.dataset.name || "Shape"} Extruded`;
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

const appendAnimation = () => {
  if (!state.selected) return;
  const type = byId("animType").value;
  const from = byId("animFrom").value.trim();
  const to = byId("animTo").value.trim();
  const dur = Number(byId("animDur").value || 2);
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
  anim.setAttribute("repeatCount", "indefinite");
  anim.setAttribute("calcMode", "spline");

  const splines = {
    linear: "0 0 1 1",
    "ease-in": "0.42 0 1 1",
    "ease-out": "0 0 0.58 1",
    "ease-in-out": "0.42 0 0.58 1"
  };
  anim.setAttribute("keyTimes", "0;1");
  anim.setAttribute("keySplines", splines[ease]);

  state.selected.appendChild(anim);
  rebuildAnimList();
  saveHistory();
};

byId("addAnimBtn").addEventListener("click", appendAnimation);

byId("applyTemplateBtn").addEventListener("click", () => {
  const template = animationTemplates[byId("animTemplate").value];
  if (!template) return;
  byId("animType").value = template.type;
  byId("animFrom").value = template.from;
  byId("animTo").value = template.to;
  byId("animDur").value = String(template.dur);
  byId("animEase").value = template.ease;
  appendAnimation();
  statusEl.textContent = `Template applied: ${byId("animTemplate").value}`;
});

byId("playBtn").addEventListener("click", () => {
  stage.unpauseAnimations();
  statusEl.textContent = "Animations playing";
});

byId("pauseBtn").addEventListener("click", () => {
  stage.pauseAnimations();
  statusEl.textContent = "Animations paused";
});

byId("clearAnimBtn").addEventListener("click", () => {
  if (!state.selected) return;
  state.selected.querySelectorAll("animate, animateTransform").forEach((el) => el.remove());
  rebuildAnimList();
  saveHistory();
});

byId("previewBtn").addEventListener("click", () => {
  stage.setCurrentTime(0);
  stage.unpauseAnimations();
  statusEl.textContent = "Animation restarted";
});

byId("duplicateBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const clone = state.selected.cloneNode(true);
  clone.dataset.name = `Shape ${++state.shapeCount}`;
  const existing = clone.getAttribute("transform") || "";
  clone.setAttribute("transform", `${existing} translate(20,20)`.trim());
  stage.appendChild(clone);
  selectElement(clone);
  saveHistory();
});

byId("deleteBtn").addEventListener("click", () => {
  if (!state.selected) return;
  state.selected.remove();
  selectElement(null);
  rebuildAnimList();
  saveHistory();
});

byId("layerUpBtn").addEventListener("click", () => {
  if (!state.selected || !state.selected.nextElementSibling) return;
  stage.insertBefore(state.selected, state.selected.nextElementSibling.nextElementSibling);
  refreshLayers();
  saveHistory();
});

byId("layerDownBtn").addEventListener("click", () => {
  if (!state.selected || !state.selected.previousElementSibling) return;
  stage.insertBefore(state.selected, state.selected.previousElementSibling);
  refreshLayers();
  saveHistory();
});

byId("svgImport").addEventListener("change", async (evt) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  const importedSvg = parsed.querySelector("svg");
  if (!importedSvg) {
    statusEl.textContent = "Invalid SVG file";
    return;
  }

  importedSvg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  [...importedSvg.children].forEach((child) => {
    const clone = document.importNode(child, true);
    if (!clone.dataset.name) clone.dataset.name = `Shape ${++state.shapeCount}`;
    stage.appendChild(clone);
  });

  evt.target.value = "";
  refreshLayers();
  rebuildAnimList();
  saveHistory();
  statusEl.textContent = "SVG imported";
});

byId("undoBtn").addEventListener("click", undo);
byId("redoBtn").addEventListener("click", redo);

window.addEventListener("keydown", (evt) => {
  if (evt.key === "Delete" && state.selected) {
    byId("deleteBtn").click();
  }
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "z") {
    evt.preventDefault();
    if (evt.shiftKey) redo();
    else undo();
  }
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "d") {
    evt.preventDefault();
    byId("duplicateBtn").click();
  }
});

byId("clearBtn").addEventListener("click", () => {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  byId("animList").innerHTML = "";
  refreshLayers();
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

setViewBox();
updateZoomRange();
refreshLayers();
saveHistory();
