const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const root = document.documentElement;
const body = document.body;
const menuToggle = $(".menu-toggle");
const mobileMenu = $("#mobile-menu");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function setMenu(open) {
  body.classList.toggle("menu-open", open);
  menuToggle?.setAttribute("aria-expanded", String(open));
  mobileMenu?.setAttribute("aria-hidden", String(!open));
}

menuToggle?.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
$$(".mobile-menu a, .desktop-nav a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
window.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });

function setupReveals() {
  const items = $$(".reveal");
  if (!("IntersectionObserver" in window) || reduceMotion.matches) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
  items.forEach((item) => observer.observe(item));
}

const projects = {
  aether: {
    index: "Case 01 / 06",
    title: "Aether OS",
    category: "spatial",
    description: "An operating layer for spatial computing. We built the identity, motion language and real-time interface system around the idea that software should feel like a place rather than a page.",
    discipline: "Spatial identity / Interface",
    year: "2026",
    scope: "Strategy, identity, WebGL, motion system",
  },
  kinetic: {
    index: "Case 02 / 06",
    title: "Kinetic Field",
    category: "webgl",
    description: "A living brand world where every surface responds to sound, pointer and time. The system translates a music archive into a field of particles that users can conduct.",
    discipline: "Brand world / WebGL",
    year: "2025",
    scope: "Creative direction, identity, real-time 3D",
  },
  matter: {
    index: "Case 03 / 06",
    title: "Matter / Mind",
    category: "identity",
    description: "A museum exhibition and digital twin that let audiences move through objects too fragile to display. The experience pairs archival material with an explorable scan field.",
    discipline: "Exhibition / Digital twin",
    year: "2025",
    scope: "Exhibition design, 3D capture, interface",
  },
  soluble: {
    index: "Case 04 / 06",
    title: "Soluble City",
    category: "spatial",
    description: "A city-scale identity that dissolves and reforms as people move through it. Wayfinding, film and an open spatial model share one generative visual grammar.",
    discipline: "Spatial identity / Film",
    year: "2024",
    scope: "Identity, wayfinding, moving image",
  },
  nocturne: {
    index: "Case 05 / 06",
    title: "Nocturne",
    category: "webgl",
    description: "A real-time campaign built around cities after dark. Data from noise, light and motion shapes a sequence that never renders the same state twice.",
    discipline: "Campaign / Real-time",
    year: "2024",
    scope: "Concept, generative system, campaign",
  },
  quiet: {
    index: "Case 06 / 06",
    title: "Quiet Machines",
    category: "identity",
    description: "An identity for a new class of domestic robotics. We designed a calm product language, spatial interface principles and a toolkit for a family of connected objects.",
    discipline: "Product identity / Systems",
    year: "2024",
    scope: "Strategy, identity, product interface",
  },
};

function setupDrawer() {
  const drawer = $("#case-drawer");
  const backdrop = $(".drawer-backdrop");
  const closeButton = $(".drawer-close");
  const title = $("[data-case-title]");
  const description = $("[data-case-description]");
  const index = $("[data-case-index]");
  const discipline = $("[data-case-discipline]");
  const year = $("[data-case-year]");
  const scope = $("[data-case-scope]");
  let lastFocus = null;

  function close() {
    body.classList.remove("drawer-open");
    drawer?.setAttribute("aria-hidden", "true");
    lastFocus?.focus?.();
  }

  function open(key) {
    const project = projects[key];
    if (!project) return;
    lastFocus = document.activeElement;
    title.textContent = project.title;
    description.textContent = project.description;
    index.textContent = project.index;
    discipline.textContent = project.discipline;
    year.textContent = project.year;
    scope.textContent = project.scope;
    drawer.dataset.project = key;
    body.classList.add("drawer-open");
    drawer.setAttribute("aria-hidden", "false");
    closeButton?.focus();
  }

  $$(".archive-card").forEach((card) => {
    const activate = (event) => {
      if (event.target.closest(".card-open") || event.currentTarget === card) open(card.dataset.project);
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(card.dataset.project);
      }
    });
  });

  closeButton?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  drawer?.addEventListener("click", (event) => {
    if (event.target === drawer) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && body.classList.contains("drawer-open")) close();
  });
}

function setupFilters() {
  const buttons = $$(".filter");
  const cards = $$(".archive-card");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      cards.forEach((card) => {
        const visible = filter === "all" || card.dataset.category === filter;
        if (visible) {
          card.hidden = false;
          requestAnimationFrame(() => card.classList.remove("is-filtered"));
        } else {
          card.classList.add("is-filtered");
          window.setTimeout(() => { if (card.classList.contains("is-filtered")) card.hidden = true; }, 260);
        }
      });
    });
  });
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Shader compilation failed");
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || "Program linking failed");
  }
  return program;
}

function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const rangeInv = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = 0;
      for (let index = 0; index < 4; index += 1) sum += a[index * 4 + row] * b[column * 4 + index];
      result[column * 4 + row] = sum;
    }
  }
  return result;
}

function translation(x, y, z) {
  const matrix = identity();
  matrix[12] = x;
  matrix[13] = y;
  matrix[14] = z;
  return matrix;
}

function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const matrix = identity();
  matrix[0] = c;
  matrix[2] = -s;
  matrix[8] = s;
  matrix[10] = c;
  return matrix;
}

function buildMesh() {
  const columns = 68;
  const rows = 48;
  const stepX = 0.31;
  const stepZ = 0.31;
  const originX = -((columns - 1) * stepX) / 2;
  const originZ = -((rows - 1) * stepZ) / 2;
  const lines = [];
  const nodes = [];
  const push = (array, x, z, seed) => array.push(x, z, seed, 0);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const x = originX + column * stepX;
      const z = originZ + row * stepZ;
      const seed = (Math.sin(x * 1.7 + z * 2.1) + 1) * 0.5;
      push(lines, x, z, seed);
      push(lines, x + stepX, z, seed);
    }
  }
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      const x = originX + column * stepX;
      const z = originZ + row * stepZ;
      const seed = (Math.cos(x * 1.3 - z * 1.8) + 1) * 0.5;
      push(lines, x, z, seed);
      push(lines, x, z + stepZ, seed);
    }
  }
  for (let row = 0; row < rows; row += 3) {
    for (let column = 0; column < columns; column += 3) {
      const x = originX + column * stepX;
      const z = originZ + row * stepZ;
      const seed = (Math.sin(x * 2.6 + z * 1.4) + 1) * 0.5;
      push(nodes, x, z, seed);
    }
  }
  return { lines: new Float32Array(lines), nodes: new Float32Array(nodes), lineCount: lines.length / 4, nodeCount: nodes.length / 4 };
}

function initializeWorkScene() {
  const canvas = $("#work-scene");
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  } catch { gl = null; }
  if (!gl) { root.classList.add("no-webgl"); return; }

  const program = createProgram(gl, `
    attribute vec4 aPlane;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uPointMode;
    uniform vec2 uPointer;
    varying vec3 vColor;
    varying float vAlpha;
    mat3 rotationX(float angle) { float c = cos(angle); float s = sin(angle); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    void main() {
      float x = aPlane.x;
      float z = aPlane.y;
      float seed = aPlane.z;
      float wave = sin(x * 0.72 + uTime * 0.54) * 0.24;
      wave += cos(z * 0.63 - uTime * 0.42) * 0.2;
      wave += sin((x + z) * 0.38 + uTime * 0.25) * 0.16;
      float pointerDistance = length(vec2(x, z) - uPointer);
      wave += exp(-pointerDistance * 0.75) * 0.56;
      vec3 position = vec3(x, z, wave);
      position = rotationX(1.04) * position;
      vec4 world = uModel * vec4(position, 1.0);
      vec4 viewPosition = uView * world;
      gl_Position = uProjection * viewPosition;
      gl_PointSize = uPointMode * uPixelRatio * (1.4 + seed * 4.2) * (9.0 / max(-viewPosition.z, 2.0));
      float distanceFade = smoothstep(18.0, 2.0, -viewPosition.z);
      vec3 cyan = vec3(0.35, 0.86, 1.0);
      vec3 acid = vec3(0.78, 1.0, 0.39);
      vec3 coral = vec3(1.0, 0.38, 0.28);
      vColor = mix(cyan, acid, smoothstep(0.03, 0.72, wave));
      vColor = mix(vColor, coral, smoothstep(0.66, 1.0, wave) * 0.42);
      vAlpha = (0.18 + seed * 0.32 + max(wave, 0.0) * 0.22) * distanceFade;
    }
  `, `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() { gl_FragColor = vec4(vColor, vAlpha); }
  `);

  const mesh = buildMesh();
  const lineBuffer = createBuffer(gl, mesh.lines);
  const nodeBuffer = createBuffer(gl, mesh.nodes);
  const uniforms = {
    projection: gl.getUniformLocation(program, "uProjection"),
    view: gl.getUniformLocation(program, "uView"),
    model: gl.getUniformLocation(program, "uModel"),
    time: gl.getUniformLocation(program, "uTime"),
    pixelRatio: gl.getUniformLocation(program, "uPixelRatio"),
    pointMode: gl.getUniformLocation(program, "uPointMode"),
    pointer: gl.getUniformLocation(program, "uPointer"),
  };
  const sceneState = { pointerX: 0, pointerY: 0, targetX: 0, targetY: 0, dragging: false, velocity: 0, rotation: 0 };
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
  }

  function bindBuffer(mode) {
    const buffer = mode === "lines" ? lineBuffer : nodeBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const location = gl.getAttribLocation(program, "aPlane");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  }

  function draw(now) {
    const time = now * 0.001;
    sceneState.pointerX = sceneState.targetX;
    sceneState.pointerY = sceneState.targetY;
    sceneState.velocity *= 0.94;
    sceneState.rotation += sceneState.velocity;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    const projection = perspective((46 * Math.PI) / 180, aspect, 0.1, 65);
    const view = translation(0, -0.9, -10.8);
    const model = multiply(translation(0, -2.05, -3.6), multiply(rotationY(time * 0.018 + sceneState.rotation), identity()));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.uniformMatrix4fv(uniforms.projection, false, projection);
    gl.uniformMatrix4fv(uniforms.view, false, view);
    gl.uniformMatrix4fv(uniforms.model, false, model);
    gl.uniform1f(uniforms.time, reduceMotion.matches ? time * 0.12 : time);
    gl.uniform1f(uniforms.pixelRatio, dpr);
    gl.uniform2f(uniforms.pointer, sceneState.pointerX * 8.5, (sceneState.pointerY - 0.2) * 6.5);
    gl.uniform1f(uniforms.pointMode, 0);
    bindBuffer("lines");
    gl.drawArrays(gl.LINES, 0, mesh.lineCount);
    gl.uniform1f(uniforms.pointMode, 1.15);
    bindBuffer("nodes");
    gl.drawArrays(gl.POINTS, 0, mesh.nodeCount);
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("pointermove", (event) => {
    sceneState.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    sceneState.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(draw);
  });
  raf = requestAnimationFrame((now) => {
    draw(now);
    canvas.classList.add("is-ready");
    root.dataset.workSceneReady = "true";
  });
}

setupReveals();
setupFilters();
setupDrawer();
initializeWorkScene();
