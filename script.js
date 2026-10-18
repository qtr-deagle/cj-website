/* =========================================================
   EDIT YOUR CONTACT DETAILS HERE (one place for the whole site)
   - Leave a value as "" to hide that contact card.
   ========================================================= */
const CONTACT = {
  email: "cjalamares05@gmail.com",
  facebook: "https://www.facebook.com/TheSuspecttttt",                                 // e.g. "https://facebook.com/your.page"
  phone: "+63 992 057 4116",
  github: "https://github.com/qtr-deagle",
  linkedin: "https://www.linkedin.com/in/christian-joshua-alamares-440485353",
  instagram: "https://www.instagram.com/thesuspect00",
};

/* ---------- Fill contact cards ---------- */
const display = {
  email: (v) => v,
  facebook: (v) => v.replace(/^https?:\/\/(www\.)?/, ""),
  phone: (v) => v,
  github: (v) => v.replace(/^https?:\/\//, ""),
  linkedin: () => "Christian Joshua Alamares",
  instagram: (v) => "@" + v.replace(/\/$/, "").split("/").pop(),
};
const href = {
  email: (v) => `mailto:${v}`,
  facebook: (v) => v,
  phone: (v) => `tel:${v.replace(/\s/g, "")}`,
  github: (v) => v,
  linkedin: (v) => v,
  instagram: (v) => v,
};
for (const key of Object.keys(CONTACT)) {
  const card = document.querySelector(`[data-contact="${key}"]`);
  if (!card) continue;
  const value = CONTACT[key];
  if (!value) { card.hidden = true; continue; }
  card.href = href[key](value);
  card.querySelector("[data-contact-text]").textContent = display[key](value);
}

/* ---------- Entrance animation: reveal elements as they scroll into view ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    // small stagger for items that appear together (like a row of tiles)
    const siblings = [...e.target.parentElement.children].filter((el) => el.classList.contains("reveal"));
    const i = Math.max(0, siblings.indexOf(e.target));
    e.target.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
    e.target.classList.add("in");
    io.unobserve(e.target);
  }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));


/* ---------- "Start a project" dialog ---------- */
const dialog = document.getElementById("start");
const form = document.getElementById("start-form");
let need = "Website";

document.querySelectorAll("[data-open-start]").forEach((b) => b.addEventListener("click", () => dialog.showModal()));
dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // click outside closes

// Pill switch helper: makes one button active and runs onPick with it
function pills(selector, onPick) {
  const btns = document.querySelectorAll(selector);
  btns.forEach((btn) => btn.addEventListener("click", () => {
    if (btn.classList.contains("active")) return;   // already selected: do nothing
    btns.forEach((b) => b.classList.toggle("active", b === btn));
    onPick(btn);
  }));
}
// "New here" / "Got your email" switch shows the matching panel
pills("#who .seg", (btn) => {
  dialog.querySelectorAll(".panel").forEach((p) => { p.hidden = p.dataset.panel !== btn.dataset.panel; });
});
pills("#need .seg", (btn) => { need = btn.dataset.v; });

// "Got your email" shows the address your emails come from, so people can check it's really you
dialog.querySelector("[data-verify]").hidden = !CONTACT.email;
dialog.querySelector("[data-verify-email]").textContent = CONTACT.email;

form.addEventListener("submit", (e) => {
  if (e.submitter?.value !== "send") return;
  if (!CONTACT.email) {
    e.preventDefault();
    alert("Email isn't set yet. Add it to CONTACT in script.js.");
    return;
  }
  const d = new FormData(form);
  const subject = `New project: ${need}${d.get("business") ? " for " + d.get("business") : ""}`;
  const body = [
    `Name: ${d.get("name") || "-"}`,
    `Business: ${d.get("business") || "-"}`,
    `Needs: ${need}`,
    "",
    d.get("details") || "",
  ].join("\n");
  window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

/* ---------- Phone menu ---------- */
const menuBtn = document.querySelector(".menu-btn");
const menu = document.querySelector(".mobile-menu");
const setMenu = (open) => { menu.hidden = !open; menuBtn.setAttribute("aria-expanded", open); };
menuBtn.addEventListener("click", () => setMenu(menu.hidden));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.querySelectorAll("[data-open-start]").forEach((b) => b.addEventListener("click", () => setMenu(false)));

/* ---------- Payment plan hover: bar segment <-> matching box ---------- */
const plan = document.querySelector(".plan");
const highlight = (step) => {
  plan.classList.toggle("has-hl", !!step);
  plan.querySelectorAll("[data-step]").forEach((el) => el.classList.toggle("hl", el.dataset.step === step));
};
plan.querySelectorAll("[data-step]").forEach((el) => {
  el.addEventListener("pointerenter", () => highlight(el.dataset.step)); // mouse hover, or a tap on phones
});
// Only clear when leaving the whole plan, so crossing the gaps between boxes doesn't flicker
plan.addEventListener("pointerleave", () => highlight(null));

/* ---------- Custom cursor (only with a real mouse, and not for "reduce motion" users) ---------- */
if (matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const dot = document.createElement("div");
  const ring = document.createElement("div");
  dot.className = "cursor-dot";
  ring.className = "cursor-ring";
  document.body.append(dot, ring);
  document.documentElement.classList.add("has-cursor");

  let x = -100, y = -100, rx = x, ry = y;
  addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    document.documentElement.classList.add("cursor-on");
  });
  document.addEventListener("mouseleave", () => document.documentElement.classList.remove("cursor-on"));

  // The ring eases toward the mouse every frame, so it trails slightly behind
  (function follow() {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(follow);
  })();

  // Grow over anything clickable
  const clickable = "a, button, .seg, label";   // only things you can actually click
  const updateRing = (target) => {
    // Over a text box, hide the custom cursor so the normal typing cursor (|) shows instead
    const typing = !!target.closest("input, textarea, select");
    document.documentElement.classList.toggle("cursor-typing", typing);
    // The pill that's already selected isn't clickable, so the ring stays small over it
    const canClick = !!target.closest(clickable) && !target.closest(".seg.active");
    ring.classList.toggle("grow", !typing && canClick);
  };
  document.addEventListener("mouseover", (e) => updateRing(e.target));
  // After a click (e.g. picking a pill), re-check: the pill you clicked is now the selected one
  document.addEventListener("click", (e) => updateRing(e.target));
  addEventListener("mousedown", () => ring.classList.add("press"));
  addEventListener("mouseup", () => ring.classList.remove("press"));

  // The popup sits in its own top layer, above everything, so the cursor moves inside it while it's open
  document.querySelectorAll("[data-open-start]").forEach((btn) => btn.addEventListener("click", () => dialog.append(dot, ring)));
  dialog.addEventListener("close", () => document.body.append(dot, ring));
}

/* ---------- Pricing packages (pill switch) — edit the numbers here ---------- */
const PACKAGES = {
  a: { setup: "₱40,000", monthly: "₱2,500", term: "None",   split: "Setup paid in 3 steps: 30 / 40 / 30.", plan: [30, 40, 30], launch: "When your site goes live" },   // One-time build
  b: { setup: "₱12,000", monthly: "₱4,500", term: "1 year", split: "Setup: half to start, half at launch.", plan: [50, 0, 50], launch: "Once you approve the preview" },   // Low upfront
};
const pkgSegs = document.querySelectorAll(".pkg .seg");
pkgSegs.forEach((btn) => btn.addEventListener("click", () => {
  if (btn.classList.contains("active")) return;   // already selected: don't replay the animation
  pkgSegs.forEach((b) => b.classList.toggle("active", b === btn));
  const p = PACKAGES[btn.dataset.pkg];
  for (const key of ["setup", "monthly", "term", "split", "launch"]) {
    const el = document.querySelector(`[data-pkg-${key}]`);
    el.textContent = p[key];
    el.classList.remove("swap");
    void el.offsetWidth;            // restart the little fade-up animation
    el.classList.add("swap");
  }
  // Payment plan on the right: update the bar and boxes (a step at 0% is hidden)
  p.plan.forEach((pct, i) => {
    const step = String(i + 1);
    const seg = document.querySelector(`.plan-bar [data-step="${step}"]`);
    const box = document.querySelector(`.ms[data-step="${step}"]`);
    seg.style.flex = pct;
    seg.dataset.pct = pct + "%";
    seg.classList.toggle("off", pct === 0);   // "off" slides the step closed (see styles.css)
    box.classList.toggle("off", pct === 0);
    const num = box.querySelector(".ms-pct");
    num.textContent = pct + "%";
    num.classList.remove("swap");
    void num.offsetWidth;
    num.classList.add("swap");
  });
}));

/* ---------- Back-to-top button: show after scrolling down, scroll up on click ---------- */
const toTop = document.querySelector("[data-to-top]");
const toggleToTop = () => {
  toTop.classList.toggle("show", scrollY > 600);
  // Look at what's behind the button: if it's a dark section, switch the button to light
  const r = toTop.getBoundingClientRect();
  const behind = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    .find((el) => el !== toTop && !toTop.contains(el));
  toTop.classList.toggle("on-dark", !!behind?.closest(".tex-dark"));
};
addEventListener("scroll", toggleToTop, { passive: true });
addEventListener("resize", toggleToTop);
toggleToTop();
toTop.addEventListener("click", () => scrollTo({ top: 0 }));   // smooth, because the CSS sets scroll-behavior: smooth

document.getElementById("year").textContent = new Date().getFullYear();
