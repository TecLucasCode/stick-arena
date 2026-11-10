// STICK ARENA por Lucas — servidor multiplayer (Render + Socket.IO)
// Rode: npm install && npm start  |  Health: GET /health
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const CLIENT_URLS = (process.env.CLIENT_URL || "").split(",").map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: CLIENT_URLS.length ? CLIENT_URLS : true }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true, game: "stick-arena", by: "Lucas", time: new Date().toISOString() }));
app.get("/", (_req, res) => res.send("STICK ARENA por Lucas — servidor online. Use o client no GitHub Pages."));

const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });

const rooms = new Map(); // code -> {code, host, started, modo, arena, players:{sockId:{id,name,classe}}, seq}
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code6 = () => Array.from({length:6},()=>ABC[Math.floor(Math.random()*ABC.length)]).join("");
const clean = (s,n)=>String(s||"").slice(0,n||16);

function publicPlayers(r){ return Object.values(r.players); }

io.on("connection", (sock) => {
  sock.on("create", ({ name, classe }) => {
    const code = code6();
    rooms.set(code, { code, host: sock.id, started:false, modo:"ffa", arena:"vulcao", players:{}, seq:0 });
    const r = rooms.get(code);
    r.players[sock.id] = { id: sock.id, name: clean(name||"Jogador"), classe: clean(classe||"guerreiro") };
    sock.join(code);
    sock.emit("room", { code, host: r.host });
    io.to(code).emit("players", publicPlayers(r));
  });
  sock.on("join", ({ code, name, classe }) => {
    code = clean(code,6).toUpperCase();
    const r = rooms.get(code);
    if(!r) return sock.emit("toast","Sala não encontrada");
    if(Object.keys(r.players).length>=8) return sock.emit("toast","Sala cheia (8/8)");
    if(r.started) return sock.emit("toast","Partida em andamento");
    r.players[sock.id] = { id: sock.id, name: clean(name||"Online"), classe: clean(classe||"guerreiro") };
    sock.join(code);
    sock.emit("room", { code, host: r.host });
    io.to(code).emit("players", publicPlayers(r));
  });
  sock.on("classe", ({ classe }) => {
    for(const [code,r] of rooms){ if(r.players[sock.id] && !r.started){ r.players[sock.id].classe = clean(classe||"guerreiro"); io.to(code).emit("players", publicPlayers(r)); } }
  });
  sock.on("start", ({ code, modo, arena }) => {
    code = clean(code,6).toUpperCase();
    const r = rooms.get(code); if(!r || r.host!==sock.id) return;
    if(Object.keys(r.players).length<2 && r.players[sock.id]) { /* permite solo? exige 1 */ }
    r.started = true; r.modo = clean(modo||"ffa",16); r.arena = clean(arena||"vulcao",16);
    io.to(code).emit("start", { modo: r.modo, arena: r.arena });
  });
  // compat com client net.js que manda t:pos/t:atk via emit(t, o)
  sock.on("pos", (p) => relayPos(sock,p));
  sock.on("t", ()=>{});
  sock.onAny((ev, p)=>{
    if(ev==="pos") relayPos(sock,p);
    if(ev==="atk"){
      const r = rooms.get(clean(p&&p.code,6).toUpperCase()); if(!r||!r.started) return;
      r.seq++;
      sock.to(p.code).emit("atk", { t:"atk", id: sock.id, seq: r.seq, arma:(p.arma|0), x:(p.x|0), y:(p.y|0), dir:(p.dir===1?1:-1) });
    }
    if(ev==="hello") sock.emit("room", { code:null, host:null });
  });
  function relayPos(sock,p){
    if(!p||!p.code) return;
    const code = clean(p.code,6).toUpperCase();
    const r = rooms.get(code); if(!r) return;
    if(!r.players[sock.id]) return;
    const x = Math.max(0,Math.min(960,+p.x||0)), y = Math.max(-100,Math.min(700,+p.y||0));
    sock.to(code).emit("pos", { t:"pos", id: sock.id, name: clean(p.name||r.players[sock.id].name), classe: clean(p.classe||r.players[sock.id].classe), x:Math.round(x), y:Math.round(y), vx:+p.vx||0, vy:+p.vy||0, hp:Math.round(+p.hp||100), dir:(p.dir===1?1:-1), anim:clean(p.anim||"idle",10), arma:(p.arma|0) });
  }
  sock.on("disconnecting", () => {
    for(const code of sock.rooms){
      const r = rooms.get(code); if(!r) continue;
      delete r.players[sock.id];
      if(r.host===sock.id) r.host = Object.keys(r.players)[0];
      if(!Object.keys(r.players).length) rooms.delete(code);
      else { io.to(code).emit("players", publicPlayers(r)); io.to(code).emit("room",{code,host:r.host}); }
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log("stick-arena por Lucas on :"+PORT));
