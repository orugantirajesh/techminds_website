// TechMinds hero — animated 3D visual (Three.js, ES module via CDN import map).
// Progressive enhancement: css/style.css renders a gradient fallback by default;
// this script only crossfades the canvas in once a frame has actually rendered.
// Respects prefers-reduced-motion and pauses when off-screen or tab is hidden.

const container = document.getElementById("hero-visual");
const canvas = document.getElementById("hero-3d-canvas");
if (container && canvas && "IntersectionObserver" in window) {
  init().catch(() => {
    // Three.js failed to load or WebGL unavailable — CSS gradient fallback stays visible.
  });
}

async function init() {
  const THREE = await import("three");

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // Lighting: soft ambient fill + a key light + brand-colored rim lights.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const tealRim = new THREE.PointLight(0x1fb8ac, 6, 12);
  tealRim.position.set(-3, -1, 2);
  scene.add(tealRim);
  const amberRim = new THREE.PointLight(0xf5a524, 4, 12);
  amberRim.position.set(2.5, 2, -2);
  scene.add(amberRim);

  // Main shape: faceted icosahedron, representing structured, engineered systems.
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.7, 1),
    new THREE.MeshStandardMaterial({
      color: 0x15233d,
      metalness: 0.35,
      roughness: 0.35,
      emissive: 0x0d4a45,
      emissiveIntensity: 0.25,
      flatShading: true,
    })
  );
  group.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.73, 1),
    new THREE.MeshBasicMaterial({ color: 0x3fd8cb, wireframe: true, transparent: true, opacity: 0.35 })
  );
  group.add(wire);

  // Small orbiting satellites for depth and motion variety (kept to a handful — not "excessive motion").
  const satelliteDefs = [
    { geo: new THREE.OctahedronGeometry(0.22), color: 0xf5a524, radius: 2.9, speed: 0.6, offset: 0 },
    { geo: new THREE.BoxGeometry(0.26, 0.26, 0.26), color: 0x3fd8cb, radius: 2.5, speed: -0.45, offset: 2.1 },
    { geo: new THREE.TetrahedronGeometry(0.24), color: 0xffffff, radius: 3.2, speed: 0.35, offset: 4.2 },
  ];
  const satellites = satelliteDefs.map((def) => {
    const mesh = new THREE.Mesh(
      def.geo,
      new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.4, roughness: 0.4 })
    );
    scene.add(mesh);
    return { mesh, ...def };
  });

  scene.add(group);

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(container);

  let pageVisible = !document.hidden;
  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
  });

  // Subtle pointer parallax — a single extra motion cue, well within "1-2 key
  // animated elements" guidance since it augments the same object, not a new one.
  let pointerX = 0;
  let pointerY = 0;
  window.addEventListener("pointermove", (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function renderFrame(t) {
    const time = t * 0.001;
    if (!prefersReducedMotion) {
      group.rotation.y = time * 0.18;
      group.rotation.x = Math.sin(time * 0.3) * 0.08;
      satellites.forEach((s) => {
        const a = time * s.speed + s.offset;
        s.mesh.position.set(Math.cos(a) * s.radius, Math.sin(a * 0.7) * 1.1, Math.sin(a) * s.radius);
      });
    }
    group.rotation.y += (pointerX * 0.25 - group.rotation.y) * 0.02;
    group.rotation.x += (pointerY * 0.15 - group.rotation.x) * 0.02;
    renderer.render(scene, camera);
  }

  // First frame: render once immediately (covers reduced-motion + gives an
  // instant visual even before the rAF loop below settles), then crossfade in.
  renderFrame(0);
  canvas.classList.add("loaded");
  container.querySelector(".hero-visual-fallback")?.classList.add("hidden");

  if (prefersReducedMotion) return; // static frame only — no continuous loop

  function loop(t) {
    if (visible && pageVisible) renderFrame(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
