# STICK ARENA — por Lucas ⚔️

Batalha 2D de stickmen: 4 classes, 20 armas com visual próprio, 5 arenas, 4 modos.
- 🤖 OFFLINE: você + bots (1–7, Fácil/Normal/Difícil)
- 🌐 ONLINE: com amigos por código de 6 letras (servidor no Render)

Criador: **Lucas**

## Jogar local
Só abrir `index.html` (ou `npx serve .`).

## Publicar — GitHub Pages (client)
1. Crie repo `stick-arena` no GitHub
2. Suba estes arquivos (raiz do repo): `index.html`, `src/`, `client/`, `README.md`
3. Repo > Settings > Pages > Deploy from branch > main / root
4. URL: `https://SEU-USUARIO.github.io/stick-arena/`

## Publicar — Render (server)
1. Suba a pasta `server/` junto (ou repo separado) — o Render usa `server/package.json`
2. https://dashboard.render.com > New > Web Service > conecte o repo
   - Build: `npm install --prefix server`
   - Start: `npm start --prefix server`
   - Env: `CLIENT_URL=https://SEU-USUARIO.github.io/stick-arena`
3. Aguarde deploy, teste: `https://SEU-SERVICO.onrender.com/health` → `{"ok":true}`
4. No jogo: ⚙️ CONFIG > Servidor Render > cole a URL > Salvar > recarregue. Ou edite `client/config-server.js`.

## Estrutura
```
index.html (launcher: entrada ONLINE/OFFLINE, lobby, game, HUD mobile)
src/config.js (classes/armas/arenas/modos — 20 designs)
src/engine.js (física 60Hz, coyote/buffer, shake, 20 desenhos de arma, bots)
src/net.js (dual: Socket.IO Render + server-plugin Perchance)
src/profile.js / ui.js / game.js (launcher, loop fixo, touch)
src/icon.jpg + manifest
client/config-server.js (URL do Render)
server/server.js + package.json (Socket.IO)
render.yaml
```
Teste Render grátis dorme após inatividade — primeira conexão demora ~30s.
