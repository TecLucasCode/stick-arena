# STICK ARENA — README (GitHub Pages + Render)

Jogo multiplayer de navegador: batalha 2D lateral de stickmen com física, 4 classes, 20 armas, 5 arenas, 4 modos, XP/moedas/rating.

## Jogar aqui (Perchance)
Abra o gerador e toque em **JOGAR**. Funciona no celular e no PC, online (server-plugin) ou offline com bots.

## Publicar no GitHub Pages + Render (projeto original)
Este diretório `src/` contém o jogo completo sem dependências de build (Canvas 2D vanilla — mesma jogabilidade do plano Phaser+Matter, porém sem etapa de compilação, ideal para `/stick-arena/` no Pages).

- **Frontend (Pages):** sirva a raiz do repo como site estático. Use caminhos **relativos** (`src/...`), nunca absolutos, para funcionar em `teclucascode.github.io/stick-arena/`.
- **Backend (Render):** referência Node/Express+Socket.IO + Postgres em `src/github/server/` (`server.js`, `rooms.js`, `match.js`, `physics.js`, `database.js`, `ranking.js`, `schema.sql`, `package.json`). O cliente Perchance usa `server-plugin` como equivalente sem servidor próprio; para o deploy GitHub/Render, troque `src/net.js` pelo cliente Socket.IO (`src/github/client-net-socketio.js`) apontando para `https://stick-arena-server.onrender.com` via variável de ambiente.
- **Banco:** crie o Postgres no Render, rode `schema.sql`, configure `DATABASE_URL` e `JWT_SECRET` nas Environment Variables (nunca commite segredos).

## Estrutura
```
index.html            → telas + canvas + servidor server-plugin (salas 8j, host, validação)
main.pjs              → $meta + listas
src/config.js         → classes/armas/arenas/modos/pontos/ranking/loja  (= client/js/classes.js+weapons.js)
src/engine.js         → física + stickman 14 anims + combate + bots      (= physics.js+characters.js+animations.js)
src/profile.js        → XP/nível/moedas/stats/cosméticos                  (= interface perfil)
src/net.js            → salas online/offline, código 6 chars, host        (= network.js)
src/ui.js             → sons WebAudio + telas/HUD                         (= interface.js+scoreboard.js)
src/game.js           → lobby, partida, teclado+joystick, fim             (= main.js+game.js+controls.js)
src/github/           → referência deploy (server Node, schema, package)
```

## Fases entregues (1–9)
1. Estrutura + menu + conexão ✅ 2. Salas/lobby/classes ✅ 3. Arena 2D + joystick/teclado + anims ✅ 4. Física/colisão/combate ✅ 5. Armas/poderes ✅ 6. 5 arenas + 4 modos ✅ 7. Pontuação/XP/moedas ✅ 8. Ranking/perfil/persistência ✅ 9. Otimização mobile (qualidade baixa, partículas limitadas, touch 60Hz) ✅

## Balanceamento (editável em src/config.js)
kill 100, assistência 40, vitória 150, top2 50, top3 30, dano/10 = 1, rating: +24 vitória, +4/kill, −8 base.
