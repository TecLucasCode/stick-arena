/* STICK ARENA por Lucas — net.js: ONLINE (Socket.IO no GitHub/Render OU server-plugin no Perchance) + OFFLINE local.
   Mesma API nos dois: connect/createRoom/joinRoom/setClasse/startMatch/pos/atk. */
(function () {
  "use strict";
  function code6() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  class Net {
    constructor() {
      this.mode = "local"; this.socket = null; this.sio = null;
      this.code = null; this.myId = "p" + Math.random().toString(36).slice(2, 9);
      this.players = []; this.isHost = true; this.online = false;
      this.onEvent = null; this.backend = "local";
    }
    serverUrl() {
      try {
        if (window.SA_SERVER_URL) return window.SA_SERVER_URL;
        const q = new URLSearchParams(location.search);
        if (q.get("server")) return q.get("server");
        const saved = localStorage.getItem("stickArenaServer");
        if (saved) return saved;
      } catch (e) {}
      return "";
    }
    async connect() {
      // 1) tenta Socket.IO (GitHub/Render) se houver URL configurada ou io global
      const url = this.serverUrl();
      try {
        if (url && window.io) {
          const s = window.io(url, { transports: ["websocket", "polling"] });
          const ok = await new Promise((res) => {
            const to = setTimeout(() => res(false), 6000);
            s.on("connect", () => { clearTimeout(to); res(true); });
            s.on("connect_error", () => {});
          });
          if (ok) {
            this.sio = s; this.mode = "online-sio"; this.online = true; this.backend = "sio";
            this.myId = s.id || this.myId;
            ["room", "players", "start", "pos", "atk", "toast", "disc"].forEach((ev) =>
              s.on(ev, (d) => this.emit(typeof d === "string" ? { t: ev, msg: d } : Object.assign({ t: ev }, d || {})))
            );
            // normaliza: servidor manda {code,host} em "room"
            s.on("room", (d) => this.emit({ t: "room", code: d.code, host: d.host }));
            s.on("players", (list) => this.emit({ t: "players", list }));
            s.on("start", (d) => this.emit({ t: "start", modo: d.modo, arena: d.arena }));
            s.on("pos", (d) => this.emit(Object.assign({ t: "pos" }, d)));
            s.on("atk", (d) => this.emit(Object.assign({ t: "atk" }, d)));
            s.on("toast", (m) => this.emit({ t: "toast", msg: typeof m === "string" ? m : (m && m.msg) || "Aviso" }));
            s.on("disconnect", () => { this.online = false; this.emit({ t: "disc" }); });
            return true;
          }
        }
      } catch (e) {}
      // 2) tenta server-plugin (Perchance)
      try {
        const root = window.root || null;
        const fac = root && root.createServerSocket ? root.createServerSocket : null;
        if (fac) {
          const s = fac();
          this.socket = s;
          try { s.binaryType = "arraybuffer"; } catch (e) {}
          s.addEventListener("message", (ev) => this._msg(ev.data));
          s.addEventListener("close", () => { this.online = false; this.emit({ t: "disc" }); });
          if (s.opened) await s.opened;
          else await new Promise((res, rej) => { s.addEventListener("open", res, { once: true }); setTimeout(() => rej(new Error("timeout")), 6000); });
          this.mode = "online"; this.online = true; this.backend = "perchance";
          return true;
        }
      } catch (e) {}
      this.mode = "local"; this.online = false; this.backend = "local";
      return false;
    }
    emit(e) { if (this.onEvent) { try { this.onEvent(e); } catch (err) {} } }
    _msg(data) {
      let m = null;
      try { m = typeof data === "string" ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data)); }
      catch (e) { return; }
      this.emit(m);
    }
    send(o) {
      if (this.backend === "sio" && this.sio) { try { this.sio.emit(o.t === "pos" ? "pos" : o.t === "atk" ? "atk" : o.t, o); } catch (e) {} return; }
      if (this.online && this.socket && this.socket.readyState === 1) {
        try { this.socket.send(JSON.stringify(o)); } catch (e) {}
      }
    }
    hello(name, classe) { this.send({ t: "hello", id: this.myId, name, classe }); }
    createRoom(name, classe) {
      if (this.backend === "sio" && this.sio) this.sio.emit("create", { name, classe });
      else this.send({ t: "create", id: this.myId, name, classe });
    }
    joinRoom(code, name, classe) {
      code = String(code || "").toUpperCase();
      if (this.backend === "sio" && this.sio) this.sio.emit("join", { code, name, classe });
      else this.send({ t: "join", id: this.myId, code, name, classe });
    }
    setClasse(c) {
      if (this.backend === "sio" && this.sio) this.sio.emit("classe", { classe: c });
      else this.send({ t: "classe", id: this.myId, classe: c });
    }
    startMatch(modo, arena) {
      if (this.backend === "sio" && this.sio) this.sio.emit("start", { code: this.code, modo, arena });
      else this.send({ t: "start", id: this.myId, modo, arena });
    }
    pos(p) {
      const o = { t: "pos", id: this.myId, code: this.code, x: Math.round(p.x), y: Math.round(p.y), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), hp: Math.round(p.hp), dir: p.dir, anim: p.anim, arma: p.armaIdx, name: p.name, classe: p.classe };
      this.send(o);
    }
    atk(a) { this.send({ t: "atk", id: this.myId, code: this.code, arma: a.arma, x: Math.round(a.x), y: Math.round(a.y), dir: a.dir }); }
  }
  const api = { Net, code6 };
  if (typeof window !== "undefined") window.SA_NET = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
