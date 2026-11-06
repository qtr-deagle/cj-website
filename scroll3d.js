/* =========================================================
   "How it works" scroll scene
   ---------------------------------------------------------
   Like an Apple-style image sequence, but live 3D instead of
   100+ pictures: it stays sharp on any screen, downloads almost
   nothing extra, and the camera can react to your mouse.

   The whole idea in one line:
     scroll position → a number from 0 to 1 → every part of the
     scene is worked out from that number.
   So scrolling back up simply plays everything in reverse.

   Story (one quarter of the scroll per step):
     1 Call & quote      → blueprint lines draw themselves
     2 Kickoff           → sand rises, walls go up, door + windows appear
     3 Build & preview   → roof drops in, then changes color once ("a round of changes")
     4 Launch & training → pool fills, palm grows, night falls, windows glow, "Live"

   Good parts to read: tick() (smooth scrubbing) and draw() (the story).
   ========================================================= */
(() => {
  const section = document.getElementById("process");
  if (!section || !window.CJ3D) return;
  // Motion-sensitive visitors and devices without 3D keep the normal step grid
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !hasWebGL()) return;

  const track = section.querySelector(".process-track");
  const canvas = section.querySelector(".process-canvas");
  const steps = [...section.querySelectorAll(".step")];
  const bars = [...section.querySelectorAll(".process-rail i")];
  const livePill = section.querySelector(".live-pill");

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);   // fast start, soft landing, no bounce

  // Switch to scroll mode right away (before Three.js loads), so the page height never jumps later.
  // The step cards stop using the normal fade-in, because here scrolling decides which one shows.
  section.classList.add("process-3d");
  steps.forEach((li) => li.classList.remove("reveal"));

  /* ---------- Scroll → progress (0 at the top of the section, 1 at the end) ---------- */
  function scrollProgress() {
    const r = track.getBoundingClientRect();
    const room = r.height - window.innerHeight;   // how far you can scroll while the stage is pinned
    return room > 0 ? clamp01(-r.top / room) : 0;
  }

  // Captions + progress bars (these work even before the 3D has loaded)
  let currentStep = -1;
  function paintUI(p) {
    const i = Math.min(3, Math.floor(p * 4));
    if (i !== currentStep) {
      steps.forEach((li, k) => li.classList.toggle("is-current", k === i));
      currentStep = i;
    }
    bars.forEach((b, k) => { b.style.transform = `scaleX(${clamp01(p * 4 - k)})`; });
    livePill.classList.toggle("on", p > 0.92);
  }

  /* ---------- Smooth scrubbing ----------
     "shown" chases the real scroll position instead of jumping to it,
     so even a jumpy mouse wheel looks like a smooth video. */
  let shown = scrollProgress();
  let scene3d = null;
  let raf = 0, lastT = 0;

  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60;
    lastT = now;

    const target = scrollProgress();
    shown += (target - shown) * (1 - Math.exp(-dt * 8));
    if (Math.abs(target - shown) < 0.0005) shown = target;
    paintUI(shown);

    const r = section.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < window.innerHeight;
    const stillMoving = scene3d && onScreen ? scene3d.draw(shown, dt) : false;

    // Keep going only while something is still easing; otherwise sleep until the next scroll
    if (shown !== target || stillMoving) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", kick);
  kick();

  /* ---------- Load Three.js shortly before the section comes into view ---------- */
  const near = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    try {
      const THREE = await window.CJ3D.loadThree();
      scene3d = buildScene(THREE);
      section.classList.add("is-ready");
      kick();
    } catch (err) {
      // Couldn't load: go back to the normal step grid, keeping your place on the page
      console.warn("Scroll 3D:", err);
      const before = section.offsetHeight;
      const isAbove = section.getBoundingClientRect().top < 0;
      section.classList.remove("process-3d");
      steps.forEach((li) => li.classList.remove("is-current"));
      if (isAbove) window.scrollBy(0, section.offsetHeight - before);
    }
  }, { rootMargin: "600px 0px" });
  near.observe(section);

  /* =========================================================
     The 3D scene
     ========================================================= */
  function buildScene(THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // big canvas, so cap a bit lower

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

    // Lights. Each has a "day" and a "night" setting; step 4 slides between them.
    const hemi = new THREE.HemisphereLight(0xfff8ee, 0x3a3630, 1.7);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8);
    rim.position.set(-4, 3, -3);
    const lamp = new THREE.PointLight(0xffb85c, 0, 3, 2);   // warm porch light, off until night
    lamp.position.set(0.15, -0.8, 1.25);
    scene.add(hemi, sun, rim, lamp);
    const day = { sky: new THREE.Color(0xfff8ee), sun: new THREE.Color(0xfff1dc) };
    const night = { sky: new THREE.Color(0x8fa3c8), sun: new THREE.Color(0x9db4ff) };

    // Soft pool of light on the "floor", and a faint drafting grid for the blueprint step
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: glowTexture(THREE), transparent: true, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.13;
    // (a picture of grid lines that fades out toward its edges, so it never ends in a hard line)
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: gridTexture(THREE), transparent: true, depthWrite: false })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -1.12;
    scene.add(glow, grid);

    // The cottage, from models3d.js. "parts" gives us each piece to move separately.
    const { object, parts: P } = window.CJ3D.makeCottage(THREE);
    scene.add(object);
    for (const m of [P.door.material, P.glass, P.roofMat]) m.transparent = true;   // these fade in
    const roofFirst = new THREE.Color(0xc8643b);    // terracotta...
    const roofFinal = new THREE.Color(0x8a9a7b);    // ...changed to sage in step 3

    // Blueprint: the outline (edges) of each piece, drawn as dashed lines.
    // Growing the dash length from 0 to the full length makes the lines "draw themselves".
    const lines = [];
    const addOutline = (mesh, angle = 1) => {
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, angle),
        new THREE.LineDashedMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0, depthWrite: false, dashSize: 0, gapSize: 1 })
      );
      line.position.copy(mesh.position);
      line.rotation.copy(mesh.rotation);
      line.computeLineDistances();
      const d = line.geometry.attributes.lineDistance;
      line.userData.total = d.getX(d.count - 1);   // full length of all the lines together
      line.material.gapSize = line.userData.total + 1;
      object.add(line);
      lines.push(line);
    };
    addOutline(P.sand, 20);   // 20° = only the round edges, not every side panel
    [P.walls, P.door, ...P.windows, P.roof, P.poolRim].forEach((m) => addOutline(m));

    /* ---------- Mouse parallax: the camera leans a little toward the cursor ---------- */
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    if (matchMedia("(pointer: fine)").matches) {
      addEventListener("pointermove", (e) => {
        lean.tx = (e.clientX / window.innerWidth) * 2 - 1;
        lean.ty = (e.clientY / window.innerHeight) * 2 - 1;
        kick();
      }, { passive: true });
    }

    /* ---------- Keep the canvas sized to its box ---------- */
    let fit = 1;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit = Math.max(1, 0.95 / camera.aspect);   // narrow screens: step back so it still fits
      kick();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    /* ---------- The story: p (0 → 1) decides where every piece is ---------- */
    function draw(p, dt) {
      // local(a, b): 0 before a, 1 after b, and a smooth 0 → 1 in between
      const local = (a, b) => easeOut(clamp01((p - a) / (b - a)));

      // 1 · Call & quote: grid fades in, blueprint lines draw themselves (then fade during step 2)
      const drawn = local(0.03, 0.2);
      const blueprintFade = local(0.4, 0.52);
      for (const l of lines) {
        l.material.dashSize = l.userData.total * drawn;
        l.material.opacity = drawn > 0 ? 0.9 * (1 - blueprintFade) : 0;
        l.visible = l.material.opacity > 0.001;
      }
      grid.material.opacity = local(0, 0.12) * (1 - local(0.84, 0.95));

      // 2 · Kickoff: sand spreads out, walls rise out of it, then door + windows appear
      const sand = local(0.26, 0.36);
      P.sand.visible = sand > 0;
      P.sand.scale.set(lerp(0.6, 1, sand), Math.max(sand, 0.001), lerp(0.6, 1, sand));
      const walls = local(0.3, 0.43);
      P.walls.visible = walls > 0;
      P.walls.scale.y = Math.max(walls, 0.001);
      P.walls.position.y = -1.0 + 0.4 * walls;   // grow up from the ground, not from the middle
      const details = local(0.4, 0.48);
      for (const m of [P.door, ...P.windows]) {
        m.visible = details > 0;
        m.position.z = 0.51 + 0.12 * (1 - details);   // slide in onto the wall
      }
      P.door.material.opacity = details;
      P.glass.opacity = details;

      // 3 · Build & preview: roof drops in, then gets one color change
      const roof = local(0.52, 0.64);
      P.roof.visible = roof > 0;
      P.roof.position.y = -0.2 + 1.4 * (1 - roof);
      P.roofMat.opacity = roof;
      P.roofMat.color.copy(roofFirst).lerp(roofFinal, local(0.66, 0.74));

      // 4 · Launch: pool + palm, then night falls and the lights come on
      const rimIn = local(0.76, 0.81);
      P.poolRim.visible = rimIn > 0;
      P.poolRim.scale.set(Math.max(rimIn, 0.001), 1, Math.max(rimIn, 0.001));
      const water = local(0.79, 0.86);
      P.water.visible = water > 0;
      P.water.scale.set(Math.max(water, 0.001), 1, Math.max(water, 0.001));
      const palm = local(0.8, 0.9);
      P.palm.visible = palm > 0;
      P.palm.scale.setScalar(Math.max(palm, 0.001));

      const n = local(0.86, 0.97);   // 0 = day, 1 = night
      hemi.intensity = lerp(1.7, 0.35, n);
      hemi.color.copy(day.sky).lerp(night.sky, n);
      sun.intensity = lerp(2.4, 0.5, n);
      sun.color.copy(day.sun).lerp(night.sun, n);
      lamp.intensity = lerp(0, 1.8, n);
      P.glass.emissive.setHex(0xffc46b);
      P.glass.emissiveIntensity = 1.8 * n;
      P.water.material.emissive.setHex(0x1f86ab);
      P.water.material.emissiveIntensity = 0.9 * n;

      // Camera: slowly circles from the left side round to the front, and comes down closer
      lean.x += (lean.tx - lean.x) * (1 - Math.exp(-dt * 4));
      lean.y += (lean.ty - lean.y) * (1 - Math.exp(-dt * 4));
      const c = p * p * (3 - 2 * p);   // smoothstep: gentle at both ends
      const angle = lerp(-1.0, 0.55, c) + lean.x * 0.12;
      const pitch = lerp(0.62, 0.26, c) + lean.y * 0.05;
      const radius = lerp(8.4, 7.0, c) * fit;
      const lookY = lerp(-0.25, -0.4, c);
      camera.position.set(
        Math.sin(angle) * Math.cos(pitch) * radius,
        lookY + Math.sin(pitch) * radius,
        Math.cos(angle) * Math.cos(pitch) * radius
      );
      camera.lookAt(0, lookY, 0);

      renderer.render(scene, camera);
      // Tell tick() whether the mouse lean is still settling (so it keeps drawing)
      return Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) > 0.002;
    }

    return { draw };
  }

  /* ---------- Helpers ---------- */
  function glowTexture(THREE) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(236,235,230,.14)");
    grad.addColorStop(0.55, "rgba(236,235,230,.05)");
    grad.addColorStop(1, "rgba(236,235,230,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function gridTexture(THREE) {
    const size = 512, cells = 24;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(236,235,230,.5)";
    g.lineWidth = 1.5;
    for (let i = 0; i <= cells; i++) {
      const x = (i / cells) * size;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke();
      g.beginPath(); g.moveTo(0, x); g.lineTo(size, x); g.stroke();
    }
    // Fade out toward the edges: keep the lines only where this round gradient is solid
    g.globalCompositeOperation = "destination-in";
    const fade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    fade.addColorStop(0, "rgba(0,0,0,.45)");
    fade.addColorStop(0.6, "rgba(0,0,0,.25)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function hasWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }
})();
