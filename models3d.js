/* =========================================================
   Shared 3D models (used by shop3d.js and scroll3d.js)
   ---------------------------------------------------------
   Everything is built from code, no model files to download.
   Each maker returns { object, tinted, ... }:
   - object: the 3D group to add to a scene
   - tinted: the materials that change with the color swatches
   This file only defines things; nothing heavy runs until
   a scene calls CJ3D.loadThree().
   ========================================================= */
(() => {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

  // Download Three.js once, even if two scenes ask for it at the same time
  let threePromise = null;
  const loadThree = () => (threePromise ??= import(THREE_URL));

  const mat = (THREE, color, roughness = 0.6, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });

  /* ---------- Shirt: a flat T-shirt outline, "puffed" into 3D with a rounded edge ---------- */
  function makeShirt(THREE) {
    const s = new THREE.Shape();
    s.moveTo(-0.6, -1);
    s.lineTo(0.6, -1);
    s.lineTo(0.63, 0.36);   // right armpit
    s.lineTo(0.98, 0.12);   // right sleeve
    s.lineTo(1.2, 0.56);
    s.lineTo(0.5, 1.0);     // right shoulder
    s.lineTo(0.24, 1.06);
    s.quadraticCurveTo(0, 0.78, -0.24, 1.06);   // neckline
    s.lineTo(-0.5, 1.0);
    s.lineTo(-1.2, 0.56);
    s.lineTo(-0.98, 0.12);
    s.lineTo(-0.63, 0.36);
    s.closePath();

    const fabric = mat(THREE, 0xffffff, 0.9);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.3, curveSegments: 20,
      bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.09, bevelSegments: 6,
    });
    geo.translate(0, 0, -0.15);
    const shirt = new THREE.Mesh(geo, fabric);

    // "CJ" printed on the chest
    const logoMat = mat(THREE, 0x2b2a26, 0.9, { map: textTexture(THREE, "CJ") });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.22), logoMat);
    logo.position.set(0, 0.42, 0.296);   // just in front of the shirt's front face

    const object = new THREE.Group();
    object.add(shirt, logo);
    return { object, tinted: [fabric], logo: logoMat };
  }

  /* ---------- Cup: a side profile spun 360° (a "lathe"), plus handle, coffee, and saucer ---------- */
  function makeCup(THREE) {
    const v = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
    const ceramic = mat(THREE, 0xffffff, 0.35, { side: THREE.DoubleSide });

    // Outline: bottom → outer wall → rim → inner wall → inside bottom
    const cup = new THREE.Mesh(new THREE.LatheGeometry(v([
      [0, -1], [0.5, -1], [0.56, -0.97], [0.7, 0.22], [0.72, 0.3],
      [0.68, 0.32], [0.63, 0.24], [0.52, -0.86], [0, -0.86],
    ]), 64), ceramic);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.065, 16, 40, Math.PI), ceramic);
    handle.rotation.z = -Math.PI / 2;   // half-ring bulging out to the right
    handle.position.set(0.62, -0.35, 0);

    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.615, 48), mat(THREE, 0x3b2417, 0.25));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.16;

    const saucer = new THREE.Mesh(new THREE.LatheGeometry(v([
      [0, -1.08], [0.7, -1.08], [1.0, -1.02], [1.04, -0.98], [0.98, -0.98], [0.62, -1.0], [0, -1.0],
    ]), 64), mat(THREE, 0xf3efe6, 0.35, { side: THREE.DoubleSide }));

    const object = new THREE.Group();
    object.add(cup, handle, coffee, saucer);
    return { object, tinted: [ceramic] };
  }

  /* ---------- Cottage: a little resort scene — house, pool, and a palm tree ---------- */
  function makeCottage(THREE) {
    const object = new THREE.Group();
    const box = (w, h, d, material, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      object.add(m);
      return m;
    };

    // Sand island
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.4, 0.12, 64), mat(THREE, 0xe6d6b3, 0.95));
    sand.position.y = -1.06;
    object.add(sand);

    // House walls, door, windows
    const walls = box(1.3, 0.8, 1.0, mat(THREE, 0xeadfc8, 0.85), 0, -0.6, 0);
    const door = box(0.3, 0.5, 0.04, mat(THREE, 0x6b4a32, 0.7), 0, -0.75, 0.51);
    const glass = mat(THREE, 0xa9cbd6, 0.2);
    const windows = [
      box(0.24, 0.22, 0.04, glass, -0.42, -0.5, 0.51),
      box(0.24, 0.22, 0.04, glass, 0.42, -0.5, 0.51),
    ];

    // Roof: a triangle pushed back into a prism (this is the part that changes color)
    const roofMat = mat(THREE, 0xffffff, 0.75);
    const tri = new THREE.Shape();
    tri.moveTo(-0.82, 0); tri.lineTo(0.82, 0); tri.lineTo(0, 0.7); tri.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 1.24, bevelEnabled: false });
    roofGeo.translate(0, 0, -0.62);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = -0.2;
    object.add(roof);

    // Pool: white rim, with the water poking out just above it
    const poolRim = box(0.72, 0.06, 0.5, mat(THREE, 0xf4f1ea, 0.6), 0.4, -0.97, 0.9);
    const water = box(0.62, 0.06, 0.4, mat(THREE, 0x4fa9c4, 0.15), 0.4, -0.967, 0.9);

    // Palm tree: leaning trunk + 7 flattened-sphere leaves fanned around the top.
    // Grouped with its origin at the foot of the trunk, so scaling the group "grows" it from the ground.
    const palm = new THREE.Group();
    palm.position.set(-0.86, -1.0, -0.35);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 1.5, 10), mat(THREE, 0x8a6a4a, 0.9));
    trunk.position.set(-0.09, 0.75, 0);
    trunk.rotation.z = 0.12;
    palm.add(trunk);
    const leafMat = mat(THREE, 0x5d8a4e, 0.8);
    const top = new THREE.Group();
    top.position.set(-0.18, 1.49, 0);
    for (let i = 0; i < 7; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 7) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), leafMat);
      leaf.scale.set(0.42, 0.03, 0.11);
      leaf.position.set(0.36, -0.07, 0);
      leaf.rotation.z = -0.35;   // droop
      pivot.add(leaf);
      top.add(pivot);
    }
    palm.add(top);
    object.add(palm);

    // "parts" lets the scroll scene (scroll3d.js) move each piece on its own
    return {
      object, tinted: [roofMat],
      parts: { sand, walls, door, windows, glass, roof, roofMat, poolRim, water, palm },
    };
  }

  /* ---------- Skateboard: a flat box, rounded at the ends and bent up at nose and tail ---------- */
  function makeBoard(THREE) {
    const L = 2.6, W = 0.64, T = 0.05;
    // Many slices along the length so the ends can bend smoothly
    const geo = new THREE.BoxGeometry(L, T, W, 48, 1, 8);
    const p = geo.attributes.position;
    const roundFrom = L / 2 - W / 2;   // where the rounded nose/tail begins
    const kickFrom = 0.9;              // where the upward bend begins
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      let y = p.getY(i), z = p.getZ(i);
      const ax = Math.abs(x);
      if (ax > roundFrom) z *= Math.sqrt(Math.max(0, 1 - ((ax - roundFrom) / (W / 2)) ** 2));   // round the ends
      if (ax > kickFrom) y += (ax - kickFrom) ** 2 * 1.1;                                         // bend them up
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();

    // A box has 6 faces, so 6 materials: right, left, TOP (grip tape), BOTTOM (graphic), front, back
    const wood = mat(THREE, 0xd8b98a, 0.8);
    const graphic = mat(THREE, 0xffffff, 0.5);
    const grip = mat(THREE, 0x2a2926, 0.95);
    const deck = new THREE.Mesh(geo, [wood, wood, grip, graphic, wood, wood]);

    const board = new THREE.Group();
    board.add(deck);
    const metal = mat(THREE, 0xb8b8b4, 0.35, { metalness: 0.8 });
    const urethane = mat(THREE, 0xf1ead9, 0.5);
    for (const x of [-0.78, 0.78]) {
      const part = (geo, material, y, z = 0, sideways = false) => {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x, y, z);
        if (sideways) m.rotation.x = Math.PI / 2;
        board.add(m);
      };
      part(new THREE.BoxGeometry(0.26, 0.04, 0.2), metal, -0.045);                        // baseplate
      part(new THREE.BoxGeometry(0.14, 0.08, 0.46), metal, -0.1);                          // hanger
      part(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 10), metal, -0.13, 0, true);      // axle
      part(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 28), urethane, -0.13, 0.36, true); // wheels
      part(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 28), urethane, -0.13, -0.36, true);
    }

    // Stand it up on its tail, leaning back a little, like a shop display
    board.rotation.z = 1.3;
    const object = new THREE.Group();
    object.add(board);
    return { object, tinted: [graphic] };
  }

  /* ---------- Small helper images drawn on a hidden canvas ---------- */
  function softCircle(THREE) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(40,34,24,.32)");
    grad.addColorStop(0.5, "rgba(40,34,24,.12)");
    grad.addColorStop(1, "rgba(40,34,24,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function textTexture(THREE, text) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.font = '800 92px "Inter Tight", Arial, sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  window.CJ3D = { loadThree, mat, softCircle, makeShirt, makeCup, makeCottage, makeBoard };
})();
