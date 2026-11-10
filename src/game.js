/* STICK ARENA por Lucas — game.js: launcher ONLINE/OFFLINE, lobby, partida 60Hz, controles mobile+PC */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let PROF = null, GAME = null, NET = null, RAF = 0, LAST = 0, ACC = 0;
  let INPUT = { x: 0, jump: false, jumpPressed: false, down: false, atk: false, power: false, armaTroca: false };
  let LOBBY = { code: null, players: [], isHost: true, classe: "guerreiro", armaIdx: 0, modo: "ffa", arena: "vulcao", playMode: "offline", nBots: 3, diff: "normal" };
  let REMOTE = {}; // id -> {x,y,...tx,ty,ts}
  let JOY = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0, down: false, jumpSent: false };

  function boot() {
    PROF = window.SA_PROFILE.load();
    if (PROF.classe) LOBBY.classe = PROF.classe;
    if (typeof PROF.armaIdx === "number") LOBBY.armaIdx = PROF.armaIdx;
    bindEntry(); bindMenu(); bindLobby(); bindCustomize(); bindConfig(); bindControls(); bindEnd();
    refreshProfile(); renderRanking(); renderStats(); renderShop();
    setClasseUI(LOBBY.classe, true);
    window.SA_UI.show("screen-entry");
    initNet();
    fitCanvas();
    window.addEventListener("resize", fitCanvas);
  }
  function C() { return window.SA_CONFIG; }

  function refreshProfile() {
    $("pName").textContent = PROF.name;
    $("pLevel").textContent = "Nv " + PROF.level;
    $("pCoins").textContent = "🪙 " + PROF.coins;
    $("pCoins2") && ($("pCoins2").textContent = "🪙 " + PROF.coins);
    const need = window.SA_PROFILE.lvlXp(PROF.level);
    $("xpFill").style.width = Math.round(PROF.xp / need * 100) + "%";
    $("xpTxt").textContent = PROF.xp + "/" + need + " XP";
    const t = window.SA_PROFILE.tierOf(PROF.rating, C().TIERS);
    $("pTier").textContent = t.nome + " (" + PROF.rating + ")";
    $("pTier").style.color = t.cor;
    if ($("cfgName")) $("cfgName").value = PROF.name;
    if ($("entryName")) $("entryName").value = PROF.name;
  }

  // ---------- entrada / launcher ----------
  function bindEntry() {
    on("entryOnlineBtn", () => {
      saveEntryName();
      LOBBY.playMode = "online";
      window.SA_UI.show("screen-lobby");
      $("lobbyTitle").textContent = "🌐 LOBBY ONLINE";
      $("onlineRow").hidden = false;
      $("offlineRow").hidden = true;
      $("startBtn").hidden = false;
      refreshLobby();
      if (NET && NET.online) { NET.createRoom(PROF.name, LOBBY.classe); toast("Criando sala online..."); }
      else toast("Sem servidor: jogue OFFLINE ou configure o servidor.");
    });
    on("entryOfflineBtn", () => {
      saveEntryName();
      LOBBY.playMode = "offline";
      window.SA_UI.show("screen-lobby");
      $("lobbyTitle").textContent = "🤖 JOGAR OFFLINE";
      $("onlineRow").hidden = true;
      $("offlineRow").hidden = false;
      $("startBtn").hidden = false;
      refreshLobby();
    });
    const menu = (id, screen) => on(id, () => window.SA_UI.show(screen));
    // atalhos do launcher
    bindMenu();
  }
  function saveEntryName() {
    const v = ($("entryName") && $("entryName").value || "").trim().slice(0, 16);
    if (v) { PROF.name = v; window.SA_PROFILE.save(PROF); refreshProfile(); }
  }
  function bindMenu() {
    on("playBtn", () => window.SA_UI.show("screen-entry"));
    on("playBtn2", () => window.SA_UI.show("screen-entry"));
    on("customBtn", () => { window.SA_UI.show("screen-custom"); renderShop(); });
    on("rankBtn", () => { window.SA_UI.show("screen-rank"); renderRanking(); });
    on("statsBtn", () => { window.SA_UI.show("screen-stats"); renderStats(); });
    on("cfgBtn", () => window.SA_UI.show("screen-config"));
    on("helpBtn", () => window.SA_UI.show("screen-help"));
    document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => {
      window.SA_SFX("click");
      window.SA_UI.show("screen-entry"); refreshProfile();
    }));
  }

  // ---------- lobby ----------
  function refreshLobby() {
    if (!LOBBY.code) LOBBY.code = window.SA_NET.code6();
    $("roomCode").textContent = LOBBY.code;
    $("modeSel").value = LOBBY.modo; $("arenaSel").value = LOBBY.arena;
    if ($("botCount")) $("botCount").value = String(LOBBY.nBots);
    if ($("diffSel")) $("diffSel").value = LOBBY.diff;
    renderLobbyPlayers(); renderClassCards();
  }
  function bindLobby() {
    on("copyCodeBtn", () => {
      const link = "https://perchance.org/" + (window.generatorName || "") + "#sala=" + LOBBY.code;
      try { navigator.clipboard.writeText("STICK ARENA de Lucas — sala " + LOBBY.code + " " + link); } catch (e) {}
      window.SA_UI.toast("Código " + LOBBY.code + " copiado! Mande pros amigos.");
    });
    on("newCodeBtn", () => {
      LOBBY.code = window.SA_NET.code6();
      $("roomCode").textContent = LOBBY.code;
      if (NET && NET.online && LOBBY.playMode === "online") NET.createRoom(PROF.name, LOBBY.classe);
    });
    on("joinCodeBtn", () => {
      const v = ($("joinInput").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (v.length === 6 && NET) { LOBBY.code = v; $("roomCode").textContent = v; NET.joinRoom(v, PROF.name, LOBBY.classe); toast("Entrando na sala " + v + "..."); }
      else toast("Digite o código de 6 letras do amigo.");
    });
    on("addBotBtn", () => {
      if (LOBBY.playMode !== "offline") return toast("Bots só no modo OFFLINE.");
      ensureBots(Math.min(8, LOBBY.players.length + 1));
    });
    on("startBtn", () => startPressed());
    $("modeSel").addEventListener("change", e => LOBBY.modo = e.target.value);
    $("arenaSel").addEventListener("change", e => LOBBY.arena = e.target.value);
    if ($("botCount")) $("botCount").addEventListener("change", e => { LOBBY.nBots = parseInt(e.target.value, 10) || 3; ensureBots(1 + LOBBY.nBots); });
    if ($("diffSel")) $("diffSel").addEventListener("change", e => { LOBBY.diff = e.target.value; });
    if (location.hash.includes("sala=")) {
      const m = location.hash.match(/sala=([A-Z0-9]{6})/i);
      if (m) {
        LOBBY.code = m[1].toUpperCase(); LOBBY.playMode = "online";
        setTimeout(() => { window.SA_UI.show("screen-lobby"); $("lobbyTitle").textContent = "🌐 LOBBY ONLINE"; $("onlineRow").hidden = false; $("offlineRow").hidden = true; refreshLobby(); }, 600);
      }
    }
  }
  function startPressed() {
    saveEntryName();
    if (LOBBY.playMode === "offline") {
      ensureBots(1 + LOBBY.nBots);
      if (LOBBY.players.length < 2) return toast("Aumente o nº de bots.");
      startMatch();
    } else {
      const n = LOBBY.players.length;
      if (NET && NET.online && !LOBBY.isHost) return toast("Aguarde o anfitrião (👑) iniciar.");
      if (n < 2) return toast("Chame amigos pelo código ou jogue OFFLINE com bots.");
      if (NET && NET.online) NET.startMatch(LOBBY.modo, LOBBY.arena);
      startMatch();
    }
  }
  function meEntry() { return { id: NET && NET.online && LOBBY.playMode === "online" ? NET.myId : "me", name: PROF.name, classe: LOBBY.classe, armaIdx: LOBBY.armaIdx, isHost: LOBBY.isHost, isMe: true }; }
  function ensureBots(total) {
    if (LOBBY.playMode !== "offline" && NET && NET.online) return; // online: lista vem do servidor
    const names = C().BOT_NAMES, cls = Object.keys(C().CLASSES);
    const me = meEntry();
    LOBBY.players = [me];
    let i = 0;
    while (LOBBY.players.length < Math.min(8, Math.max(2, total))) {
      LOBBY.players.push({ id: "bot" + i, name: names[i % names.length] + " 🤖", classe: cls[(i + LOBBY.players.length) % 4], isHost: false, isBot: true });
      i++;
    }
    renderLobbyPlayers();
  }
  function renderLobbyPlayers() {
    if (LOBBY.playMode === "offline" && !LOBBY.players.length) ensureBots(1 + LOBBY.nBots);
    if (LOBBY.playMode === "online" && !LOBBY.players.length) LOBBY.players = [meEntry()];
    const ctn = $("lobbyList"); ctn.innerHTML = "";
    LOBBY.players.forEach((p) => {
      const d = document.createElement("div"); d.className = "plob" + (p.isMe ? " me" : "");
      const cls = C().CLASSES[p.classe] || C().CLASSES.guerreiro;
      d.innerHTML = "<b>" + (p.isHost ? "👑 " : "") + escapeHtml(p.name) + "</b><span>" + cls.icone + " " + cls.nome + "</span>";
      ctn.appendChild(d);
    });
    $("lobbyCount").textContent = LOBBY.players.length + "/8 jogadores";
    $("hostTag").textContent = LOBBY.playMode === "offline" ? "OFFLINE — só você + bots." : (LOBBY.isHost ? "Você é o ANFITRIÃO — só você inicia." : "Aguarde o anfitrião iniciar.");
    $("startBtn").disabled = LOBBY.playMode === "online" && !LOBBY.isHost;
    $("addBotBtn").style.display = LOBBY.playMode === "offline" ? "" : "none";
  }
  function renderClassCards() {
    const ctn = $("classCards"); ctn.innerHTML = "";
    for (const id of ["guerreiro", "mago", "atirador", "engenheiro"]) {
      const cc = C().CLASSES[id];
      const d = document.createElement("button");
      d.className = "cls" + (LOBBY.classe === id ? " sel" : "");
      d.innerHTML = "<div class=ci>" + cc.icone + "</div><b>" + cc.nome + "</b><small>" + cc.poderNome + ": " + cc.poderDesc + "</small><small>HP " + cc.hp + " • Vel " + cc.speed + "</small>";
      d.onclick = () => { setClasseUI(id); window.SA_SFX("click"); };
      ctn.appendChild(d);
    }
    const w = $("weaponRow"); w.innerHTML = "";
    C().WEAPONS[LOBBY.classe].forEach((wp, i) => {
      const b = document.createElement("button");
      b.className = "wpn" + (LOBBY.armaIdx === i ? " sel" : "");
      b.innerHTML = "<b>" + escapeHtml(wp.nome) + "</b><small>D" + wp.dmg + " • " + Math.round(wp.cd) + "ms</small><small style='opacity:.75'>" + escapeHtml(wp.desc) + "</small>";
      b.onclick = () => { LOBBY.armaIdx = i; PROF.classe = LOBBY.classe; PROF.armaIdx = i; window.SA_PROFILE.save(PROF); renderClassCards(); window.SA_SFX("click"); };
      w.appendChild(b);
    });
  }
  function setClasseUI(id, silent) {
    LOBBY.classe = id; PROF.classe = id; window.SA_PROFILE.save(PROF);
    const p = LOBBY.players.find(p => p.isMe); if (p) p.classe = id;
    renderClassCards(); renderLobbyPlayers();
    if (!silent && NET) NET.setClasse(id);
  }

  // ---------- loja / ranking / stats / config ----------
  function bindCustomize() {
    on("saveLookBtn", () => { window.SA_PROFILE.save(PROF); toast("Visual salvo!"); refreshProfile(); });
  }
  function renderShop() {
    const ctn = $("shopGrid"); if (!ctn) return; ctn.innerHTML = "";
    if ($("shopCoins")) $("shopCoins").textContent = "🪙 " + PROF.coins;
    for (const it of C().LOJA) {
      const owned = PROF.owned.includes(it.id);
      const eq = PROF.equip[it.tipo] === it.id;
      const d = document.createElement("div"); d.className = "shop" + (eq ? " eq" : "");
      d.innerHTML = "<b>" + it.nome + "</b><small>" + it.desc + "</small><b>" + (owned ? (eq ? "EQUIPADO" : "comprado") : "🪙 " + it.preco) + "</b>";
      const b = document.createElement("button");
      b.textContent = owned ? (eq ? "Desequipar" : "Equipar") : "Comprar";
      b.onclick = () => {
        if (!owned) {
          if (PROF.coins < it.preco) { toast("Moedas insuficientes. Jogue partidas!"); return; }
          PROF.coins -= it.preco; PROF.owned.push(it.id); PROF.equip[it.tipo] = it.id;
        } else PROF.equip[it.tipo] = eq ? null : it.id;
        window.SA_PROFILE.save(PROF); refreshProfile(); renderShop(); window.SA_SFX("power");
      };
      d.appendChild(b); ctn.appendChild(d);
    }
  }
  function renderRanking() {
    const t = window.SA_PROFILE.tierOf(PROF.rating, C().TIERS);
    $("myRank").innerHTML = "<b>" + escapeHtml(PROF.name) + "</b> — " + t.nome + " • " + PROF.rating + " pts • Nv " + PROF.level;
    const ctn = $("rankList"); ctn.innerHTML = "";
    const names = C().BOT_NAMES;
    const rows = [{ n: PROF.name + " (você)", r: PROF.rating, me: true }];
    let s = 987654321;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 12; i++) rows.push({ n: names[i % names.length], r: Math.round(80 + rnd() * 2600) });
    rows.sort((a, b) => b.r - a.r);
    rows.forEach((r, i) => {
      const tt = window.SA_PROFILE.tierOf(r.r, C().TIERS);
      const d = document.createElement("div"); d.className = "rrow" + (r.me ? " me" : "");
      d.innerHTML = "<span>#" + (i + 1) + " " + escapeHtml(r.n) + "</span><span style='color:" + tt.cor + "'>" + tt.nome + " • " + r.r + "</span>";
      ctn.appendChild(d);
    });
  }
  function renderStats() {
    const s = PROF.stats;
    $("statGrid").innerHTML = ["Partidas|" + s.partidas, "Vitórias|" + s.vitorias, "Derrotas|" + s.derrotas, "Eliminações|" + s.kills, "Assistências|" + s.assists, "Dano|" + s.dano, "Tempo (s)|" + s.tempo, "Melhor posição|" + (s.melhorPos || "—")]
      .map(x => { const [k, v] = x.split("|"); return "<div class=stat><b>" + v + "</b><small>" + k + "</small></div>"; }).join("");
    $("histList").innerHTML = PROF.hist.length ? PROF.hist.map(h => "<div class=hrow><span>#" + h.pos + " • " + h.modo + " • " + h.arena + "</span><span>+" + h.xp + " XP • +" + h.coins + " 🪙 • " + h.kills + " kills</span></div>").join("") : "<p class=muted>Nenhuma partida ainda.</p>";
  }
  function bindConfig() {
    on("saveCfgBtn", () => {
      PROF.name = ($("cfgName").value || PROF.name).slice(0, 16);
      PROF.cfg.som = $("cfgSom").checked;
      PROF.cfg.qualidade = $("cfgQual").value;
      try { if ($("cfgServer")) { localStorage.setItem("stickArenaServer", $("cfgServer").value.trim()); } } catch (e) {}
      window.SA_PROFILE.save(PROF); refreshProfile();
      const p = LOBBY.players.find(p => p.isMe); if (p) p.name = PROF.name;
      toast("Configurações salvas! Recarregue para trocar de servidor.");
    });
    $("cfgSom").checked = PROF.cfg.som !== false;
    $("cfgQual").value = PROF.cfg.qualidade || "alta";
    try { if ($("cfgServer")) $("cfgServer").value = localStorage.getItem("stickArenaServer") || ""; } catch (e) {}
  }

  // ---------- net ----------
  async function initNet() {
    NET = new window.SA_NET.Net();
    try { window.SA_NET.rt = NET; } catch (e) {}
    NET.onEvent = (m) => {
      if (m.t === "room") { LOBBY.code = m.code; $("roomCode").textContent = m.code; NET.code = m.code; LOBBY.isHost = (m.host === NET.myId); renderLobbyPlayers(); }
      else if (m.t === "players") {
        REMOTE = {};
        const list = m.list || m.players || [];
        list.forEach(p => { if (p.id !== NET.myId && p.id !== "me") REMOTE[p.id] = Object.assign({ tx: p.x || 200, ty: p.y || 200 }, p); });
        syncRemotePlayers();
      }
      else if (m.t === "start") { LOBBY.modo = m.modo; LOBBY.arena = m.arena; toast("Anfitrião iniciou!"); startMatch(); }
      else if (m.t === "toast") toast(m.msg || m.text || "Aviso");
      else if (m.t === "pos" && GAME && LOBBY.playMode === "online") applyRemote(m);
      else if (m.t === "atk" && GAME && LOBBY.playMode === "online") applyRemoteAtk(m);
    };
    const ok = await NET.connect();
    $("netStatus").textContent = ok ? (NET.backend === "sio" ? "● online (Render)" : "● online") : "● offline";
    $("netStatus").style.color = ok ? "#22c55e" : "#f59e0b";
    NET.code = LOBBY.code;
  }
  function syncRemotePlayers() {
    if (LOBBY.playMode !== "online") return;
    const me = meEntry();
    me.id = NET.myId; me.isHost = LOBBY.isHost;
    LOBBY.players = [me];
    for (const id in REMOTE) {
      if (LOBBY.players.length >= 8) break;
      LOBBY.players.push({ id, name: REMOTE[id].name || "Online", classe: REMOTE[id].classe || "guerreiro", isHost: false });
    }
    renderLobbyPlayers();
  }
  function applyRemote(m) {
    if (!GAME || m.id === NET.myId) return;
    let f = GAME.fighters.find(f => f.id === m.id);
    if (!f) {
      f = GAME.addFighter({ id: m.id, name: (REMOTE[m.id] || {}).name || m.name || "Online", classe: (REMOTE[m.id] || {}).classe || m.classe || "guerreiro", x: m.x, y: m.y, armaIdx: 0 });
      GAME.spawn(f);
    }
    // interpola: guarda alvo, o loop aproxima (evita teleporte)
    f._tx = m.x; f._ty = m.y; f._tvx = m.vx || 0; f._tvy = m.vy || 0;
    f.dir = m.dir === -1 ? -1 : 1;
    if (typeof m.arma === "number") f.armaIdx = m.arma;
    if (typeof m.hp === "number" && !f.dead) f.hp = Math.max(0, Math.min(f.maxhp, m.hp));
    if (m.anim) f.anim = m.anim;
    f._remoteTs = performance.now();
  }
  function applyRemoteAtk(m) {
    if (!GAME) return;
    const f = GAME.fighters.find(f => f.id === m.id);
    if (!f || f.dead) return;
    // espelha o ataque remoto localmente (visual); dano real é simulado igual p/ todos
    const keep = GAME.localId;
    GAME.localId = "__none__";
    const cx = f;
    try { GAME.tryAttack.call(GAME, cx); } catch (e) {}
    GAME.localId = keep;
  }

  // ---------- partida ----------
  function startMatch() {
    window.SA_UI.show("screen-game");
    const cv = $("gameCv");
    const localId = (LOBBY.playMode === "online" && NET && NET.online) ? NET.myId : "me";
    fitCanvas();
    GAME = new window.SA_ENGINE.Game(cv, { arena: LOBBY.arena, modo: LOBBY.modo, localId, qualidade: PROF.cfg.qualidade, diff: LOBBY.diff });
    GAME.onKill = ({ killer, victim, arma }) => window.SA_UI.killfeed("<b>" + escapeHtml(killer) + "</b> ⚔️ " + escapeHtml(victim));
    GAME.onEnd = endMatch;
    const teamOf = (i) => LOBBY.modo === "equipes" ? (i % 2) : 0;
    LOBBY.players.forEach((p, i) => {
      const isMe = !!p.isMe;
      const cls = isMe ? LOBBY.classe : p.classe;
      const f = GAME.addFighter({
        id: isMe ? localId : p.id, name: p.name, classe: cls,
        armaIdx: isMe ? LOBBY.armaIdx : (i % 5), team: teamOf(i),
        isBot: LOBBY.playMode === "offline" ? (!isMe) : false,
        x: GAME.spawnPts[i % GAME.spawnPts.length], y: 200,
        vidas: C().MODOS[LOBBY.modo].vidas,
      });
      if (!isMe) f.hp = f.maxhp;
    });
    GAME.fighters.forEach(f => GAME.spawn(f));
    $("hudArena").textContent = C().ARENAS[LOBBY.arena].nome;
    $("hudModo").textContent = C().MODOS[LOBBY.modo].nome + (LOBBY.playMode === "offline" ? " • OFFLINE " + LOBBY.diff : " • ONLINE " + LOBBY.code);
    startLoop();
    toast(C().MODOS[LOBBY.modo].nome + " em " + C().ARENAS[LOBBY.arena].nome + "!");
  }
  window.SA_DEBUG = { getGAME: () => GAME, lobby: LOBBY, input: INPUT };
  function endMatch({ motivo, ordem, winner }) {
    try {
      cancelAnimationFrame(RAF); RAF = 0;
      const localId = GAME.localId;
      const me = GAME.fighters.find(f => f.id === localId);
      const pos = Math.max(1, ordem.findIndex(f => f.id === localId) + 1);
      let vitoria = false;
      if (GAME.modo === "equipes") vitoria = (typeof winner === "number" && me && me.team === winner);
      else vitoria = !!(winner && winner.id === localId);
      const res = window.SA_PROFILE.applyMatch(PROF, {
        pos, kills: me ? me.kills : 0, assists: me ? me.assists : 0, dano: me ? me.dano : 0,
        tempoS: me ? me.tempoVivo : 0, vitoria, modo: LOBBY.modo, arena: LOBBY.arena,
      }, C());
      refreshProfile(); renderStats();
      window.SA_UI.show("screen-end");
      $("endTitle").textContent = vitoria ? "🏆 VITÓRIA!" : "FIM DE PARTIDA";
      $("endWinner").textContent = winner && winner.name ? ("Vencedor: " + winner.name) : (winner === -1 ? "Empate entre equipes" : "");
      $("endRewards").innerHTML = "<div class=stat><b>+" + res.xp + " XP</b><small>" + (res.up ? "UP! +" + res.up + " nível" : "experiência") + "</small></div><div class=stat><b>+" + res.coins + " 🪙</b><small>moedas</small></div><div class=stat><b>" + (res.dr >= 0 ? "+" : "") + res.dr + "</b><small>rating</small></div>";
      const tb = $("endTable"); tb.innerHTML = "";
      ordem.forEach((f, i) => {
        const tr = document.createElement("div"); tr.className = "rrow" + (f.id === localId ? " me" : "");
        tr.innerHTML = "<span>#" + (i + 1) + " " + (GAME.modo === "equipes" ? (f.team === 0 ? "🔵" : "🔴") + " " : "") + escapeHtml(f.name) + "</span><span>" + f.kills + "K • " + f.assists + "A</span>";
        tb.appendChild(tr);
      });
    } catch (err) { try { window.SA_UI.show("screen-end"); } catch (e2) {} }
  }
  function bindEnd() {
    on("againBtn", () => {
      if (LOBBY.playMode === "offline") { ensureBots(1 + LOBBY.nBots); startMatch(); }
      else startMatch();
    });
    on("lobbyBtn", () => { window.SA_UI.show("screen-lobby"); refreshLobby(); });
  }

  // ---------- loop 60Hz fixo ----------
  let posTick = 0;
  function startLoop() {
    cancelAnimationFrame(RAF);
    LAST = performance.now(); ACC = 0;
    const STEP = 1000 / 60;
    const frame = (now) => {
      RAF = requestAnimationFrame(frame);
      let dt = now - LAST; LAST = now;
      if (dt > 120) dt = 120;
      ACC += dt;
      pollKeys();
      let n = 0;
      while (ACC >= STEP && n < 4) {
        const inp = Object.assign({}, INPUT);
        // interpola remotos antes de cada step
        if (LOBBY.playMode === "online") {
          for (const f of GAME.fighters) {
            if (f.id === GAME.localId || f._tx === undefined) continue;
            f.x += (f._tx - f.x) * 0.35;
            f.y += (f._ty - f.y) * 0.35;
          }
        }
        GAME.update(inp, LOBBY.diff);
        INPUT.jumpPressed = false; INPUT.armaTroca = false;
        INPUT.power = INPUT.powerEdge; INPUT.powerEdge = false;
        if (INPUT.atkEdge) { INPUT.atk = true; INPUT.atkEdge = false; setTimeout(() => INPUT.atk = joyAtkHeld || keyAtkHeld, 90); }
        ACC -= STEP; n++;
      }
      if (n === 4) ACC = 0;
      GAME.render();
      updateHUD();
      if (NET && NET.online && GAME && !GAME.over && LOBBY.playMode === "online") {
        posTick++;
        if (posTick % 5 === 0) { const m = GAME.me(); if (m && !m.dead) NET.pos(Object.assign({}, m, { name: PROF.name, classe: m.classe })); }
      }
    };
    RAF = requestAnimationFrame(frame);
  }
  function updateHUD() {
    if (!GAME) return;
    const me = GAME.me();
    if (me) {
      $("hudHp").style.width = Math.max(0, me.hp / me.maxhp * 100) + "%";
      $("hudHpTxt").textContent = Math.ceil(Math.max(0, me.hp)) + "/" + me.maxhp;
      $("hudWpn").textContent = me.weapon().nome;
      const pc = me.poderCd > 0 ? Math.ceil(me.poderCd / 60) + "s" : "PRONTO";
      $("hudPow").textContent = C().CLASSES[me.classe].poderNome + " • " + pc;
      $("hudKda").textContent = me.kills + "K • " + me.assists + "A";
    }
    const top = [...GAME.fighters].sort((a, b) => b.kills - a.kills).slice(0, 3);
    $("hudScore").innerHTML = top.map(f => escapeHtml(f.name.split(" ")[0]) + " " + f.kills + "K").join(" • ");
    const t = GAME.restante;
    if ($("hudTime")) $("hudTime").textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  }

  // ---------- controles ----------
  let joyAtkHeld = false, keyAtkHeld = false;
  function on(id, fn) { const e = $(id); if (e) e.addEventListener("click", () => { try { fn(); window.SA_SFX("click"); } catch (err) {} }); }
  function toast(m) { window.SA_UI.toast(m); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  const keys = {};
  function pollKeys() {
    const l = keys["a"] || keys["arrowleft"], r = keys["d"] || keys["arrowright"];
    const jx = (r ? 1 : 0) - (l ? 1 : 0);
    if (!JOY.active) INPUT.x = jx;
    INPUT.down = !!(keys["s"] || keys["arrowdown"]) || JOY.down;
    INPUT.atk = joyAtkHeld || keyAtkHeld || INPUT.atk;
  }
  function bindControls() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      keys[k] = true;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === "w" || k === "arrowup" || k === " ") { if (!INPUT.jump) { INPUT.jump = true; INPUT.jumpPressed = true; } }
      if (k === "j") keyAtkHeld = true;
      if (k === "k" || k === "q") INPUT.powerEdge = true;
      if (k === "e") INPUT.armaTroca = true;
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase(); keys[k] = false;
      if (k === "w" || k === "arrowup" || k === " ") INPUT.jump = false;
      if (k === "j") keyAtkHeld = false;
    });
    document.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.id === "gameCv") keyAtkHeld = true;
    });
    document.addEventListener("pointerup", () => { keyAtkHeld = false; });
    bindHold("atkBtn", (v) => joyAtkHeld = v);
    on("powBtn", () => { INPUT.powerEdge = true; });
    on("jumpBtn", () => { INPUT.jump = true; INPUT.jumpPressed = true; setTimeout(() => INPUT.jump = false, 130); });
    on("wpnBtn", () => {
      INPUT.armaTroca = true;
      try { toast("Arma: " + GAME.me().weapon().nome); } catch (e) {}
    });
    const base = $("joyBase"), stick = $("joyStick");
    if (!base || !stick) return;
    const setStick = (dx, dy) => {
      const m = 44;
      const len = Math.hypot(dx, dy);
      const cl = len > m ? m / len : 1;
      stick.style.transform = "translate(" + dx * cl + "px," + dy * cl + "px)";
      JOY.dx = dx * cl; JOY.dy = dy * cl;
      INPUT.x = Math.abs(JOY.dx) > 10 ? Math.sign(JOY.dx) * Math.min(1, Math.abs(JOY.dx) / 40) : 0;
      JOY.down = JOY.dy > 22;
      if (JOY.dy < -24 && !JOY.jumpSent) { JOY.jumpSent = true; INPUT.jump = true; INPUT.jumpPressed = true; setTimeout(() => INPUT.jump = false, 130); }
      if (JOY.dy > -10) JOY.jumpSent = false;
      JOY.active = true;
    };
    const resetStick = () => { stick.style.transform = "translate(0,0)"; JOY.dx = JOY.dy = 0; INPUT.x = 0; JOY.down = false; JOY.active = false; JOY.jumpSent = false; };
    base.addEventListener("pointerdown", (e) => { JOY.id = e.pointerId; const r = base.getBoundingClientRect(); JOY.cx = r.left + r.width / 2; JOY.cy = r.top + r.height / 2; try { base.setPointerCapture(e.pointerId); } catch (err) {} setStick(e.clientX - JOY.cx, e.clientY - JOY.cy); });
    base.addEventListener("pointermove", (e) => { if (e.pointerId === JOY.id) setStick(e.clientX - JOY.cx, e.clientY - JOY.cy); });
    const up = (e) => { if (e.pointerId === JOY.id) { JOY.id = null; resetStick(); } };
    base.addEventListener("pointerup", up); base.addEventListener("pointercancel", up);
  }
  function bindHold(id, fn) {
    const e = $(id); if (!e) return;
    e.addEventListener("pointerdown", (ev) => { ev.preventDefault(); fn(true); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => e.addEventListener(ev, () => fn(false)));
  }
  function fitCanvas() {
    const cv = $("gameCv"); if (!cv) return;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = 960, h = 540;
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        // mantém lógica 960x540, só melhora nitidez
        cv.getContext("2d").setTransform(1, 0, 0, 1, 0, 0);
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
