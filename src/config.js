/* STICK ARENA por Lucas — config.js
   Dados de classes, 20 armas (cada uma com design próprio), arenas, modos, ranking, loja.
   Usado pelo Perchance (src/) e pelo export GitHub (client/). Sem dependências. */
(function () {
  "use strict";
  // design = chave usada pelo engine.js para desenhar a arma de forma única no canvas
  const WEAPONS = {
    guerreiro: [
      { id: "espada", nome: "Espada Gigante", tipo: "melee", dmg: 17, alcance: 80, cd: 420, kb: 9, cor: "#ff5a5a", design: "espadao", desc: "Lâmina larga rosa-vermelha." },
      { id: "martelo", nome: "Martelo de Guerra", tipo: "melee", dmg: 24, alcance: 68, cd: 850, kb: 14, cor: "#ff9a3c", design: "martelo", desc: "Cabeça dupla laranja, arremessa longe." },
      { id: "machado_duplo", nome: "Machado Duplo", tipo: "melee", dmg: 12, alcance: 72, cd: 360, kb: 7, cor: "#ffb3b3", design: "machado_duplo", hits: 2, desc: "Dois machadinhos, 2 golpes." },
      { id: "machado_pesado", nome: "Machado Pesado", tipo: "melee", dmg: 30, alcance: 74, cd: 1100, kb: 16, cor: "#c81e1e", design: "machado_pesado", desc: "Lâmina vermelho-sangue, lento e brutal." },
      { id: "escudo", nome: "Escudo de Impacto", tipo: "melee", dmg: 10, alcance: 60, cd: 500, kb: 19, cor: "#7dd3fc", design: "escudo", block: true, desc: "Torre azul, empurra e bloqueia de frente." },
    ],
    mago: [
      { id: "fogo", nome: "Cajado de Fogo", tipo: "proj", dmg: 13, alcance: 420, cd: 620, kb: 6, cor: "#ff6b1a", design: "cajado_fogo", projSpeed: 7.5, projR: 6, burn: 3, desc: "Orbe laranja com chamas." },
      { id: "gelo", nome: "Cajado de Gelo", tipo: "proj", dmg: 10, alcance: 400, cd: 520, kb: 4, cor: "#7dd3fc", design: "cajado_gelo", projSpeed: 8, projR: 5, slow: 2.2, desc: "Cristal azul que desacelera." },
      { id: "raio", nome: "Cajado Elétrico", tipo: "proj", dmg: 14, alcance: 360, cd: 700, kb: 7, cor: "#facc15", design: "cajado_raio", projSpeed: 11, projR: 4, chain: true, desc: "Ponta amarela em raio." },
      { id: "orbe", nome: "Orbe Explosivo", tipo: "proj", dmg: 21, alcance: 300, cd: 1050, kb: 12, cor: "#c084fc", design: "orbe", projSpeed: 5, projR: 8, aoe: 90, desc: "Esfera roxa que explode em área." },
      { id: "grav", nome: "Varinha Gravitacional", tipo: "proj", dmg: 8, alcance: 320, cd: 850, kb: -10, cor: "#f0abfc", design: "varinha_grav", projSpeed: 6, projR: 7, pull: true, desc: "Espiral rosa que puxa o inimigo." },
    ],
    atirador: [
      { id: "arco", nome: "Arco Longo", tipo: "proj", dmg: 13, alcance: 520, cd: 580, kb: 5, cor: "#a3e635", design: "arco_longo", projSpeed: 10, projR: 4, desc: "Arco verde clássico, flecha rápida." },
      { id: "besta", nome: "Besta", tipo: "proj", dmg: 18, alcance: 460, cd: 900, kb: 8, cor: "#65a30d", design: "besta", projSpeed: 9, projR: 5, desc: "Besta pesada verde-escura." },
      { id: "arco_exp", nome: "Arco Explosivo", tipo: "proj", dmg: 23, alcance: 380, cd: 1250, kb: 13, cor: "#fb923c", design: "arco_explosivo", projSpeed: 6.5, projR: 6, aoe: 80, desc: "Arco laranja com ponta-bomba." },
      { id: "bumer", nome: "Bumerangue", tipo: "proj", dmg: 11, alcance: 420, cd: 780, kb: 7, cor: "#fde047", design: "bumerangue", projSpeed: 8, projR: 7, boomerang: true, hits: 2, desc: "Meia-lua amarela que vai e volta." },
      { id: "dardos", nome: "Lança-Dardos", tipo: "proj", dmg: 7, alcance: 360, cd: 460, kb: 3, cor: "#86efac", design: "lanca_dardos", projSpeed: 9.5, projR: 3, spread: 3, desc: "Tubo verde com 3 canos em leque." },
    ],
    engenheiro: [
      { id: "canhao", nome: "Canhão Portátil", tipo: "proj", dmg: 19, alcance: 380, cd: 1000, kb: 11, cor: "#94a3b8", design: "canhao", projSpeed: 7, projR: 7, aoe: 70, desc: "Tubo cinza que cospe bala em arco." },
      { id: "minas", nome: "Lançador de Minas", tipo: "mina", dmg: 25, alcance: 200, cd: 1150, kb: 12, cor: "#f43f5e", design: "lancador_minas", desc: "Caixa vermelha que planta mina com luz piscando." },
      { id: "martelo_el", nome: "Martelo Elétrico", tipo: "melee", dmg: 15, alcance: 68, cd: 680, kb: 8, cor: "#22d3ee", design: "martelo_eletrico", stun: 0.9, desc: "Martelo ciano com bobina, atordoa." },
      { id: "foguetes", nome: "Lança-Foguetes", tipo: "proj", dmg: 26, alcance: 480, cd: 1450, kb: 14, cor: "#fb7185", design: "lanca_foguetes", projSpeed: 5.5, projR: 7, aoe: 95, desc: "Bazuca rosa com cone e chama." },
      { id: "ima", nome: "Ímã Magnético", tipo: "proj", dmg: 9, alcance: 300, cd: 820, kb: -12, cor: "#38bdf8", design: "ima", projSpeed: 6, projR: 9, pull: true, desc: "Ferradura azul que puxa metal." },
    ],
  };
  const CLASSES = {
    guerreiro: { id: "guerreiro", nome: "GUERREIRO", cor: "#ef4444", glow: "#fca5a5", hp: 120, speed: 3.3, jump: 13.0, peso: 1.12, poder: "furia", poderNome: "FÚRIA", poderCd: 15, poderDesc: "+60% dano por 6s", icone: "⚔️" },
    mago: { id: "mago", nome: "MAGO", cor: "#a855f7", glow: "#d8b4fe", hp: 90, speed: 3.0, jump: 12.6, peso: 0.92, poder: "teleporte", poderNome: "TELEPORTE", poderCd: 12, poderDesc: "Pisca 260px p/ onde anda", icone: "🔮" },
    atirador: { id: "atirador", nome: "ATIRADOR", cor: "#22c55e", glow: "#bbf7d0", hp: 95, speed: 3.7, jump: 12.8, peso: 0.95, poder: "reflexo", poderNome: "REFLEXO", poderCd: 13, poderDesc: "Dash + velocidade 4s", icone: "🏹" },
    engenheiro: { id: "engenheiro", nome: "ENGENHEIRO", cor: "#f59e0b", glow: "#fde68a", hp: 105, speed: 3.1, jump: 12.7, peso: 1.04, poder: "torreta", poderNome: "TORRETA", poderCd: 18, poderDesc: "Torreta aliada 20s", icone: "⚙️" },
  };
  const ARENAS = {
    vulcao: { id: "vulcao", nome: "VULCÃO", sub: "Lava e fogo", ceu: ["#1a0533", "#3b0a2a", "#7c2d12"], chao: "#2a0f1e", plat: "#4c1d2e", detalhe: "#ff5a1f", gelo: 0, plats: [{ x: 60, y: 400, w: 150 }, { x: 330, y: 330, w: 140 }, { x: 560, y: 330, w: 140 }, { x: 750, y: 400, w: 150 }, { x: 400, y: 230, w: 160 }], lava: [{ x: 230, y: 500, w: 120 }, { x: 610, y: 500, w: 120 }], desc: "Lava: 25 dano + arremesso." },
    gelo: { id: "gelo", nome: "GELO", sub: "Tudo escorrega", ceu: ["#020617", "#0c4a6e", "#155e75"], chao: "#0f2a3d", plat: "#164e63", detalhe: "#7dd3fc", gelo: 1, plats: [{ x: 80, y: 390, w: 170 }, { x: 340, y: 310, w: 150 }, { x: 560, y: 310, w: 150 }, { x: 730, y: 390, w: 150 }, { x: 420, y: 215, w: 120 }], geloChao: true, desc: "Atrito baixo, controle o deslize." },
    floresta: { id: "floresta", nome: "FLORESTA", sub: "Plataformas que cedem", ceu: ["#04140a", "#14532d", "#166534"], chao: "#14280f", plat: "#2d5a1e", detalhe: "#a3e635", gelo: 0, plats: [{ x: 60, y: 395, w: 140, fragil: true }, { x: 300, y: 330, w: 130 }, { x: 530, y: 330, w: 130 }, { x: 760, y: 395, w: 140, fragil: true }, { x: 405, y: 225, w: 150, fragil: true }], desc: "Frágil cai após ~1,2s pisando." },
    cyber: { id: "cyber", nome: "CYBER", sub: "Móveis + laser", ceu: ["#050114", "#1e1b4b", "#312e81"], chao: "#12122b", plat: "#23235c", detalhe: "#22d3ee", gelo: 0, plats: [{ x: 120, y: 380, w: 130, movel: { dx: 130, t: 4 } }, { x: 560, y: 380, w: 130, movel: { dx: -130, t: 4 } }, { x: 405, y: 290, w: 150, movel: { dy: 70, t: 3 } }, { x: 200, y: 220, w: 110 }, { x: 650, y: 220, w: 110 }], laser: { x: 430, y: 500, w: 100, ciclo: 5 }, desc: "Laser liga/desliga. Plataformas movem." },
    deserto: { id: "deserto", nome: "DESERTO", sub: "Vento + areia", ceu: ["#160b02", "#7c2d12", "#b45309"], chao: "#2b1a08", plat: "#6b4a1f", detalhe: "#fbbf24", gelo: 0, vento: true, plats: [{ x: 70, y: 395, w: 150 }, { x: 330, y: 320, w: 140 }, { x: 560, y: 320, w: 140 }, { x: 740, y: 395, w: 150 }, { x: 410, y: 220, w: 140 }], areia: [{ x: 380, y: 500, w: 200 }], desc: "Rajadas empurram + areia puxa." },
  };
  const MODOS = {
    ffa: { id: "ffa", nome: "TODOS CONTRA TODOS", desc: "Mais kills em 90s vence.", tempo: 90, vidas: Infinity },
    equipes: { id: "equipes", nome: "EQUIPES 🔵🔴", desc: "Time com mais kills em 90s vence.", tempo: 90, vidas: Infinity },
    sobrevivencia: { id: "sobrevivencia", nome: "SOBREVIVÊNCIA", desc: "1 vida. Último vivo vence.", tempo: 120, vidas: 1 },
    rei: { id: "rei", nome: "REI DA ARENA", desc: "Segure o círculo dourado até 100 pts.", tempo: 120, vidas: Infinity, zonaAlvo: 100 },
  };
  const SCORE = { kill: 100, assist: 40, win: 150, top2: 50, top3: 30, danoPor10: 1, survMin: 10, reiTick: 2 };
  const TIERS = [
    { id: "bronze", nome: "Bronze", min: 0, cor: "#cd7f32" },
    { id: "prata", nome: "Prata", min: 300, cor: "#cbd5e1" },
    { id: "ouro", nome: "Ouro", min: 700, cor: "#fbbf24" },
    { id: "platina", nome: "Platina", min: 1200, cor: "#67e8f9" },
    { id: "diamante", nome: "Diamante", min: 1800, cor: "#60a5fa" },
    { id: "mestre", nome: "Mestre", min: 2500, cor: "#e879f9" },
  ];
  const LOJA = [
    { id: "neon_azul", nome: "Rastro Neon Azul", tipo: "rastro", preco: 200, cor: "#22d3ee", desc: "Partículas azuis." },
    { id: "neon_rosa", nome: "Rastro Neon Rosa", tipo: "rastro", preco: 200, cor: "#f472b6", desc: "Partículas rosas." },
    { id: "fogo_trail", nome: "Rastro de Fogo", tipo: "rastro", preco: 450, cor: "#fb923c", desc: "Faíscas de fogo." },
    { id: "coroa", nome: "Coroa Dourada", tipo: "acessorio", preco: 500, desc: "Coroa sobre a cabeça." },
    { id: "chapeu", nome: "Chapéu Cyber", tipo: "acessorio", preco: 350, desc: "Chapéu futurista." },
    { id: "faixa", nome: "Faixa Ninja", tipo: "acessorio", preco: 250, desc: "Faixa ao vento." },
    { id: "dourada", nome: "Pele Dourada", tipo: "pele", preco: 800, cor: "#fbbf24", desc: "Stickman dourado." },
    { id: "sombra", nome: "Pele Sombra", tipo: "pele", preco: 600, cor: "#1e1b4b", desc: "Stickman sombrio." },
  ];
  const BOT_NAMES = ["Pixel", "Slash", "Vortex", "Ninja", "Bolt", "Kaze", "Ragnar", "Zed", "Luna", "Trovão", "Ghost", "Fang"];
  const DIFFS = {
    facil: { id: "facil", nome: "Fácil", reacao: 0.4, erro: 90, poder: 0.001 },
    normal: { id: "normal", nome: "Normal", reacao: 0.7, erro: 45, poder: 0.004 },
    dificil: { id: "dificil", nome: "Difícil", reacao: 1.0, erro: 18, poder: 0.009 },
  };
  const CREATOR = "Lucas";
  const api = { WEAPONS, CLASSES, ARENAS, MODOS, SCORE, TIERS, LOJA, BOT_NAMES, DIFFS, CREATOR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else if (typeof window !== "undefined") window.SA_CONFIG = api;
  else if (typeof self !== "undefined") self.SA_CONFIG = api;
})();
