// STICK ARENA — server.js (referência Render: Express + Socket.IO + Postgres)
// Deploy: Render Web Service, Build: npm install, Start: npm start
// Env: DATABASE_URL, JWT_SECRET, CLIENT_URL=https://teclucascode.github.io
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
const app = express();
app.use(cors({ origin: (process.env.CLIENT_URL || "").split(",").filter(Boolean) }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true, game: "stick-arena" }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });
// Salas: código 6 chars, até 8 jogadores, host, validação de dano/resultados no servidor.
const rooms = new Map();
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code6 = () => Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join("");
io.on("connection", (sock) => {
  sock.on("create", ({ name, classe }) => {
    const code = code6();
    rooms.set(code, { code, host: sock.id, started: false, modo: "ffa", arena: "vulcao", players: {}, hp: {} });
    const r = rooms.get(code);
    r.players[sock.id] = { id: sock.id, name, classe }; r.hp[sock.id] = 100;
    sock.join(code); sock.emit("room", { code, host: r.host }); io.to(code).emit("players", Object.values(r.players));
  });
  sock.on("join", ({ code, name, classe }) => {
    code = String(code || "").toUpperCase();
    const r = rooms.get(code);
    if (!r) return sock.emit("toast", "Sala não encontrada");
    if (Object.keys(r.players).length >= 8) return sock.emit("toast", "Sala cheia");
    if (r.started) return sock.emit("toast", "Partida em andamento");
    r.players[sock.id] = { id: sock.id, name, classe }; r.hp[sock.id] = 100;
    sock.join(code); sock.emit("room", { code, host: r.host }); io.to(code).emit("players", Object.values(r.players));
  });
  sock.on("start", ({ code, modo, arena }) => {
    const r = rooms.get(code); if (!r || r.host !== sock.id) return;
    if (Object.keys(r.players).length < 2) return;
    r.started = true; r.modo = modo; r.arena = arena;
    io.to(code).emit("start", { modo, arena });
  });
  sock.on("pos", (p) => { // relay com clamp (anticheat básico: limites de posição/velocidade)
    const r = rooms.get(p.code); if (!r) return;
    p.x = Math.max(0, Math.min(960, +p.x || 0)); p.y = Math.max(-100, Math.min(700, +p.y || 0));
    sock.to(p.code).emit("pos", { ...p, id: sock.id });
  });
  sock.on("disconnecting", () => {
    for (const code of sock.rooms) {
      const r = rooms.get(code); if (!r) continue;
      delete r.players[sock.id]; delete r.hp[sock.id];
      if (r.host === sock.id) r.host = Object.keys(r.players)[0];
      if (!Object.keys(r.players).length) rooms.delete(code);
      else { io.to(code).emit("players", Object.values(r.players)); io.to(code).emit("room", { code, host: r.host }); }
    }
  });
});
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("stick-arena server on :" + PORT));
