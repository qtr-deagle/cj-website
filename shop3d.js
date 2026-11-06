/* =========================================================
   Live 3D product cards (Work section)
   ---------------------------------------------------------
   Four shop-style cards whose "photo" is a live 3D product.
   Products come from models3d.js.

   The trick: ONE canvas lies over the whole grid, and each frame
   it draws every product only inside its own card's square
   (setViewport + setScissor). One 3D engine instead of four,
   which is much lighter for phones.

   Good parts to read: frame() (drawing four scenes on one canvas)
   and fitCamera() (auto-zoom so every product fills its square).
   ========================================================= */
(() => {
  const shop = document.querySelector(".shop");
  if (!shop || !window.CJ3D) return;

  const grid = shop.querySelector(".shop-grid");
  const canvas = shop.querySelector(".shop-canvas");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each product's best side (turntable angle, radians). A new color turns the product to face you,
  // e.g. the deck's colored bottom points sideways, so it needs a quarter turn.
  const FRONT = { shirt: -0.35, cup: -0.6, cottage: -0.5, board: -Math.PI / 2 };
  // How much empty space to leave around each product (1 = just touching the edges).
  // The villa's palm leaves make its outline loose, so it can sit closer.
  const ROOM = { shirt: 1.2, cup: 1.12, cottage: 0.92, board: 1.2 };

  /* ---------- Per-card state + controls (these work even before the 3D loads) ---------- */
  const items = [...shop.querySelectorAll(".shop-card")].map((card) => {
    const it = {
      card,
      name: card.dataset.product,
      media: card.querySelector(".shop-media"),
      dots: [...card.querySelectorAll(".cdot")],
      hex: null,
      rotY: FRONT[card.dataset.product],
      velY: 0, aim: null, hover: false, dragging: false,
      view: null,   // the 3D scene, filled in once Three.js has loaded
    };
    it.hex = it.dots[0].dataset.color;

    const paintDots = () => it.dots.forEach((d) => {
      const on = d.dataset.color === it.hex;
      d.classList.toggle("active", on);
      d.setAttribute("aria-pressed", on);
    });
    paintDots();
    it.dots.forEach((d) => d.addEventListener("click", () => {
      it.hex = d.dataset.color;
      paintDots();
      it.view?.setColor(it.hex, false);
      faceFront(it);
    }));

    card.addEventListener("pointerenter", () => { it.hover = true; });
    card.addEventListener("pointerleave", () => { it.hover = false; });

    // Drag to spin (with a fling that slows down after you let go)
    let px = 0, lastMove = 0;
    it.media.addEventListener("pointerdown", (e) => {
      it.dragging = true; it.aim = null; it.velY = 0;
      px = e.clientX;
      it.media.setPointerCapture(e.pointerId);
    });
    it.media.addEventListener("pointermove", (e) => {
      if (!it.dragging) return;
      it.velY = (e.clientX - px) * 0.012;
      it.rotY += it.velY;
      px = e.clientX;
      lastMove = performance.now();
    });
    const endDrag = () => {
      if (!it.dragging) return;
      it.dragging = false;
      if (performance.now() - lastMove > 80) it.velY = 0;   // held still before letting go = no fling
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => it.media.addEventListener(t, endDrag));
    return it;
  });

  function faceFront(it) {
    const a = FRONT[it.name];
    const turns = Math.round((it.rotY - a) / (Math.PI * 2));   // nearest copy of that angle,
    it.aim = a + turns * Math.PI * 2;                          // so it never spins the long way round
    it.velY = 0;
  }

  /* ---------- Load Three.js shortly before the cards come into view ---------- */
  const near = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    try {
      const THREE = await window.CJ3D.loadThree();
      start(THREE);
    } catch (err) {
      console.warn("3D cards:", err);
      items.forEach((it) => { it.media.dataset.note = "3D unavailable"; });
    }
  }, { rootMargin: "400px 0px" });
  near.observe(grid);

  /* =========================================================
     3D
     ========================================================= */
  function start(THREE) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const makers = {
      shirt: window.CJ3D.makeShirt, cup: window.CJ3D.makeCup,
      cottage: window.CJ3D.makeCottage, board: window.CJ3D.makeBoard,
    };
    items.forEach((it) => { it.view = buildView(THREE, makers[it.name], it); });

    // Draw only while the grid is on screen
    let last = 0;
    new IntersectionObserver(([e]) => {
      last = 0;
      renderer.setAnimationLoop(e.isIntersecting ? frame : null);
    }).observe(grid);

    let cw = 0, ch = 0;
    function frame(now) {
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now;
      const ease = (speed) => 1 - Math.exp(-dt * speed);   // smooth ease-out, no bounce

      // Keep the canvas the same size as the grid
      if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) {
        cw = canvas.clientWidth; ch = canvas.clientHeight;
        renderer.setSize(cw, ch, false);
      }
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);

      const g = canvas.getBoundingClientRect();
      for (const it of items) {
        // Spin: turn to the best side, or fling, or idle-turn (faster while hovered)
        if (it.aim !== null && !it.dragging) {
          it.rotY += (it.aim - it.rotY) * ease(5);
          if (Math.abs(it.aim - it.rotY) < 0.01) it.aim = null;
        } else if (!it.dragging) {
          it.rotY += it.velY;
          it.velY *= Math.pow(0.04, dt);
          if (!reduceMotion) it.rotY += dt * (it.hover ? 0.9 : 0.3);
        }
        it.view.update(dt, ease);

        // Where is this card's square on the canvas? (re-read every frame, so it follows the cards)
        const r = it.media.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) continue;
        const x = r.left - g.left, y = g.bottom - r.bottom;   // WebGL counts y from the bottom
        renderer.setViewport(x, y, r.width, r.height);
        renderer.setScissor(x, y, r.width, r.height);
        renderer.render(it.view.scene, it.view.camera);
      }
    }
  }

  /* ---------- One product = one small scene with its own camera and lights ---------- */
  function buildView(THREE, make, it) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa89f8c, 1.8));
    const key = new THREE.DirectionalLight(0xfff4e6, 2.4);
    key.position.set(3, 5, 4);
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.9);
    fill.position.set(-4, 2, -3);
    scene.add(key, fill);

    const { object, tinted, logo } = make(THREE);

    // Center the product and stand it on the floor (y = 0). The tee floats a little, like on a display.
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const c = box.getCenter(new THREE.Vector3());
    object.position.set(-c.x, (it.name === "shirt" ? 0.2 : 0.004) - box.min.y, -c.z);

    const spin = new THREE.Group();   // turntable
    const holder = new THREE.Group(); // used for the fade-in rise
    holder.add(object);
    spin.add(holder);
    scene.add(spin);

    // Soft shadow under it
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: window.CJ3D.softCircle(THREE), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // Fit the camera to the product's bounding sphere, so every product fills its square the same way
    holder.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    fitCamera(camera, sphere, 0.22, ROOM[it.name]);

    // Everything fades, so every material needs transparency on
    const mats = new Set();
    holder.traverse((o) => o.material && [].concat(o.material).forEach((m) => mats.add(m)));
    mats.forEach((m) => { m.transparent = true; m.opacity = 0; });

    const goal = new THREE.Color();
    const logoGoal = new THREE.Color();
    function setColor(hex, instant) {
      goal.set(hex);
      logoGoal.set(goal.getHSL({}).l > 0.6 ? 0x2b2a26 : 0xf3efe6);   // logo stays readable on any color
      if (instant) {
        tinted.forEach((m) => m.color.copy(goal));
        logo?.color.copy(logoGoal);
      }
    }
    setColor(it.hex, true);

    let shown = 0;
    function update(dt, ease) {
      // Fade in (while rising slightly) once the card itself has faded in
      const cardIn = !it.card.classList.contains("reveal") || it.card.classList.contains("in");
      shown += ((cardIn ? 1 : 0) - shown) * (reduceMotion ? 1 : ease(5));
      holder.position.y = -0.25 * sphere.radius * (1 - shown);
      mats.forEach((m) => { m.opacity = shown; });
      shadow.material.opacity = shown;

      spin.rotation.y = it.rotY;
      tinted.forEach((m) => m.color.lerp(goal, ease(10)));
      logo?.color.lerp(logoGoal, ease(10));
    }

    return { scene, camera, setColor, update };
  }

  // Back the camera off until the whole sphere fits in view, looking down slightly by "pitch" radians
  function fitCamera(camera, sphere, pitch, room) {
    const halfFov = (camera.fov * Math.PI) / 360;
    const dist = (sphere.radius / Math.sin(halfFov)) * room;
    const target = sphere.center;
    camera.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist);
    camera.lookAt(target);
  }
})();
