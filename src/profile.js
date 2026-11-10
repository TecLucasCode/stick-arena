/* STICK ARENA — profile.js: XP, níveis, moedas, estatísticas, cosméticos, ranking (localStorage) */
(function () {
  "use strict";
  const KEY = "stickArenaV1";
  function lvlXp(l) { return Math.floor(100 * Math.pow(l, 1.4)); }
  function tierOf(rating, TIERS) {
    let t = TIERS[0];
    for (const x of TIERS) if (rating >= x.min) t = x;
    return t;
  }
  function fresh() {
    return {
      name: "Jogador" + Math.floor(1000 + Math.random() * 9000),
      xp: 0, level: 1, coins: 300, rating: 100,
      stats: { vitorias: 0, derrotas: 0, kills: 0, assists: 0, dano: 0, tempo: 0, partidas: 0, melhorPos: 0 },
      owned: ["padrao"], equip: { rastro: null, acessorio: null, pele: null },
      hist: [], // {modo, arena, pos, kills, xp, coins, quando}
      classe: "guerreiro", armaIdx: 0,
      cfg: { som: true, qualidade: "alta", sens: 1.0, controle: "joystick", btnSize: "medio", showScore: true, showKill: true },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { const f = fresh(); localStorage.setItem(KEY, JSON.stringify(f)); return f; }
      const p = Object.assign(fresh(), JSON.parse(raw));
      p.stats = Object.assign(fresh().stats, p.stats || {});
      p.equip = Object.assign(fresh().equip, p.equip || {});
      p.cfg = Object.assign(fresh().cfg, p.cfg || {});
      return p;
    } catch (e) { return fresh(); }
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function addXp(p, qtd) {
    p.xp += qtd; let up = 0;
    while (p.xp >= lvlXp(p.level)) { p.xp -= lvlXp(p.level); p.level++; up++; }
    return up;
  }
  function applyMatch(p, res, CFG) {
    // res: {pos, kills, assists, dano, tempoS, vitoria, modo, arena}
    const S = CFG.SCORE;
    let pts = res.kills * S.kill + res.assists * S.assist + Math.floor(res.dano / 10) * S.danoPor10;
    if (res.vitoria) pts += S.win;
    if (res.pos === 2) pts += S.top2;
    if (res.pos === 3) pts += S.top3;
    const xp = Math.round(20 + res.kills * 12 + res.assists * 5 + (res.vitoria ? 40 : 0) + res.tempoS / 12);
    const coins = Math.round(15 + res.kills * 8 + (res.vitoria ? 50 : 0) + (res.pos <= 3 ? 20 : 0));
    const up = addXp(p, xp);
    p.coins += coins;
    p.stats.partidas++;
    p.stats.kills += res.kills; p.stats.assists += res.assists;
    p.stats.dano += Math.round(res.dano); p.stats.tempo += Math.round(res.tempoS);
    if (res.vitoria) p.stats.vitorias++; else p.stats.derrotas++;
    if (!p.stats.melhorPos || res.pos < p.stats.melhorPos) p.stats.melhorPos = res.pos;
    // rating competitivo
    let dr = -8 + res.kills * 4 + (res.vitoria ? 24 : 0) + (res.pos <= 3 ? 6 : 0);
    p.rating = Math.max(0, p.rating + dr);
    p.hist.unshift({ modo: res.modo, arena: res.arena, pos: res.pos, kills: res.kills, xp, coins, quando: Date.now() });
    p.hist = p.hist.slice(0, 20);
    save(p);
    return { xp, coins, up, pts, dr };
  }
  const api = { load, save, addXp, applyMatch, lvlXp, tierOf, KEY };
  if (typeof window !== "undefined") window.SA_PROFILE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
