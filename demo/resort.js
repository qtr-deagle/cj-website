/* =========================================================
   Isla Verde Resort: booking demo (fictional resort)
   ---------------------------------------------------------
   Guest view:  pick a room + dates → live price → reserve.
   Owner view:  stats + a searchable list of every booking.

   There's no server: bookings are saved in this browser
   (localStorage). A real client site would save them to a
   database and email the guest and the resort instead.

   Good parts to read: check() (the booking rules) and
   renderOwner() (how the dashboard numbers are worked out).
   ========================================================= */
(() => {
  /* ---------- Rooms: edit names, prices, and capacity here ---------- */
  const ROOMS = {
    garden: { name: "Garden Room", rate: 3500, cap: 2, info: "Queen bed · garden view",
              pic: "linear-gradient(160deg, #d9ead0 0%, #9dbd88 55%, #5d8a4e 100%)" },
    ocean:  { name: "Ocean Villa", rate: 6800, cap: 3, info: "King bed · sea view · balcony",
              pic: "linear-gradient(180deg, #d6ebf3 0%, #86bcd3 50%, #2f6f8f 100%)" },
    family: { name: "Family Cottage", rate: 9500, cap: 6, info: "2 bedrooms · kitchenette",
              pic: "linear-gradient(170deg, #f7ead0 0%, #e6c98f 55%, #c8643b 100%)" },
  };
  const VAT = 0.12;

  /* ---------- Date helpers (dates are stored as "2026-11-08" text) ---------- */
  const DAY = 86400000;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const nightsBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);   // round = safe across daylight-saving changes
  const short = (s) => parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const peso = (n) => "₱" + Math.round(n).toLocaleString("en-US");

  /* ---------- Saved bookings (this browser only) ---------- */
  const KEY = "isla-verde-bookings-v1";
  function samples() {
    // A few made-up bookings so the dashboard is never empty. Dates are relative to today.
    const mk = (code, name, room, from, nights, guests) => ({
      code, name, room, guests,
      in: iso(addDays(today, from)), out: iso(addDays(today, from + nights)),
      total: ROOMS[room].rate * nights * (1 + VAT),
    });
    return [
      mk("IVR-3M8A", "Maria Santos", "garden", -3, 2, 2),
      mk("IVR-9QK2", "John Dela Cruz", "ocean", 4, 2, 2),
      mk("IVR-5TB7", "Ana Reyes", "family", 10, 3, 5),
    ];
  }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(saved)) return saved;
    } catch { /* private mode or blocked storage: fall back to samples */ }
    return samples();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(bookings)); } catch { /* not saved, but the page still works */ }
  }
  let bookings = load();

  /* =========================================================
     Guest view
     ========================================================= */
  const state = { room: "garden", guests: 2 };
  const roomsEl = document.getElementById("rooms");
  const form = document.getElementById("booking");
  const inIn = form.elements.in, inOut = form.elements.out;
  const guestsOut = form.querySelector("[data-guests]");
  const [minusBtn, plusBtn] = form.querySelectorAll("[data-step]");
  const msg = form.querySelector("[data-bk-msg]");

  // Room cards
  roomsEl.innerHTML = Object.entries(ROOMS).map(([id, r]) => `
    <button type="button" class="room" data-room="${id}">
      <span class="room-pic" style="background:${r.pic}"></span>
      <span class="room-info"><strong>${r.name}</strong><span>${r.info}</span><span>Up to ${r.cap} guests</span></span>
      <span class="room-price"><strong>${peso(r.rate)}</strong><span>per night</span></span>
    </button>`).join("");
  roomsEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-room]");
    if (!card) return;
    state.room = card.dataset.room;
    update();
    // On phones the booking card is below the rooms: bring it into view
    if (matchMedia("(max-width: 960px)").matches) form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Default dates: tomorrow → 2 nights
  inIn.min = iso(today);
  inIn.value = iso(addDays(today, 1));
  inOut.value = iso(addDays(today, 3));
  inIn.addEventListener("change", () => {
    // Keep check-out after check-in: if it isn't, move it to the next day
    if (inIn.value && (!inOut.value || inOut.value <= inIn.value)) inOut.value = iso(addDays(parse(inIn.value), 1));
    update();
  });
  inOut.addEventListener("change", update);

  // Guests stepper
  form.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    state.guests += Number(b.dataset.step);
    update();
  }));

  // The booking rules. Returns "" if OK, otherwise the message to show.
  function check() {
    const r = ROOMS[state.room];
    const a = inIn.value, b = inOut.value;
    if (!a || !b) return "Pick your check-in and check-out dates.";
    if (parse(a) < today) return "Check-in can't be in the past.";
    if (nightsBetween(a, b) < 1) return "Check-out must be after check-in.";
    if (nightsBetween(a, b) > 30) return "For stays over 30 nights, please message the resort.";
    // Two stays clash if one starts before the other ends (checking out on someone's check-in day is fine).
    // Dates are "YYYY-MM-DD" text, which sorts the same way as real dates, so < works.
    const clash = bookings.find((k) => k.room === state.room && a < k.out && k.in < b);
    if (clash) return `Sorry, ${r.name} is taken ${short(clash.in)} – ${short(clash.out)}. Try other dates or another room.`;
    return "";
  }

  // Redraw everything that depends on the choices
  function update() {
    const r = ROOMS[state.room];
    state.guests = Math.min(r.cap, Math.max(1, state.guests));
    guestsOut.textContent = state.guests;
    minusBtn.disabled = state.guests <= 1;
    plusBtn.disabled = state.guests >= r.cap;

    roomsEl.querySelectorAll("[data-room]").forEach((c) => {
      const on = c.dataset.room === state.room;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on);
    });
    form.querySelector("[data-bk-room]").textContent = r.name;
    if (inIn.value) inOut.min = iso(addDays(parse(inIn.value), 1));

    const n = inIn.value && inOut.value ? Math.max(0, nightsBetween(inIn.value, inOut.value)) : 0;
    const sub = r.rate * n;
    form.querySelector("[data-line-rate]").textContent = `${peso(r.rate)} × ${n} night${n === 1 ? "" : "s"}`;
    form.querySelector("[data-line-sub]").textContent = peso(sub);
    form.querySelector("[data-line-vat]").textContent = peso(sub * VAT);
    form.querySelector("[data-line-total]").textContent = peso(sub * (1 + VAT));
    msg.textContent = check();
  }

  /* ---------- Reserve dialog ---------- */
  const dialog = document.getElementById("reserve");
  const rForm = document.getElementById("reserve-form");
  const rMsg = rForm.querySelector("[data-form-msg]");
  const steps = (name) => rForm.querySelectorAll(".panel").forEach((p) => { p.hidden = p.dataset.step !== name; });

  function openReserve() {
    const problem = check();
    if (problem) { msg.textContent = problem; return false; }
    const r = ROOMS[state.room];
    const n = nightsBetween(inIn.value, inOut.value);
    rForm.querySelector("[data-summary]").textContent =
      `${r.name} · ${short(inIn.value)} – ${short(inOut.value)} · ${state.guests} guest${state.guests === 1 ? "" : "s"}`;
    rForm.querySelector("[data-confirm-total]").textContent = `Confirm · ${peso(r.rate * n * (1 + VAT))}`;
    rMsg.textContent = "";
    steps("details");
    dialog.showModal();
    return true;
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); openReserve(); });
  dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });   // click outside closes

  rForm.addEventListener("submit", (e) => {
    if (e.submitter?.value !== "confirm") return;
    e.preventDefault();
    const name = rForm.elements.name.value.trim();
    const email = rForm.elements.email.value.trim();
    if (!name) { rMsg.textContent = "Please enter your name."; return; }
    if (!rForm.elements.email.checkValidity() || !email) { rMsg.textContent = "Please enter a valid email."; return; }
    const problem = check();   // in case the dates were taken meanwhile
    if (problem) { rMsg.textContent = problem; return; }

    const n = nightsBetween(inIn.value, inOut.value);
    const booking = {
      code: newCode(), name, room: state.room, guests: state.guests,
      in: inIn.value, out: inOut.value, total: ROOMS[state.room].rate * n * (1 + VAT),
    };
    bookings.push(booking);
    save();
    rForm.querySelector("[data-code]").textContent = booking.code;
    rForm.reset();
    steps("done");
    update();
    renderOwner();
  });
  rForm.querySelector("[data-see-owner]").addEventListener("click", () => { dialog.close(); showView("owner"); });

  function newCode() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // no 0/O or 1/I, so codes are easy to read out
    let code;
    do {
      code = "IVR-" + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } while (bookings.some((b) => b.code === code));
    return code;
  }

  /* =========================================================
     Owner dashboard
     ========================================================= */
  const list = document.getElementById("bookings");
  const search = document.querySelector(".o-search");
  const stat = (k) => document.querySelector(`[data-stat="${k}"]`);

  function renderOwner() {
    // Stat tiles
    const nights = bookings.reduce((s, b) => s + nightsBetween(b.in, b.out), 0);
    const revenue = bookings.reduce((s, b) => s + b.total, 0);
    // Occupancy this month = room-nights booked this month ÷ (rooms × days in the month)
    const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const daysInMonth = Math.round((mEnd - mStart) / DAY);
    const bookedThisMonth = bookings.reduce((s, b) => {
      const from = Math.max(parse(b.in), mStart), to = Math.min(parse(b.out), mEnd);
      return s + Math.max(0, Math.round((to - from) / DAY));
    }, 0);
    const occ = bookedThisMonth / (Object.keys(ROOMS).length * daysInMonth);
    stat("count").textContent = bookings.length;
    stat("nights").textContent = nights;
    stat("revenue").textContent = peso(revenue);
    stat("month").textContent = today.toLocaleDateString("en-US", { month: "short" });
    stat("occ").textContent = Math.round(occ * 100) + "%";

    // List (soonest first), filtered by the search box
    const q = search.value.trim().toLowerCase();
    const rows = [...bookings]
      .sort((a, b) => (a.in < b.in ? -1 : 1))
      .filter((b) => !q || [b.code, b.name, ROOMS[b.room].name].some((t) => t.toLowerCase().includes(q)));
    list.querySelectorAll(".o-row, .o-empty").forEach((el) => el.remove());
    const t = iso(today);
    for (const b of rows) {
      const status = b.out <= t ? ["Past", "past"] : b.in <= t ? ["Staying", ""] : ["Upcoming", ""];
      const n = nightsBetween(b.in, b.out);
      const row = document.createElement("div");
      row.className = "o-row";
      row.innerHTML = `
        <span class="o-code">${b.code}</span>
        <span class="o-guest"></span>
        <span class="o-room dim">${ROOMS[b.room].name} · ${b.guests} guest${b.guests === 1 ? "" : "s"}</span>
        <span class="o-dates dim">${short(b.in)} – ${short(b.out)} · ${n}n</span>
        <span class="o-pill ${status[1]}">${status[0]}</span>
        <span class="o-total">${peso(b.total)}</span>`;
      row.querySelector(".o-guest").textContent = b.name;   // textContent: a typed name can't inject HTML
      list.append(row);
    }
    if (!rows.length) list.insertAdjacentHTML("beforeend", `<p class="o-empty">No bookings match “${q.replace(/[<>&"]/g, "")}”.</p>`);
  }
  search.addEventListener("input", renderOwner);

  // "+ Add a booking": staff use the same form as guests (e.g. for walk-ins or phone bookings)
  list.querySelector("[data-add]").addEventListener("click", () => {
    if (!openReserve()) { showView("guest"); form.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  document.querySelector("[data-reset]").addEventListener("click", () => {
    bookings = samples();
    save();
    search.value = "";
    update();
    renderOwner();
  });

  /* ---------- Guest / Owner pill switch ---------- */
  const segs = document.querySelectorAll("#view-switch .seg");
  function showView(name) {
    segs.forEach((s) => s.classList.toggle("active", s.dataset.view === name));
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.dataset.view !== name; });
    if (name === "owner") renderOwner();
    scrollTo({ top: 0, behavior: "smooth" });
  }
  segs.forEach((s) => s.addEventListener("click", () => showView(s.dataset.view)));

  update();
  renderOwner();

  /* =========================================================
     3D villa in the hero (shared model from ../models3d.js)
     ========================================================= */
  const stageEl = document.querySelector(".r-stage");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!window.CJ3D) return;
  window.CJ3D.loadThree().then((THREE) => {
    const canvas = stageEl.querySelector("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb3b8, 1.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(3, 5, 4);
    scene.add(sun);

    const { object, tinted } = window.CJ3D.makeCottage(THREE);
    tinted.forEach((m) => m.color.set("#c8643b"));   // terracotta roof
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const c = box.getCenter(new THREE.Vector3());
    object.position.set(-c.x, -box.min.y, -c.z);       // centered, standing on y = 0
    const spin = new THREE.Group();
    spin.add(object);
    scene.add(spin);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ map: window.CJ3D.softCircle(THREE), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    // Camera: back off until the whole villa fits, looking down a little
    spin.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(spin).getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const dist = sphere.radius / Math.sin((camera.fov * Math.PI) / 360) * 0.95;
    camera.position.set(0, sphere.center.y + Math.sin(0.38) * dist, Math.cos(0.38) * dist);
    camera.lookAt(sphere.center);

    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(stageEl);
    resize();

    let last = 0;
    spin.rotation.y = -0.5;
    const frame = (t) => {
      const dt = Math.min((t - (last || t)) / 1000, 0.05);
      last = t;
      if (!reduceMotion) spin.rotation.y += dt * 0.25;
      renderer.render(scene, camera);
    };
    new IntersectionObserver(([e]) => { last = 0; renderer.setAnimationLoop(e.isIntersecting ? frame : null); }).observe(stageEl);
    stageEl.classList.add("ready");
  }).catch((err) => console.warn("3D villa:", err));
})();
