const SVG_NS = "http://www.w3.org/2000/svg";
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
  shapeCount: 0
};

const byId = (id) => document.getElementById(id);
const getStyles = () => ({
  fill: byId("fillColor").value,
  stroke: byId("strokeColor").value,
  strokeWidth: byId("strokeWidth").value
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

stage.addEventListener("mousedown", (evt) => {
  const p = pointOnStage(evt);
  state.start = p;

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
  const p = pointOnStage(evt);

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
  state.drawing = null;
  state.start = null;
  state.dragging = false;
  state.dragOrigin = null;
  state.itemOrigin = null;
});

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
  statusEl.textContent = "Extruded into layered group";
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

  const li = document.createElement("li");
  li.textContent = `${state.selected.dataset.name || state.selected.tagName}: ${type} ${from} → ${to} (${dur}s)`;
  byId("animList").appendChild(li);
};

byId("addAnimBtn").addEventListener("click", appendAnimation);
byId("previewBtn").addEventListener("click", () => {
  const clone = stage.cloneNode(true);
  stage.replaceWith(clone);
  clone.setAttribute("id", "stage");
  statusEl.textContent = "Animation restarted";
  window.location.reload();
});

byId("clearBtn").addEventListener("click", () => {
  while (stage.firstChild) stage.removeChild(stage.firstChild);
  selectElement(null);
  byId("animList").innerHTML = "";
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
