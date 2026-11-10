/* STICK ARENA — ui.js: telas, lobby, HUD, loja, ranking, sons */
(function () {
  "use strict";
  let AC = null;
  function sfx(kind) {
    try {
      const p = JSON.parse(localStorage.getItem("stickArenaV1") || "{}");
      if (p.cfg && p.cfg.som === false) return;
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      const o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(AC.destination);
      const f = { jump: [300, 520, 0.12], swing: [700, 200, 0.08], shoot: [900, 300, 0.1], hit: [200, 80, 0.12], boom: [120, 40, 0.3], ko: [400, 60, 0.4], power: [200, 800, 0.3], tele: [800, 200, 0.2], dash: [500, 900, 0.15], click: [600, 600, 0.05] }[kind] || [440, 440, 0.08];
      o.frequency.setValueAtTime(f[0], AC.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f[1]), AC.currentTime + f[2]);
      g.gain.setValueAtTime(0.12, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + f[2]);
      o.start(); o.stop(AC.currentTime + f[2]);
    } catch (e) {}
  }
  if (typeof window !== "undefined") window.SA_SFX = sfx;

  function el(id) { return document.getElementById(id); }
  function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const t = el(id); if (t) t.classList.add("active");
    window.scrollTo(0, 0);
  }
  function toast(msg, ms) {
    const t = el("toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms || 2200);
  }
  function killfeed(html) {
    const k = el("killfeed"); if (!k) return;
    const d = document.createElement("div"); d.className = "kf"; d.innerHTML = html;
    k.prepend(d);
    while (k.children.length > 5) k.lastChild.remove();
    setTimeout(() => { d.style.opacity = "0"; setTimeout(() => d.remove(), 500); }, 4000);
  }
  const api = { show, toast, killfeed, sfx };
  if (typeof window !== "undefined") window.SA_UI = api;
})();
