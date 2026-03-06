const SVG_NS = "http://www.w3.org/2000/svg";
const INITIAL_VIEWBOX = { x: 0, y: 0, width: 1200, height: 760 };
const MAX_HISTORY = 80;

const stage = document.getElementById("stage");
const statusEl = document.getElementById("status");
const byId = (id) => document.getElementById(id);
const topLevelShapes = () => [...stage.children].filter((el) => !el.matches("defs"));

const state = {
  tool: "select",
  selected: null,
  drawing: null,
  start: null,
  dragging: false,
  panning: false,
  pathPoints: [],
  dragOrigin: null,
  itemOrigin: null,
  viewBox: { ...INITIAL_VIEWBOX },
  zoomPercent: 100,
  shapeCount: 0,
  history: [],
  historyIndex: -1,
  timeline: []
};

const animationTemplates = {
  "slide-right": { type: "translate", from: "0 0", to: "140 0", dur: 1.2, ease: "ease-in-out" },
  bounce: { type: "translate", from: "0 0", to: "0 -60", dur: 0.8, ease: "overshoot" },
  spin: { type: "rotate", from: "0 600 380", to: "360 600 380", dur: 2, ease: "linear" },
  pulse: { type: "scale", from: "1 1", to: "1.4 1.4", dur: 0.9, ease: "ease-in-out" },
  "fade-in-out": { type: "opacity", from: "0.1", to: "1", dur: 1, ease: "ease-in-out" },
  "wiggle-x": { type: "translate", from: "-20 0", to: "20 0", dur: 0.3, ease: "back" },
  "hinge-rotate": { type: "rotate", from: "-15 200 200", to: "15 200 200", dur: 0.7, ease: "ease-in-out" },
  "pop-in": { type: "scale", from: "0.4 0.4", to: "1 1", dur: 0.5, ease: "overshoot" }
};

const featureMatrix = [
  "Vector shape tools", "Bezier polyline path", "Text layers", "Layer panel", "Layer re-order", "Selection tool", "Canvas panning", "Zoom slider", "Snap-to-grid", "SVG import",
  "SVG export", "JSON project export", "Undo stack", "Redo stack", "Duplicate", "Delete", "Grouping", "Ungrouping", "Rectangle primitive", "Circle primitive",
  "Ellipse primitive", "Line primitive", "Polygon primitive", "Star primitive", "Fill color", "Stroke color", "Stroke width", "Animation templates", "Animation easing", "Delay + loop controls",
  "Play/Pause timeline", "Restart preview", "Animation list", "Clear animations", "Stagger animation pass", "Auto gradient FX", "Drop shadow FX", "Glow FX", "Gaussian blur FX", "Align left",
  "Align center", "Distribute spacing", "Normalize object sizes", "Scene preset: Hero", "Scene preset: Loader", "Scene preset: Floating icons", "Motion style presets", "Timeline metadata", "View reset", "After-effects inspired workflow"
];

const splines = {
  linear: "0 0 1 1",
  "ease-in": "0.42 0 1 1",
  "ease-out": "0 0 0.58 1",
  "ease-in-out": "0.42 0 0.58 1",
  back: "0.68 -0.6 0.32 1.6",
  overshoot: "0.34 1.56 0.64 1"
};

const setViewBox = () => {
  stage.setAttribute("viewBox", `${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.width} ${state.viewBox.height}`);
};

const updateZoomRange = () => {
  byId("zoomRange").value = String(Math.round(state.zoomPercent));
};

const getStyles = () => ({
  fill: byId("fillColor").value,
  stroke: byId("strokeColor").value,
  strokeWidth: byId("strokeWidth").value
});

const applyStyles = (el) => {
  const styles = getStyles();
  if (el.tagName !== "text") el.setAttribute("fill", styles.fill);
  el.setAttribute("stroke", styles.stroke);
  el.setAttribute("stroke-width", styles.strokeWidth);
};

const saveHistory = () => {
  const snapshot = {
    content: stage.innerHTML,
    viewBox: { ...state.viewBox },
    shapeCount: state.shapeCount,
    timeline: JSON.stringify(state.timeline)
  };
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.historyIndex = state.history.length - 1;
};

const selectElement = (el) => {
  if (state.selected) state.selected.classList.remove("selected");
  state.selected = el;
  if (el) el.classList.add("selected");
  refreshLayers();
};

const refreshLayers = () => {
  const layers = byId("layersList");
  layers.innerHTML = "";
  topLevelShapes().slice().reverse().forEach((el) => {
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
      item.textContent = `${shape.dataset.name || shape.tagName}: ${anim.getAttribute("attributeName")} ${anim.getAttribute("from") || ""} → ${anim.getAttribute("to") || ""}`;
      list.appendChild(item);
    });
  });
};

const applyHistory = (snapshot) => {
  stage.innerHTML = snapshot.content;
  state.viewBox = { ...snapshot.viewBox };
  state.shapeCount = snapshot.shapeCount;
  state.timeline = JSON.parse(snapshot.timeline || "[]");
  setViewBox();
  selectElement(null);
  refreshLayers();
  rebuildAnimList();
};

const undo = () => {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  applyHistory(state.history[state.historyIndex]);
};

const redo = () => {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  applyHistory(state.history[state.historyIndex]);
};

const stagePoint = (evt) => {
  const pt = stage.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(stage.getScreenCTM().inverse());
};

const snapPoint = (point) => {
  if (!byId("snapToggle").checked) return point;
  const size = Math.max(4, Number(byId("gridSize").value || 24));
  return { x: Math.round(point.x / size) * size, y: Math.round(point.y / size) * size };
};

const regularPolygonPoints = (cx, cy, sides, radius) => {
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const a = (-Math.PI / 2) + ((Math.PI * 2 * i) / sides);
    points.push(`${cx + Math.cos(a) * radius},${cy + Math.sin(a) * radius}`);
  }
  return points.join(" ");
};

const starPoints = (cx, cy, spikes, outer, inner) => {
  const points = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (-Math.PI / 2) + (Math.PI * i) / spikes;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
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
  if (tool === "ellipse") {
    el = document.createElementNS(SVG_NS, "ellipse");
    el.setAttribute("cx", x);
    el.setAttribute("cy", y);
    el.setAttribute("rx", 1);
    el.setAttribute("ry", 1);
  }
  if (tool === "line") {
    el = document.createElementNS(SVG_NS, "line");
    el.setAttribute("x1", x);
    el.setAttribute("y1", y);
    el.setAttribute("x2", x + 1);
    el.setAttribute("y2", y + 1);
  }
  if (tool === "polygon") {
    el = document.createElementNS(SVG_NS, "polygon");
    el.setAttribute("points", regularPolygonPoints(x, y, 6, 1));
  }
  if (tool === "star") {
    el = document.createElementNS(SVG_NS, "polygon");
    el.setAttribute("points", starPoints(x, y, 5, 1, 0.5));
  }
  if (tool === "text") {
    el = document.createElementNS(SVG_NS, "text");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("font-size", "42");
    el.textContent = byId("textValue").value || "Anemate";
  }
  if (tool === "path") {
    el = document.createElementNS(SVG_NS, "polyline");
    el.setAttribute("fill", "none");
    el.setAttribute("points", `${x},${y}`);
    state.pathPoints = [[x, y]];
  }
  if (!el) return null;
  el.dataset.name = `Layer ${++state.shapeCount}`;
  applyStyles(el);
  stage.appendChild(el);
  return el;
};

const updateDrawing = (tool, p) => {
  if (!state.drawing || !state.start) return;
  const dx = p.x - state.start.x;
  const dy = p.y - state.start.y;

  if (tool === "rect") {
    state.drawing.setAttribute("x", Math.min(state.start.x, p.x));
    state.drawing.setAttribute("y", Math.min(state.start.y, p.y));
    state.drawing.setAttribute("width", Math.abs(dx));
    state.drawing.setAttribute("height", Math.abs(dy));
  }
  if (tool === "circle") {
    state.drawing.setAttribute("r", Math.max(Math.abs(dx), Math.abs(dy)));
  }
  if (tool === "ellipse") {
    state.drawing.setAttribute("rx", Math.abs(dx));
    state.drawing.setAttribute("ry", Math.abs(dy));
  }
  if (tool === "line") {
    state.drawing.setAttribute("x2", p.x);
    state.drawing.setAttribute("y2", p.y);
  }
  if (tool === "polygon") {
    state.drawing.setAttribute("points", regularPolygonPoints(state.start.x, state.start.y, 6, Math.max(1, Math.hypot(dx, dy))));
  }
  if (tool === "star") {
    const radius = Math.max(1, Math.hypot(dx, dy));
    state.drawing.setAttribute("points", starPoints(state.start.x, state.start.y, 5, radius, radius / 2));
  }
  if (tool === "path") {
    state.pathPoints.push([p.x, p.y]);
    state.drawing.setAttribute("points", state.pathPoints.map((a) => a.join(",")).join(" "));
  }
};

stage.addEventListener("mousedown", (evt) => {
  const raw = stagePoint(evt);
  const p = snapPoint(raw);
  state.start = p;

  if (state.tool === "pan") {
    state.panning = true;
    state.dragOrigin = raw;
    state.itemOrigin = { x: state.viewBox.x, y: state.viewBox.y };
    return;
  }

  if (state.tool === "select") {
    const target = evt.target !== stage ? evt.target.closest("g,rect,circle,ellipse,line,polyline,path,polygon,text") : null;
    selectElement(target);
    if (target) {
      state.dragging = true;
      state.dragOrigin = p;
      state.itemOrigin = target.getAttribute("transform") || "translate(0 0)";
    }
    return;
  }

  state.drawing = createShape(state.tool, p.x, p.y);
  selectElement(state.drawing);
  refreshLayers();
});

stage.addEventListener("mousemove", (evt) => {
  const raw = stagePoint(evt);
  const p = snapPoint(raw);

  if (state.panning) {
    const dx = raw.x - state.dragOrigin.x;
    const dy = raw.y - state.dragOrigin.y;
    state.viewBox.x = state.itemOrigin.x - dx;
    state.viewBox.y = state.itemOrigin.y - dy;
    setViewBox();
    return;
  }

  if (state.dragging && state.selected) {
    const dx = p.x - state.dragOrigin.x;
    const dy = p.y - state.dragOrigin.y;
    state.selected.setAttribute("transform", `translate(${dx} ${dy})`);
    return;
  }

  updateDrawing(state.tool, p);
});

window.addEventListener("mouseup", () => {
  if (state.dragging || state.drawing || state.panning) saveHistory();
  state.dragging = false;
  state.drawing = null;
  state.panning = false;
  state.pathPoints = [];
});

const appendAnimation = (target = state.selected, delayOffset = 0) => {
  if (!target) return;
  const type = byId("animType").value;
  const from = byId("animFrom").value.trim();
  const to = byId("animTo").value.trim();
  const dur = Number(byId("animDur").value || 1);
  const delay = Number(byId("animDelay").value || 0) + delayOffset;
  const loop = byId("animLoop").value;
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
  anim.setAttribute("repeatCount", loop);
  anim.setAttribute("calcMode", "spline");
  anim.setAttribute("keyTimes", "0;1");
  anim.setAttribute("keySplines", splines[ease] || splines.linear);
  target.appendChild(anim);

  state.timeline.push({
    layer: target.dataset.name,
    type,
    from,
    to,
    dur,
    delay,
    loop,
    ease
  });
  rebuildAnimList();
  saveHistory();
};

const ensureDefs = () => {
  let defs = stage.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(SVG_NS, "defs");
    stage.prepend(defs);
  }
  return defs;
};

const applyGradient = () => {
  if (!state.selected) return;
  const defs = ensureDefs();
  const id = `grad-${Date.now()}`;
  const g = document.createElementNS(SVG_NS, "linearGradient");
  g.id = id;
  g.innerHTML = `<stop offset="0%" stop-color="#68d5ff"/><stop offset="100%" stop-color="#8f63ff"/>`;
  defs.appendChild(g);
  state.selected.setAttribute("fill", `url(#${id})`);
  saveHistory();
};

const applyFilter = (kind) => {
  if (!state.selected) return;
  const defs = ensureDefs();
  const id = `${kind}-${Date.now()}`;
  const f = document.createElementNS(SVG_NS, "filter");
  f.id = id;
  if (kind === "shadow") f.innerHTML = '<feDropShadow dx="8" dy="8" stdDeviation="5" flood-color="#000" flood-opacity="0.6"/>';
  if (kind === "glow") f.innerHTML = '<feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>';
  if (kind === "blur") f.innerHTML = '<feGaussianBlur stdDeviation="3"/>';
  defs.appendChild(f);
  state.selected.setAttribute("filter", `url(#${id})`);
  saveHistory();
};

const selectedShapes = () => (state.selected ? [state.selected] : topLevelShapes());
const bboxX = (el) => Number(el.getBBox().x);

byId("alignLeftBtn").addEventListener("click", () => {
  const shapes = selectedShapes();
  if (!shapes.length) return;
  const left = Math.min(...shapes.map((s) => s.getBBox().x));
  shapes.forEach((s) => {
    const dx = left - s.getBBox().x;
    s.setAttribute("transform", `translate(${dx} 0)`);
  });
  saveHistory();
});

byId("alignCenterBtn").addEventListener("click", () => {
  const shapes = selectedShapes();
  if (!shapes.length) return;
  const center = INITIAL_VIEWBOX.width / 2;
  shapes.forEach((s) => {
    const box = s.getBBox();
    const dx = center - (box.x + box.width / 2);
    s.setAttribute("transform", `translate(${dx} 0)`);
  });
  saveHistory();
});

byId("spaceXBtn").addEventListener("click", () => {
  const shapes = topLevelShapes();
  if (shapes.length < 3) return;
  const sorted = shapes.slice().sort((a, b) => bboxX(a) - bboxX(b));
  const first = sorted[0].getBBox();
  const last = sorted[sorted.length - 1].getBBox();
  const gap = (last.x - first.x) / (sorted.length - 1);
  sorted.forEach((s, i) => s.setAttribute("transform", `translate(${first.x + gap * i - s.getBBox().x} 0)`));
  saveHistory();
});

byId("normalizeBtn").addEventListener("click", () => {
  topLevelShapes().forEach((s) => {
    if (s.tagName === "rect") {
      s.setAttribute("width", 140);
      s.setAttribute("height", 140);
    }
    if (s.tagName === "circle") s.setAttribute("r", 70);
    if (s.tagName === "ellipse") {
      s.setAttribute("rx", 95);
      s.setAttribute("ry", 55);
    }
  });
  saveHistory();
});

const buildScene = (type) => {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  if (type === "hero") {
    [220, 500, 820].forEach((x, i) => {
      const r = createShape("rect", x, 220);
      r.setAttribute("width", 160);
      r.setAttribute("height", 160);
      r.setAttribute("rx", 20);
      appendAnimation(r, i * 0.2);
    });
  }
  if (type === "loader") {
    for (let i = 0; i < 8; i += 1) {
      const c = createShape("circle", 600 + Math.cos((Math.PI * 2 * i) / 8) * 170, 380 + Math.sin((Math.PI * 2 * i) / 8) * 170);
      c.setAttribute("r", 24);
      byId("animType").value = "opacity";
      byId("animFrom").value = "0.1";
      byId("animTo").value = "1";
      byId("animDur").value = "0.9";
      appendAnimation(c, i * 0.08);
    }
  }
  if (type === "floating-icons") {
    for (let i = 0; i < 10; i += 1) {
      const s = i % 2 === 0 ? createShape("star", 100 + i * 100, 120 + (i % 3) * 180) : createShape("polygon", 100 + i * 100, 120 + (i % 3) * 180);
      byId("animType").value = "translate";
      byId("animFrom").value = "0 0";
      byId("animTo").value = "0 -50";
      byId("animDur").value = "1.6";
      appendAnimation(s, i * 0.15);
    }
  }
  refreshLayers();
  rebuildAnimList();
  saveHistory();
};

byId("groupBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const g = document.createElementNS(SVG_NS, "g");
  g.dataset.name = `Group ${++state.shapeCount}`;
  stage.replaceChild(g, state.selected);
  g.appendChild(state.selected);
  selectElement(g);
  saveHistory();
});

byId("ungroupBtn").addEventListener("click", () => {
  if (!state.selected || state.selected.tagName !== "g") return;
  const g = state.selected;
  [...g.children].forEach((child) => stage.insertBefore(child, g));
  g.remove();
  selectElement(null);
  refreshLayers();
  saveHistory();
});

byId("addAnimBtn").addEventListener("click", () => appendAnimation());
byId("clearAnimBtn").addEventListener("click", () => {
  if (!state.selected) return;
  state.selected.querySelectorAll("animate, animateTransform").forEach((n) => n.remove());
  rebuildAnimList();
  saveHistory();
});

byId("staggerBtn").addEventListener("click", () => {
  topLevelShapes().forEach((shape, i) => appendAnimation(shape, i * 0.1));
});

byId("applyTemplateBtn").addEventListener("click", () => {
  const tpl = animationTemplates[byId("animTemplate").value];
  if (!tpl) return;
  byId("animType").value = tpl.type;
  byId("animFrom").value = tpl.from;
  byId("animTo").value = tpl.to;
  byId("animDur").value = String(tpl.dur);
  byId("animEase").value = tpl.ease;
  appendAnimation();
});

byId("playBtn").addEventListener("click", () => stage.unpauseAnimations());
byId("pauseBtn").addEventListener("click", () => stage.pauseAnimations());
byId("previewBtn").addEventListener("click", () => {
  stage.setCurrentTime(0);
  stage.unpauseAnimations();
});

byId("duplicateBtn").addEventListener("click", () => {
  if (!state.selected) return;
  const clone = state.selected.cloneNode(true);
  clone.dataset.name = `Layer ${++state.shapeCount}`;
  clone.setAttribute("transform", "translate(20 20)");
  stage.appendChild(clone);
  selectElement(clone);
  refreshLayers();
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

byId("gradientBtn").addEventListener("click", applyGradient);
byId("shadowBtn").addEventListener("click", () => applyFilter("shadow"));
byId("glowBtn").addEventListener("click", () => applyFilter("glow"));
byId("blurBtn").addEventListener("click", () => applyFilter("blur"));
byId("sceneBtn").addEventListener("click", () => buildScene(byId("scenePreset").value));

byId("svgImport").addEventListener("change", async (evt) => {
  const file = evt.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  const importedSvg = parsed.querySelector("svg");
  if (!importedSvg) return;
  importedSvg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  [...importedSvg.children].forEach((child) => {
    const clone = document.importNode(child, true);
    clone.dataset.name = clone.dataset.name || `Layer ${++state.shapeCount}`;
    stage.appendChild(clone);
  });
  refreshLayers();
  rebuildAnimList();
  saveHistory();
});

byId("undoBtn").addEventListener("click", undo);
byId("redoBtn").addEventListener("click", redo);

byId("zoomRange").addEventListener("input", (evt) => {
  state.zoomPercent = Number(evt.target.value);
  const factor = 100 / state.zoomPercent;
  state.viewBox.width = INITIAL_VIEWBOX.width * factor;
  state.viewBox.height = INITIAL_VIEWBOX.height * factor;
  setViewBox();
});

byId("resetViewBtn").addEventListener("click", () => {
  state.viewBox = { ...INITIAL_VIEWBOX };
  state.zoomPercent = 100;
  setViewBox();
  updateZoomRange();
});

byId("clearBtn").addEventListener("click", () => {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  rebuildAnimList();
  saveHistory();
});

byId("exportBtn").addEventListener("click", () => {
  const source = new XMLSerializer().serializeToString(stage);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "anemate-engine.svg";
  a.click();
});

byId("exportJsonBtn").addEventListener("click", () => {
  const payload = {
    viewBox: state.viewBox,
    timeline: state.timeline,
    svg: new XMLSerializer().serializeToString(stage)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "anemate-project.json";
  a.click();
});

window.addEventListener("keydown", (evt) => {
  if (evt.key === "Delete") byId("deleteBtn").click();
  if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "z") {
    evt.preventDefault();
    if (evt.shiftKey) redo();
    else undo();
  }
});

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
tools.forEach((tool) => {
  tool.addEventListener("click", () => {
    tools.forEach((b) => b.classList.remove("is-active"));
    tool.classList.add("is-active");
    state.tool = tool.dataset.tool;
    statusEl.textContent = `Tool: ${state.tool}`;
  });
});

Object.keys(animationTemplates).forEach((k) => {
  const option = document.createElement("option");
  option.value = k;
  option.textContent = k;
  byId("animTemplate").appendChild(option);
});

featureMatrix.forEach((name) => {
  const li = document.createElement("li");
  li.textContent = name;
  byId("featureList").appendChild(li);
});

setViewBox();
updateZoomRange();
refreshLayers();
saveHistory();
