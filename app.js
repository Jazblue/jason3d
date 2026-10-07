const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const root = document.documentElement;
const body = document.body;
const canvas = $("#scene");
const dragHint = $(".drag-hint");
const menuToggle = $(".menu-toggle");
const mobileMenu = $("#mobile-menu");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  time: 0,
  pointerX: 0,
  pointerY: 0,
  targetX: 0,
  targetY: 0,
  cameraX: 0,
  cameraY: 0,
  dragX: 0,
  dragY: 0,
  dragVelocityX: 0,
  dragVelocityY: 0,
  dragging: false,
  lastPointerX: 0,
  lastPointerY: 0,
  hasInteracted: false,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;

function onPointerMove(event) {
  state.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
  state.pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  if (!state.hasInteracted) {
    state.hasInteracted = true;
    dragHint?.classList.add("is-hidden");
  }
  if (state.dragging) {
    state.dragVelocityX += (event.clientX - state.lastPointerX) * 0.00023;
    state.dragVelocityY += (event.clientY - state.lastPointerY) * 0.00016;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
  }
}

function onPointerDown(event) {
  state.dragging = true;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  canvas?.classList.add("is-dragging");
  canvas?.setPointerCapture?.(event.pointerId);
  dragHint?.classList.add("is-hidden");
}

function onPointerUp(event) {
  state.dragging = false;
  canvas?.classList.remove("is-dragging");
  if (canvas?.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

window.addEventListener("pointermove", onPointerMove, { passive: true });
canvas?.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointerup", onPointerUp, { passive: true });
window.addEventListener("pointercancel", onPointerUp, { passive: true });

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
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  items.forEach((item) => observer.observe(item));
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error || "Shader compilation failed");
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error || "Program linking failed");
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

function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const matrix = identity();
  matrix[5] = c;
  matrix[6] = s;
  matrix[9] = -s;
  matrix[10] = c;
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

function buildParticles(count) {
  const data = new Float32Array(count * 8);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 8;
    const radius = 2.4 + Math.pow(Math.random(), 0.62) * 9.8;
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.045 + Math.random() * 0.12) * (Math.random() > 0.88 ? -1 : 1);
    const height = (Math.random() - 0.5) * (0.45 + radius * 0.17);
    const seed = Math.random();
    const size = 0.55 + Math.pow(Math.random(), 4) * 3.8;
    const warmth = Math.random();
    const drift = Math.random();
    data.set([radius, angle, speed, height, seed, size, warmth, drift], offset);
  }
  return data;
}

function buildCore() {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  });
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const positions = [];
  const normals = [];
  const barycentrics = [];
  const bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  faces.forEach(([a, b, c]) => {
    const p0 = raw[a];
    const p1 = raw[b];
    const p2 = raw[c];
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;
    [p0, p1, p2].forEach((position, index) => {
      positions.push(...position);
      normals.push(nx, ny, nz);
      barycentrics.push(...bary[index]);
    });
  });
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    barycentrics: new Float32Array(barycentrics),
    vertexCount: positions.length / 3,
  };
}

function buildRings() {
  return [3.05, 4.55, 6.45].map((radius, ringIndex) => {
    const segments = 220;
    const data = new Float32Array(segments * 4);
    for (let index = 0; index < segments; index += 1) {
      data[index * 4] = radius;
      data[index * 4 + 1] = (index / segments) * Math.PI * 2;
      data[index * 4 + 2] = 0.04 + ringIndex * 0.012;
      data[index * 4 + 3] = ringIndex;
    }
    return { data, vertexCount: segments };
  });
}

function initializeScene() {
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, depth: true, premultipliedAlpha: false, powerPreference: "high-performance" });
  } catch { gl = null; }
  if (!gl) { root.classList.add("no-webgl"); return null; }

  const particleProgram = createProgram(gl, `
    attribute vec4 aOrbit;
    attribute vec4 aStyle;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uPointerStrength;
    varying vec3 vColor;
    varying float vAlpha;
    mat3 rotationY(float angle) { float c = cos(angle); float s = sin(angle); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 rotationX(float angle) { float c = cos(angle); float s = sin(angle); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    void main() {
      float radius = aOrbit.x;
      float angle = aOrbit.y + uTime * aOrbit.z;
      float height = aOrbit.w;
      float seed = aStyle.x;
      float size = aStyle.y;
      float warmth = aStyle.z;
      angle += sin(uTime * 0.22 + seed * 8.0) * 0.12;
      height += sin(uTime * 0.48 + seed * 15.0) * (0.13 + radius * 0.016);
      height += (uPointerStrength - 0.5) * radius * 0.03;
      vec3 position = vec3(cos(angle) * radius, height, sin(angle) * radius);
      position = rotationY(uTime * 0.03) * position;
      position = rotationX(sin(uTime * 0.08) * 0.08) * position;
      vec4 world = uModel * vec4(position, 1.0);
      vec4 viewPosition = uView * world;
      gl_Position = uProjection * viewPosition;
      float depthFade = smoothstep(-13.0, 3.0, viewPosition.z);
      gl_PointSize = clamp(size * uPixelRatio * (12.0 / max(-viewPosition.z, 2.0)), 0.55, 7.5);
      vec3 cold = vec3(0.18, 0.68, 1.0);
      vec3 cyan = vec3(0.51, 0.92, 1.0);
      vec3 acid = vec3(0.78, 1.0, 0.39);
      vec3 coral = vec3(1.0, 0.36, 0.28);
      vec3 color = mix(cold, cyan, smoothstep(2.5, 9.0, radius));
      color = mix(color, acid, smoothstep(0.62, 0.91, warmth) * 0.78);
      color = mix(color, coral, smoothstep(0.9, 1.0, warmth) * 0.45);
      color += vec3(0.08, 0.16, 0.22) * (0.5 + 0.5 * sin(uTime * 0.7 + seed * 12.0));
      vColor = color;
      vAlpha = (0.14 + seed * 0.55) * depthFade;
    }
  `, `
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 point = gl_PointCoord - 0.5;
      float distanceToCenter = length(point);
      float core = smoothstep(0.48, 0.02, distanceToCenter);
      float glow = exp(-distanceToCenter * 7.0) * 0.38;
      float alpha = (core * 0.7 + glow) * vAlpha;
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(vColor * (0.85 + core * 0.7), alpha);
    }
  `);

  const coreProgram = createProgram(gl, `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aBarycentric;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vBarycentric;
    void main() {
      vec4 world = uModel * vec4(aPosition * 1.55, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(uModel) * aNormal);
      vBarycentric = aBarycentric;
      gl_Position = uProjection * uView * world;
    }
  `, `
    precision mediump float;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vBarycentric;
    uniform vec3 uCameraPosition;
    uniform float uTime;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDirection = normalize(uCameraPosition - vWorld);
      float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.15);
      float light = max(dot(normal, normalize(vec3(-0.45, 0.75, 0.65))), 0.0);
      float fill = max(dot(normal, normalize(vec3(0.6, -0.2, 0.35))), 0.0);
      float iridescence = 0.5 + 0.5 * sin(normal.x * 5.4 + normal.y * 3.1 + uTime * 0.24);
      vec3 base = mix(vec3(0.015, 0.04, 0.07), vec3(0.08, 0.17, 0.23), light);
      vec3 spectral = mix(vec3(0.18, 0.7, 1.0), vec3(0.78, 1.0, 0.36), iridescence);
      spectral = mix(spectral, vec3(1.0, 0.28, 0.22), smoothstep(0.68, 1.0, iridescence) * 0.28);
      vec3 color = base + spectral * (0.24 + fresnel * 1.08) + vec3(0.32, 0.6, 0.7) * fill * 0.22;
      float edgeX = smoothstep(0.0, 0.065, vBarycentric.x);
      float edgeY = smoothstep(0.0, 0.065, vBarycentric.y);
      float edgeZ = smoothstep(0.0, 0.065, vBarycentric.z);
      float edge = 1.0 - min(min(edgeX, edgeY), edgeZ);
      vec3 edgeColor = mix(vec3(0.32, 0.9, 1.0), vec3(0.78, 1.0, 0.39), iridescence);
      color += edgeColor * edge * (0.5 + fresnel * 0.9);
      float alpha = 0.42 + fresnel * 0.48 + edge * 0.32;
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.94));
    }
  `);

  const ringProgram = createProgram(gl, `
    attribute vec4 aRing;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform float uTime;
    varying float vBrightness;
    mat3 rotationX(float angle) { float c = cos(angle); float s = sin(angle); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
    mat3 rotationZ(float angle) { float c = cos(angle); float s = sin(angle); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
    void main() {
      float radius = aRing.x;
      float angle = aRing.y + uTime * (0.08 + aRing.w * 0.018);
      float ring = aRing.w;
      float wobble = sin(angle * (2.0 + ring) + uTime * 0.28) * (0.18 + ring * 0.12);
      vec3 position = vec3(cos(angle) * radius, wobble, sin(angle) * radius);
      position = rotationX(-0.75 + ring * 0.48) * position;
      position = rotationZ(0.22 + ring * 0.72) * position;
      vec4 world = uModel * vec4(position, 1.0);
      gl_Position = uProjection * uView * world;
      vBrightness = (0.55 + 0.45 * sin(angle * 3.0 + uTime * 1.1 + ring)) * (1.0 - ring * 0.18);
    }
  `, `
    precision mediump float;
    varying float vBrightness;
    uniform float uRing;
    void main() {
      vec3 color = mix(vec3(0.38, 0.86, 1.0), vec3(0.78, 1.0, 0.39), clamp(uRing * 0.38, 0.0, 1.0));
      gl_FragColor = vec4(color, (0.055 + vBrightness * 0.13) * (1.0 - uRing * 0.2));
    }
  `);

  const particleCount = window.innerWidth < 700 ? 3200 : 7800;
  const particles = buildParticles(particleCount);
  const core = buildCore();
  const rings = buildRings();
  const particleBuffer = createBuffer(gl, particles);
  const corePositionBuffer = createBuffer(gl, core.positions);
  const coreNormalBuffer = createBuffer(gl, core.normals);
  const coreBarycentricBuffer = createBuffer(gl, core.barycentrics);
  const ringBuffers = rings.map((ring) => createBuffer(gl, ring.data));
  const pointerStartTime = performance.now();
  const uniform = (program, name) => gl.getUniformLocation(program, name);
  const particleUniforms = {
    projection: uniform(particleProgram, "uProjection"), view: uniform(particleProgram, "uView"),
    model: uniform(particleProgram, "uModel"), time: uniform(particleProgram, "uTime"),
    pixelRatio: uniform(particleProgram, "uPixelRatio"), pointer: uniform(particleProgram, "uPointerStrength"),
  };
  const coreUniforms = {
    projection: uniform(coreProgram, "uProjection"), view: uniform(coreProgram, "uView"),
    model: uniform(coreProgram, "uModel"), camera: uniform(coreProgram, "uCameraPosition"),
    time: uniform(coreProgram, "uTime"), pixelRatio: uniform(coreProgram, "uPixelRatio"),
  };
  const ringUniforms = {
    projection: uniform(ringProgram, "uProjection"), view: uniform(ringProgram, "uView"),
    model: uniform(ringProgram, "uModel"), time: uniform(ringProgram, "uTime"),
    ring: uniform(ringProgram, "uRing"),
  };

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    const displayWidth = Math.floor(state.width * state.dpr);
    const displayHeight = Math.floor(state.height * state.dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    gl.viewport(0, 0, displayWidth, displayHeight);
  }

  function bindAttribute(program, buffer, name, size) {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  function draw(now) {
    state.time = now * 0.001;
    state.targetX = state.pointerX * 0.32;
    state.targetY = state.pointerY * 0.2;
    state.cameraX = lerp(state.cameraX, state.targetX, 0.035);
    state.cameraY = lerp(state.cameraY, state.targetY, 0.035);
    state.dragVelocityX *= 0.96;
    state.dragVelocityY *= 0.96;
    state.dragX += state.dragVelocityX;
    state.dragY += state.dragVelocityY;
    const time = reduceMotion.matches ? state.time * 0.16 : state.time;
    const aspect = state.width / Math.max(state.height, 1);
    const projection = perspective((44 * Math.PI) / 180, aspect, 0.1, 80);
    const view = translation(state.cameraX * -0.35, state.cameraY * -0.3, -11.4);
    const sceneOffset = state.width >= 960 ? 2.35 : 0;
    const model = multiply(translation(sceneOffset, 0, 0), multiply(rotationY(time * 0.035 + state.dragX), rotationX(state.dragY)));

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(particleProgram);
    bindAttribute(particleProgram, particleBuffer, "aOrbit", 4);
    bindAttribute(particleProgram, particleBuffer, "aStyle", 4);
    gl.uniformMatrix4fv(particleUniforms.projection, false, projection);
    gl.uniformMatrix4fv(particleUniforms.view, false, view);
    gl.uniformMatrix4fv(particleUniforms.model, false, model);
    gl.uniform1f(particleUniforms.time, time);
    gl.uniform1f(particleUniforms.pixelRatio, state.dpr);
    gl.uniform1f(particleUniforms.pointer, clamp((now - pointerStartTime) * 0.0002 + state.pointerY * 0.5 + 0.5, 0, 1));
    gl.drawArrays(gl.POINTS, 0, particleCount);

    gl.useProgram(ringProgram);
    gl.uniformMatrix4fv(ringUniforms.projection, false, projection);
    gl.uniformMatrix4fv(ringUniforms.view, false, view);
    gl.uniformMatrix4fv(ringUniforms.model, false, model);
    gl.uniform1f(ringUniforms.time, time);
    rings.forEach((ring, index) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, ringBuffers[index]);
      const location = gl.getAttribLocation(ringProgram, "aRing");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
      gl.uniform1f(ringUniforms.ring, index / rings.length);
      gl.drawArrays(gl.LINE_LOOP, 0, ring.vertexCount);
    });

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(coreProgram);
    bindAttribute(coreProgram, corePositionBuffer, "aPosition", 3);
    bindAttribute(coreProgram, coreNormalBuffer, "aNormal", 3);
    bindAttribute(coreProgram, coreBarycentricBuffer, "aBarycentric", 3);
    gl.uniformMatrix4fv(coreUniforms.projection, false, projection);
    gl.uniformMatrix4fv(coreUniforms.view, false, view);
    gl.uniformMatrix4fv(coreUniforms.model, false, model);
    gl.uniform3f(coreUniforms.camera, state.cameraX * 0.35, state.cameraY * 0.3, 11.4);
    gl.uniform1f(coreUniforms.time, time);
    gl.drawArrays(gl.TRIANGLES, 0, core.vertexCount);

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  try {
    requestAnimationFrame((now) => {
      draw(now);
      canvas.classList.add("is-ready");
      root.dataset.sceneReady = "true";
    });
  } catch (error) {
    console.error("3D scene failed:", error);
    root.classList.add("no-webgl");
  }
  return gl;
}

setupReveals();
initializeScene();
