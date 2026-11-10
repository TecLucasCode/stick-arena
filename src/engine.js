/* STICK ARENA — engine.js: física plataforma 2D, stickman procedural 14 animações, combate, bots, projéteis, perigos.
   Mundo lógico 960x540. Sem dependências externas. */
(function () {
  "use strict";
  const W = 960, H = 540, GROUND = 500, GRAV = 0.62;
  const CFG = () => window.SA_CONFIG;

  function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  class Fighter {
    constructor(o) {
      this.id = o.id; this.name = o.name || "CPU"; this.isBot = !!o.isBot; this.bot = o.bot || null;
      this.classe = o.classe || "guerreiro"; this.team = o.team || 0;
      this.x = o.x || 100; this.y = o.y || 300; this.w = 26; this.h = 54;
      this.vx = 0; this.vy = 0; this.dir = o.dir || 1;
      this.hp = 100; this.maxhp = 100; this.vidas = o.vidas ?? Infinity;
      this.noChao = false; this.pulos = 0; this.agach = false;
      this.armaIdx = o.armaIdx || 0; this.atkCd = 0; this.poderCd = 0; this.poderAtivo = 0;
      this.anim = "idle"; this.animT = 0; this.hurtT = 0; this.invT = 0; this.stun = 0; this.slow = 0; this.burn = 0; this.burnT = 0;
      this.dead = false; this.deadT = 0; this.kills = 0; this.assists = 0; this.dano = 0; this.tempoVivo = 0; this.pontosRei = 0;
      this.lastHitBy = null; this.hitByMap = {}; this.crouchH = 34;
      this.turretCd = 0;
      this.applyClass();
    }
    applyClass() {
      const c = CFG().CLASSES[this.classe];
      this.maxhp = c.hp; if (this.hp > this.maxhp) this.hp = this.maxhp;
      this.speed = c.speed; this.jumpV = c.jump; this.peso = c.peso;
    }
    weapon() { return CFG().WEAPONS[this.classe][this.armaIdx % 5]; }
    rect() { const h = this.agach ? this.crouchH : this.h; return { x: this.x, y: this.y + (this.h - h), w: this.w, h }; }
  }

  class Game {
    constructor(canvas, opts) {
      this.cv = canvas; this.ctx = canvas.getContext("2d");
      this.arenaId = opts.arena || "vulcao"; this.modo = opts.modo || "ffa";
      this.fighters = []; this.projs = []; this.parts = []; this.minas = []; this.turrets = [];
      this.floaters = []; this.time = 0; this.restante = (CFG().MODOS[this.modo] || CFG().MODOS.ffa).tempo;
      this.over = false; this.winner = null; this.fragil = {}; this.laserT = 0; this.ventoT = 0; this.ventoDir = 1;
      this.localId = opts.localId; this.onKill = opts.onKill || null; this.onEnd = opts.onEnd || null;
      this.qualidade = opts.qualidade || "alta";
      this.arena = CFG().ARENAS[this.arenaId];
      this.fragilEstado = {};
      this.zona = { x: 380, y: 300, w: 200, h: 200 };
      this._fimChamado = false;
      // eventos de arena (bombas, raios, cura) — salas com eventos
      this.eventos = opts.eventos !== false;
      this.evTimer = 12 * 60;
      this.strikes = []; this.orbs = [];
      this.spawnPts = [90, 260, 470, 680, 830];
    }
    addFighter(o) { const f = new Fighter(o); this.fighters.push(f); return f; }
    me() { return this.fighters.find(f => f.id === this.localId); }
    spawn(f) {
      const i = Math.abs(hash(f.id)) % this.spawnPts.length;
      f.x = this.spawnPts[i]; f.y = 200; f.vx = 0; f.vy = 0;
      f.hp = f.maxhp; f.dead = false; f.invT = 90; f.stun = 0; f.anim = "idle";
    }
    plataformas(t) {
      const out = [{ x: 0, y: GROUND, w: W, h: 60, chao: true }];
      for (const p of this.arena.plats || []) {
        let x = p.x, y = p.y;
        if (p.movel) {
          const ph = (this.time / 60 / p.movel.t) * Math.PI * 2;
          if (p.movel.dx) x += Math.sin(ph) * p.movel.dx;
          if (p.movel.dy) y += Math.sin(ph) * p.movel.dy;
        }
        const key = x + ":" + y;
        if (p.fragil && this.fragilEstado[key] === "caida") continue;
        out.push({ x, y, w: p.w, h: 14, fragil: p.fragil, key });
      }
      return out;
    }
    update(input) {
      if (this.over) return;
      this.time++;
      if (this.time % 60 === 0 && this.restante > 0) this.restante--;
      if (this.restante <= 0) return this.finish("tempo");
      const plats = this.plataformas(this.time);
      // modo rei: pontos por segurar centro
      if (this.modo === "rei") {
        for (const f of this.fighters) {
          if (f.dead) continue;
          const r = f.rect();
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
          if (cx > this.zona.x && cx < this.zona.x + this.zona.w && cy > this.zona.y - 40 && cy < this.zona.y + this.zona.h) {
            f.pontosRei += 100 / 2700; // ~45s segurando para vencer (60fps)
            if (f.pontosRei >= CFG().MODOS.rei.zonaAlvo) return this.finish("rei", f);
          } else f.pontosRei = Math.max(0, f.pontosRei - 6 / 60); // decai 6 pts/s fora da zona
        }
      }
      // sobrevivência: último vivo
      if (this.modo === "sobrevivencia") {
        const vivos = this.fighters.filter(f => !f.dead || f.vidas > 0);
        const realmenteVivos = this.fighters.filter(f => !f.dead);
        if (this.fighters.length > 1 && realmenteVivos.length === 1 && this.time > 180) return this.finish("surv", realmenteVivos[0]);
        if (realmenteVivos.length === 0) return this.finish("surv", null);
      }
      for (const f of this.fighters) {
        if (f.dead) { f.deadT++; if (this.modo !== "sobrevivencia" && f.vidas !== 1 && f.deadT > 120 && !this.over) { if (f.vidas !== Infinity) f.vidas--; this.spawn(f); } continue; }
        f.tempoVivo += 1 / 60;
        let inp = (f.id === this.localId) ? input : (f.isBot ? botInput(this, f) : { x: 0, jump: false, down: false, atk: false, power: false });
        this.stepFighter(f, inp, plats);
      }
      this.stepProjs(plats);
      this.stepMinas();
      this.stepTurrets();
      this.stepEventos();
      this.stepParts();
      this.stepHazards();
      // remove mortos sem vida em surv
      for (const f of this.fighters) if (f.hp <= 0 && !f.dead) this.kill(f, f.lastHitBy);
    }
    stepFighter(f, inp, plats) {
      if (f.invT > 0) f.invT--;
      if (f.atkCd > 0) f.atkCd--;
      if (f.poderCd > 0) f.poderCd--;
      if (f.poderAtivo > 0) f.poderAtivo--;
      if (f.hurtT > 0) f.hurtT--;
      if (f.stun > 0) { f.stun -= 1 / 60; inp = { x: 0, jump: false, down: false, atk: false, power: false }; }
      if (f.burn > 0) { f.burnT++; if (f.burnT % 45 === 0) { this.damage(f, 2, null, false); this.burst(f.x + 13, f.y + 10, "#ff6b1a", 4); } if (f.burnT > 180) { f.burn = 0; f.burnT = 0; } }
      let sp = f.speed * (f.slow > 0 ? 0.55 : 1) * (f.poderAtivo > 0 && f.classe === "atirador" ? 1.6 : 1);
      if (f.slow > 0) f.slow -= 1 / 60;
      const gelo = this.arena.gelo ? 0.94 : 0.78;
      const chaoAtr = this.arena.geloChao ? 0.94 : 0.78;
      // horizontal
      if (inp.x !== 0) {
        f.dir = inp.x > 0 ? 1 : -1;
        f.vx += inp.x * 0.7 * (f.noChao ? 1 : 0.65);
        f.vx = Math.max(-sp * 1.6, Math.min(sp * 1.6, f.vx));
      } else {
        f.vx *= f.noChao ? chaoAtr : 0.985;
        if (Math.abs(f.vx) < 0.05) f.vx = 0;
      }
      // vento deserto
      if (this.arena.vento) f.vx += Math.sin(this.time / 130) * 0.02;
      // agachar
      f.agach = !!inp.down && f.noChao;
      // pulo (borda): inp.jumpPressed tratado fora; aqui inp.jump contínuo + buffer simples
      if (inp.jumpPressed) {
        if (f.noChao) { f.vy = -f.jumpV; f.noChao = false; f.pulos = 1; sfx("jump"); this.burst(f.x + 13, f.y + f.h, "#94a3b8", 4); }
        else if (f.pulos < 2) { f.vy = -f.jumpV * 0.88; f.pulos++; sfx("jump"); this.burst(f.x + 13, f.y + 30, "#c4b5fd", 5); }
      }
      if (!inp.jump && f.vy < -4) f.vy = -4; // pulo variável
      // gravidade
      f.vy += GRAV * (f.agach ? 1.35 : 1) * f.peso;
      if (f.vy > 16) f.vy = 16;
      // integra + colide
      f.x += f.vx;
      if (f.x < 8) { f.x = 8; f.vx = 0; }
      if (f.x > W - 8 - f.w) { f.x = W - 8 - f.w; f.vx = 0; }
      f.y += f.vy;
      f.noChao = false; f.emPlat = false;
      if (f.dropT > 0) f.dropT--;
      const r = f.rect();
      for (const p of plats) {
        if (r.x + r.w > p.x && r.x < p.x + p.w) {
          const prevBottom = (r.y + r.h) - f.vy;
          if (f.vy >= 0 && !(f.dropT > 0 && !p.chao) && prevBottom <= p.y + 8 && r.y + r.h >= p.y && r.y + r.h <= p.y + p.h + 12) {
            f.y = p.y - f.h; f.vy = 0; f.noChao = true; f.pulos = 0; f.emPlat = !p.chao;
            if (p.fragil) {
              this.fragil[p.key] = (this.fragil[p.key] || 0) + 1;
              if (this.fragil[p.key] > 70) this.fragilEstado[p.key] = "caida";
            }
          } else if (f.vy < 0 && p.chao && r.y <= p.y + p.h && r.y >= p.y + p.h - 14) {
            // só o chão sólido bloqueia subindo; plataformas se atravessam (mão única)
            f.y = p.y + p.h; f.vy = 0.5;
          }
        }
      }
      // segurar ▼ em cima de plataforma: desce através dela
      if (inp.down && f.noChao && f.emPlat) { f.y += 8; f.noChao = false; f.emPlat = false; f.pulos = 1; f.dropT = 14; }
      if (f.y > H + 80) { // caiu do mundo (não deve acontecer, mas lava/areia tratam)
        this.damage(f, 30, null, true);
        f.x = 480; f.y = 150; f.vy = 0;
      }
      // ataque
      if (inp.atk) this.tryAttack(f);
      if (inp.power) this.tryPower(f);
      if (inp.armaTroca) { f.armaIdx = (f.armaIdx + 1) % 5; }
      // animação
      f.animT++;
      f.anim = pickAnim(f, inp);
    }
    tryAttack(f) {
      if (f.atkCd > 0 || f.dead) return;
      const wpn = f.weapon();
      const mult = (f.poderAtivo > 0 && f.classe === "guerreiro") ? 1.6 : 1;
      f.atkCd = wpn.cd / 16.6 * (f.classe === "atirador" ? 0.9 : 1);
      f.anim = "attack"; f.animT = 0;
      const cx = f.x + f.w / 2 + f.dir * 20, cy = f.y + 22;
      sfx(wpn.tipo === "melee" ? "swing" : "shoot");
      if (wpn.tipo === "melee") {
        this.burst(cx + f.dir * 25, cy, wpn.cor, 6);
        for (const e of this.fighters) {
          if (e.id === f.id || e.dead) continue;
          if (this.modo === "equipes" && e.team === f.team) continue;
          const dx = (e.x + 13) - (f.x + 13), dy = (e.y + 27) - (f.y + 27);
          if (Math.sign(dx) === f.dir || Math.abs(dx) < 20) {
            if (Math.abs(dx) < wpn.alcance && Math.abs(dy) < 70) {
              const hits = wpn.hits || 1;
              for (let i = 0; i < hits; i++) this.hit(f, e, wpn, mult);
              if (wpn.block) { e.vx = f.dir * wpn.kb; e.vy = -5; }
            }
          }
        }
      } else if (wpn.tipo === "mina") {
        this.minas.push({ x: f.x + 13, y: f.y + f.h - 6, dono: f.id, team: f.team, dmg: wpn.dmg * mult, kb: wpn.kb, t: 0, cor: wpn.cor });
      } else {
        const mk = (ang) => {
          this.projs.push({
            x: cx, y: cy, vx: Math.cos(ang) * wpn.projSpeed + f.vx * 0.3, vy: Math.sin(ang) * wpn.projSpeed,
            dono: f.id, team: f.team, dmg: wpn.dmg * mult, kb: wpn.kb * (mult > 1 ? 1.4 : 1), cor: wpn.cor,
            r: wpn.projR, life: wpn.alcance / wpn.projSpeed, aoe: wpn.aoe || 0, slow: wpn.slow || 0,
            burn: wpn.burn || 0, pull: !!wpn.pull, boom: !!wpn.boomerang, volta: 0, stun: wpn.stun || 0, grav: f.classe === "engenheiro" && wpn.id === "canhao" ? 0.15 : 0,
          });
        };
        const base = f.dir === 1 ? 0 : Math.PI;
        if (wpn.spread) { mk(base - 0.18); mk(base); mk(base + 0.18); }
        else mk(base + (Math.random() - 0.5) * 0.04);
        if (window.SA_NET && window.SA_NET.rt) { /* relay online via net.js pos/atk já cobre */ }
      }
    }
    tryPower(f) {
      if (f.poderCd > 0 || f.dead) return;
      const c = CFG().CLASSES[f.classe];
      f.poderCd = c.poderCd * 60; f.animT = 0;
      if (f.classe === "guerreiro") { f.poderAtivo = 6 * 60; this.ring(f.x + 13, f.y + 27, "#ef4444"); sfx("power"); }
      else if (f.classe === "mago") {
        const nx = Math.max(20, Math.min(W - 46, f.x + f.dir * 260));
        this.after(f.x + 13, f.y + 27); f.x = nx; f.invT = Math.max(f.invT, 30);
        this.after(f.x + 13, f.y + 27); sfx("tele");
      } else if (f.classe === "atirador") { f.poderAtivo = 4 * 60; f.vx = f.dir * 11; f.vy = -3; f.invT = Math.max(f.invT, 25); this.after(f.x, f.y); sfx("dash"); }
      else if (f.classe === "engenheiro") {
        this.turrets.push({ x: f.x + 13, y: f.y + f.h - 10, dono: f.id, team: f.team, t: 20 * 60, cd: 0, cor: "#f59e0b" });
        sfx("power"); this.ring(f.x + 13, f.y + 30, "#f59e0b");
      }
      this.floatText(f.x + 13, f.y - 14, c.poderNome, c.glow);
    }
    hit(from, target, wpn, mult) {
      if (target.invT > 0 || target.dead) return;
      let dmg = wpn.dmg * (mult || 1);
      // escudo bloqueia de frente
      const tw = target.weapon();
      if (tw && tw.block && Math.sign((from.x - target.x)) !== target.dir && Math.random() < 0.5) { dmg *= 0.35; this.floatText(target.x + 13, target.y - 10, "BLOQUEIO", "#7dd3fc"); }
      this.damage(target, dmg, from, true);
      target.vx += Math.sign(target.x - from.x || (Math.random() - 0.5)) * (wpn.kb || 6) * (0.9 / target.peso + 0.4);
      target.vy = Math.min(target.vy, -(wpn.kb || 6) * 0.45);
      target.hurtT = 22; target.invT = Math.max(target.invT, 28);
      if (wpn.stun) target.stun = Math.max(target.stun, wpn.stun);
      if (wpn.slow) target.slow = wpn.slow;
      if (wpn.burn) { target.burn = wpn.burn; target.burnT = 0; }
      if (wpn.pull) { target.vx += Math.sign(from.x - target.x) * 7; target.vy -= 2; }
      from.dano += dmg;
      this.burst(target.x + 13, target.y + 24, wpn.cor, 8);
      sfx("hit");
    }
    damage(f, dmg, from, conta) {
      if (f.invT > 0 && dmg < 20) return;
      f.hp -= dmg;
      if (from && from !== f && conta) {
        f.lastHitBy = from.id;
        f.hitByMap[from.id] = (f.hitByMap[from.id] || 0) + dmg;
      }
      this.floatText(f.x + 13, f.y - 8, "-" + Math.round(dmg), "#fca5a5");
      if (f.hp <= 0 && !f.dead) this.kill(f, from ? from.id : null);
    }
    kill(f, byId) {
      f.hp = 0; f.dead = true; f.deadT = 0; f.anim = "down";
      this.burst(f.x + 13, f.y + 27, "#ffffff", 14); this.ring(f.x + 13, f.y + 27, "#ef4444");
      sfx("ko");
      const killer = this.fighters.find(k => k.id === byId);
      if (killer && killer !== f) {
        killer.kills++;
        // assistência: maior dano além do killer
        let best = null, bestD = 0;
        for (const k in f.hitByMap) { if (k !== byId && f.hitByMap[k] > bestD) { bestD = f.hitByMap[k]; best = k; } }
        if (best) { const a = this.fighters.find(k => k.id === best); if (a) a.assists++; }
        this.floatText(f.x + 13, f.y - 30, killer.name + " ELIMINOU " + f.name, "#fbbf24");
        if (this.onKill) this.onKill({ killer: killer.name, victim: f.name, arma: killer.weapon().nome });
      } else {
        this.floatText(f.x + 13, f.y - 30, f.name + " CAIU", "#94a3b8");
        if (this.onKill) this.onKill({ killer: "ARENA", victim: f.name, arma: "perigo" });
      }
      f.hitByMap = {}; f.lastHitBy = null;
    }
    stepProjs(plats) {
      for (let i = this.projs.length - 1; i >= 0; i--) {
        const p = this.projs[i];
        p.vy += (p.grav || 0); p.x += p.vx; p.y += p.vy; p.life--;
        if (p.boom) { p.volta++; if (p.volta > 22) { p.vx *= -0.96; p.vy *= -0.5; if (p.volta > 60) p.life = 0; } }
        this.trail(p.x, p.y, p.cor);
        let morto = p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -40 || p.y > H + 20;
        // colisão cenário
        if (!morto) for (const pl of plats) { if (p.x > pl.x && p.x < pl.x + pl.w && p.y > pl.y && p.y < pl.y + pl.h + 4) { morto = true; break; } }
        // bomba: espoleta por proximidade
        if (p.bomb && !morto) {
          for (const f of this.fighters) {
            if (f.dead) continue;
            if (Math.hypot((f.x + 13) - p.x, (f.y + 27) - p.y) < 36) { morto = true; break; }
          }
        }
        // colisão lutadores
        if (!morto) {
          for (const f of this.fighters) {
            if (f.dead || f.invT > 0) continue;
            if (p.dono && p.dono === f.id) continue;
            if (this.modo === "equipes" && p.team === f.team) continue;
            const r = f.rect();
            if (p.x > r.x - 4 && p.x < r.x + r.w + 4 && p.y > r.y && p.y < r.y + r.h) {
              const dono = this.fighters.find(k => k.id === p.dono);
              if (p.aoe) this.explode(p.x, p.y, p.aoe, p.dmg, p.kb, dono, p.cor);
              else if (dono) this.hit(dono, f, { dmg: p.dmg, kb: p.kb, cor: p.cor, slow: p.slow, burn: p.burn, pull: p.pull, stun: p.stun }, 1);
              else this.damage(f, p.dmg, null, true);
              morto = true; break;
            }
          }
        }
        if (morto && p.aoe && p.life > 0) { const dono = this.fighters.find(k => k.id === p.dono); this.explode(p.x, p.y, p.aoe, p.dmg, p.kb, dono, p.cor); }
        if (morto) this.projs.splice(i, 1);
      }
    }
    explode(x, y, raio, dmg, kb, dono, cor) {
      this.ring(x, y, cor || "#fb923c"); this.burst(x, y, cor || "#fb923c", 16); sfx("boom");
      for (const f of this.fighters) {
        if (f.dead || f.invT > 0) continue;
        if (dono && this.modo === "equipes" && f.team === dono.team && f !== dono) continue;
        const dx = (f.x + 13) - x, dy = (f.y + 27) - y, d = Math.hypot(dx, dy);
        if (d < raio) {
          const fall = 1 - d / raio * 0.6;
          if (dono && f !== dono) this.hit(dono, f, { dmg: dmg * fall, kb: kb * fall, cor: cor || "#fb923c" }, 1);
          else if (!dono) this.damage(f, dmg * fall, null, true);
        }
      }
    }
    stepMinas() {
      for (let i = this.minas.length - 1; i >= 0; i--) {
        const m = this.minas[i]; m.t++;
        if (m.t > 60 * 25) { this.minas.splice(i, 1); continue; }
        for (const f of this.fighters) {
          if (f.dead || f.id === m.dono) continue;
          if (this.modo === "equipes" && f.team === m.team) continue;
          if (Math.abs((f.x + 13) - m.x) < 24 && Math.abs((f.y + 40) - m.y) < 30) {
            const dono = this.fighters.find(k => k.id === m.dono);
            this.explode(m.x, m.y, 85, m.dmg, m.kb, dono, m.cor);
            this.minas.splice(i, 1); break;
          }
        }
      }
    }
    stepTurrets() {
      for (let i = this.turrets.length - 1; i >= 0; i--) {
        const t = this.turrets[i]; t.t--; t.cd--;
        if (t.t <= 0) { this.turrets.splice(i, 1); continue; }
        if (t.cd > 0) continue;
        let best = null, bd = 320;
        for (const f of this.fighters) {
          if (f.dead || f.id === t.dono) continue;
          if (this.modo === "equipes" && f.team === t.team) continue;
          const d = Math.hypot((f.x + 13) - t.x, (f.y + 27) - (t.y - 20));
          if (d < bd) { bd = d; best = f; }
        }
        if (best) {
          t.cd = 55;
          const ang = Math.atan2((best.y + 27) - (t.y - 20), (best.x + 13) - t.x);
          this.projs.push({ x: t.x, y: t.y - 20, vx: Math.cos(ang) * 7, vy: Math.sin(ang) * 7, dono: t.dono, team: t.team, dmg: 9, kb: 4, cor: "#fbbf24", r: 4, life: 50, aoe: 0 });
          sfx("shoot");
        }
      }
    }
    stepHazards() {
      // lava vulcão
      if (this.arena.lava) for (const L of this.arena.lava) {
        for (const f of this.fighters) {
          if (f.dead || f.invT > 0) continue;
          const r = f.rect();
          if (r.x + r.w > L.x && r.x < L.x + L.w && r.y + r.h > L.y - 4) {
            this.damage(f, 25, null, false); f.vy = -11; f.vx += (Math.random() - 0.5) * 6; f.invT = 60;
            this.burst(f.x + 13, f.y + 40, "#ff5a1f", 12); sfx("hit");
          }
        }
      }
      // laser cyber
      if (this.arena.laser) {
        const L = this.arena.laser; this.laserT++;
        const ligado = (this.laserT % (60 * L.ciclo)) < (60 * L.ciclo * 0.5);
        L.ligado = ligado;
        if (ligado) for (const f of this.fighters) {
          if (f.dead || f.invT > 0) continue;
          const r = f.rect();
          if (r.x + r.w > L.x && r.x < L.x + L.w && r.y + r.h > L.y - 30) {
            this.damage(f, 18, null, false); f.vy = -9; f.invT = 50; sfx("hit");
          }
        }
      }
      // areia movediça deserto
      if (this.arena.areia) for (const A of this.arena.areia) {
        for (const f of this.fighters) {
          if (f.dead) continue;
          const r = f.rect();
          if (r.x + r.w > A.x && r.x < A.x + A.w && r.y + r.h > A.y - 2) { f.vx *= 0.9; if (Math.random() < 0.1) this.damage(f, 2, null, false); }
        }
      }
    }
    // ---------- EVENTOS DE ARENA ----------
    evento(tipo) {
      if (!tipo) {
        const pool = ["bombas", "raios", "cura", "bombas", "raios"];
        tipo = pool[Math.floor(Math.random() * pool.length)];
      }
      if (tipo === "bombas") {
        for (let i = 0; i < 5; i++) {
          this.projs.push({ x: 60 + Math.random() * 840, y: -20 - i * 40, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 2, dono: null, team: -1, dmg: 26, kb: 12, cor: "#f43f5e", r: 8, life: 600, aoe: 85, bomb: true, grav: 0.3 });
        }
        this.anuncia("💣 CHUVA DE BOMBAS!");
      } else if (tipo === "raios") {
        const alvos = this.fighters.filter(f => !f.dead);
        for (let i = 0; i < Math.min(4, Math.max(2, alvos.length)); i++) {
          const f = alvos[Math.floor(Math.random() * alvos.length)];
          this.strikes.push({ x: f.x + 13 + (Math.random() - 0.5) * 40, y: 80, t: 70 });
        }
        this.anuncia("⚡ TEMPESTADE DE RAIOS!");
      } else if (tipo === "cura") {
        for (let i = 0; i < 2; i++) {
          const p = (this.arena.plats || [])[Math.floor(Math.random() * (this.arena.plats || [0]).length)] || { x: 400, y: 300 };
          this.orbs.push({ x: p.x + p.w / 2, y: p.y - 16, t: 20 * 60 });
        }
        this.anuncia("💚 ORBES DE CURA!");
      }
      sfx("power");
    }
    anuncia(txt) {
      this.floatText(480, 90, txt, "#fde047");
      try { window.SA_UI.toast(txt); } catch (e) {}
    }
    stepEventos() {
      if (!this.eventos || this.over) return;
      if (--this.evTimer <= 0) { this.evento(); this.evTimer = (16 + Math.random() * 8) * 60; }
      // raios: telegrafar e cair
      for (let i = this.strikes.length - 1; i >= 0; i--) {
        const s = this.strikes[i]; s.t--;
        if (s.t === 30) sfx("tele");
        if (s.t <= 0) {
          this.burst(s.x, 460, "#facc15", 14); this.ring(s.x, 460, "#facc15"); sfx("boom");
          for (const f of this.fighters) {
            if (f.dead || f.invT > 0) continue;
            if (Math.abs((f.x + 13) - s.x) < 46 && f.y > 200) {
              this.damage(f, 20, null, false); f.vy = -8; f.invT = 50;
            }
          }
          this.strikes.splice(i, 1);
        }
      }
      // orbes de cura
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i];
        if (--o.t <= 0) { this.orbs.splice(i, 1); continue; }
        for (const f of this.fighters) {
          if (f.dead || f.hp >= f.maxhp) continue;
          if (Math.abs((f.x + 13) - o.x) < 26 && Math.abs((f.y + 27) - o.y) < 40) {
            f.hp = Math.min(f.maxhp, f.hp + 30);
            this.floatText(f.x + 13, f.y - 12, "+30", "#4ade80"); this.burst(o.x, o.y, "#4ade80", 10); sfx("power");
            this.orbs.splice(i, 1); break;
          }
        }
      }
    }
    stepParts() {
      const max = this.qualidade === "baixa" ? 120 : 350;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
        if (p.life <= 0) this.parts.splice(i, 1);
      }
      if (this.parts.length > max) this.parts.splice(0, this.parts.length - max);
      for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.y -= 0.7; f.life--; if (f.life <= 0) this.floaters.splice(i, 1); }
    }
    burst(x, y, cor, n) {
      if (this.qualidade === "baixa") n = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1, life: 25 + Math.random() * 20, cor });
    }
    trail(x, y, cor) { if (Math.random() < 0.6) this.parts.push({ x, y, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 16, cor }); }
    ring(x, y, cor) { this.parts.push({ x, y, vx: 0, vy: 0, life: 22, cor, ring: true }); }
    after(x, y) { for (let i = 0; i < 8; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 30, vx: 0, vy: -0.5, life: 20, cor: "#c4b5fd" }); }
    floatText(x, y, txt, cor) { this.floaters.push({ x, y, txt, cor: cor || "#fff", life: 70 }); }
    finish(motivo, destaque) {
      if (this.over) return;
      this.over = true;
      let ordem = [...this.fighters].sort((a, b) => (b.kills - a.kills) || (b.pontosRei - a.pontosRei) || (b.hp - a.hp));
      if (motivo === "surv" && destaque) ordem = [destaque, ...this.fighters.filter(f => f !== destaque)];
      if (motivo === "rei" && destaque) ordem = [destaque, ...this.fighters.filter(f => f !== destaque)];
      if (this.modo === "equipes") {
        const pts = [0, 0];
        for (const f of this.fighters) pts[f.team] = (pts[f.team] || 0) + f.kills;
        const winTeam = pts[0] === pts[1] ? -1 : (pts[0] > pts[1] ? 0 : 1);
        this.winner = winTeam;
        ordem = [...this.fighters].sort((a, b) => ((b.team === winTeam) - (a.team === winTeam)) || (b.kills - a.kills));
      } else this.winner = ordem[0] || null;
      if (this.onEnd) this.onEnd({ motivo, ordem, winner: this.winner });
    }
    // ---------- RENDER ----------
    render() {
      const c = this.ctx;
      const A = this.arena;
      // céu
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, A.ceu[0]); g.addColorStop(0.6, A.ceu[1]); g.addColorStop(1, A.ceu[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      this.bgProps(c, A);
      // zona rei
      if (this.modo === "rei") {
        c.save(); c.globalAlpha = 0.25 + 0.1 * Math.sin(this.time / 20);
        c.fillStyle = "#fbbf24"; c.fillRect(this.zona.x, this.zona.y - 40, this.zona.w, this.zona.h + 40);
        c.restore();
        c.fillStyle = "#fde68a"; c.font = "bold 13px system-ui"; c.textAlign = "center";
        c.fillText("ZONA DO REI", 480, this.zona.y - 48);
      }
      // plataformas
      const plats = this.plataformas(this.time);
      for (const p of plats) {
        c.fillStyle = p.chao ? A.chao : A.plat;
        roundRect(c, p.x, p.y, p.w, p.h, 6); c.fill();
        c.fillStyle = A.detalhe; c.globalAlpha = 0.85;
        c.fillRect(p.x + 4, p.y + 2, p.w - 8, 3);
        c.globalAlpha = 1;
        if (p.fragil && this.fragil[p.key]) { c.fillStyle = "rgba(239,68,68,.5)"; c.fillRect(p.x, p.y, p.w, 4); }
      }
      // lava
      if (A.lava) for (const L of A.lava) {
        c.fillStyle = "#ff3b00"; c.fillRect(L.x, L.y, L.w, H - L.y);
        c.fillStyle = "#ffd166";
        const o = Math.sin(this.time / 8) * 3;
        for (let x = L.x + 6; x < L.x + L.w - 6; x += 18) { c.beginPath(); c.arc(x, L.y + 4 + o * Math.sin(x), 4, 0, 7); c.fill(); }
      }
      // laser
      if (A.laser && A.laser.ligado) {
        const L = A.laser;
        c.fillStyle = "rgba(34,211,238,.85)"; c.fillRect(L.x, L.y - 60, L.w, 60);
        c.fillStyle = "#fff"; c.fillRect(L.x + L.w / 2 - 2, L.y - 60, 4, 60);
      }
      // minas
      for (const m of this.minas) {
        c.fillStyle = m.cor; c.beginPath(); c.arc(m.x, m.y, 7 + Math.sin(this.time / 10) * 1.5, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
      }
      // torretas
      for (const t of this.turrets) {
        c.fillStyle = "#1f2937"; roundRect(c, t.x - 12, t.y - 26, 24, 26, 5); c.fill();
        c.fillStyle = t.cor; c.fillRect(t.x - 8, t.y - 22, 16, 6);
        c.fillStyle = "#fff"; c.font = "10px system-ui"; c.textAlign = "center"; c.fillText(Math.ceil(t.t / 60) + "s", t.x, t.y + 12);
      }
      // eventos: telegrafia de raios + orbes de cura
      for (const s of this.strikes) {
        const urg = s.t < 30;
        c.save(); c.globalAlpha = urg ? (0.5 + 0.4 * Math.sin(this.time / 2)) : 0.45;
        c.fillStyle = urg ? "#ef4444" : "#facc15";
        c.beginPath(); c.ellipse(s.x, 470, 40, 10, 0, 0, 7); c.fill();
        c.fillRect(s.x - 3, 60, 6, 400);
        c.font = "bold 20px system-ui"; c.textAlign = "center"; c.fillText("⚡", s.x, 90);
        c.restore();
      }
      for (const o of this.orbs) {
        const b = Math.sin(this.time / 12) * 3;
        c.save(); c.shadowColor = "#4ade80"; c.shadowBlur = 12;
        c.fillStyle = "#22c55e"; c.beginPath(); c.arc(o.x, o.y + b, 10, 0, 7); c.fill();
        c.shadowBlur = 0; c.fillStyle = "#fff"; c.fillRect(o.x - 2, o.y + b - 6, 4, 12); c.fillRect(o.x - 6, o.y + b - 2, 12, 4);
        c.restore();
      }
      // projéteis
      for (const p of this.projs) {
        c.save(); c.shadowColor = p.cor; c.shadowBlur = 10;
        c.fillStyle = p.cor; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(p.x, p.y, p.r * 0.4, 0, 7); c.fill(); c.restore();
      }
      // lutadores (sombra primeiro)
      const sorted = [...this.fighters].sort((a, b) => a.y - b.y);
      for (const f of sorted) this.drawFighter(c, f);
      // partículas
      for (const p of this.parts) {
        if (p.ring) {
          c.save(); c.globalAlpha = p.life / 22; c.strokeStyle = p.cor; c.lineWidth = 3;
          c.beginPath(); c.arc(p.x, p.y, (22 - p.life) * 3 + 6, 0, 7); c.stroke(); c.restore();
        } else { c.globalAlpha = Math.min(1, p.life / 20); c.fillStyle = p.cor; c.fillRect(p.x - 2, p.y - 2, 4, 4); c.globalAlpha = 1; }
      }
      // textos
      c.textAlign = "center";
      for (const f of this.floaters) {
        c.globalAlpha = Math.min(1, f.life / 30);
        c.font = "bold 13px system-ui"; c.fillStyle = "#000"; c.fillText(f.txt, f.x + 1, f.y + 1);
        c.fillStyle = f.cor; c.fillText(f.txt, f.x, f.y); c.globalAlpha = 1;
      }
      // timer + placar rei
      c.fillStyle = "rgba(0,0,0,.45)"; roundRect(c, W / 2 - 60, 8, 120, 30, 10); c.fill();
      c.fillStyle = "#fff"; c.font = "bold 16px system-ui";
      const mm = Math.floor(this.restante / 60), ss = String(this.restante % 60).padStart(2, "0");
      c.fillText(mm + ":" + ss, W / 2, 29);
    }
    drawFighter(c, f) {
      const r = f.rect();
      c.save();
      if (f.invT > 0 && Math.floor(this.time / 4) % 2 === 0) c.globalAlpha = 0.45;
      // sombra
      c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.ellipse(f.x + 13, this.groundY(f) + 4, 14, 4, 0, 0, 7); c.fill();
      const C = CFG().CLASSES[f.classe];
      const prof = loadProf();
      let body = "#f8fafc";
      if (prof && prof.equip.pele === "dourada") body = "#fbbf24";
      if (prof && prof.equip.pele === "sombra") body = "#a5b4fc";
      if (f.dead) { this.stick(c, f, "down", body, C); c.restore(); return; }
      this.stick(c, f, f.anim, body, C);
      // nome + hp
      c.globalAlpha = 1;
      c.font = "bold 11px system-ui"; c.textAlign = "center";
      const equipe = this.modo === "equipes" ? (f.team === 0 ? "🔵" : "🔴") : "";
      c.fillStyle = "#000"; c.fillText(equipe + f.name, f.x + 13 + 1, f.y - 22 + 1);
      c.fillStyle = f.id === this.localId ? "#fde68a" : "#fff"; c.fillText(equipe + f.name, f.x + 13, f.y - 22);
      // barra hp
      c.fillStyle = "rgba(0,0,0,.6)"; roundRect(c, f.x - 7, f.y - 18, 40, 7, 3); c.fill();
      const w = 40 * Math.max(0, f.hp / f.maxhp);
      c.fillStyle = f.hp > 50 ? "#22c55e" : (f.hp > 25 ? "#facc15" : "#ef4444");
      if (w > 0) { roundRect(c, f.x - 7, f.y - 18, w, 7, 3); c.fill(); }
      // fúria / poder
      if (f.poderAtivo > 0) { c.save(); c.strokeStyle = C.glow; c.lineWidth = 2; c.globalAlpha = 0.7 + 0.3 * Math.sin(this.time / 5); c.beginPath(); c.arc(f.x + 13, f.y + 24, 30, 0, 7); c.stroke(); c.restore(); }
      c.restore();
    }
    groundY(f) {
      const plats = this.plataformas(this.time);
      let gy = H;
      for (const p of plats) { if (f.x + 13 > p.x && f.x + 13 < p.x + p.w && p.y >= f.y + f.h - 4 && p.y < gy) gy = p.y; }
      return Math.min(gy, H - 4);
    }
    stick(c, f, anim, body, C) {
      const t = this.time + (f.animT || 0);
      const cx = f.x + 13, topY = f.y + 8;
      const crouch = f.agach || anim === "crouch";
      const hipY = topY + (crouch ? 22 : 30);
      const shY = topY + (crouch ? 12 : 8);
      let bob = 0, legA = 0, legB = 0, armA = 0, armB = 0, lean = 0, headDx = 0;
      const run = Math.abs(f.vx) > 4.2;
      switch (anim) {
        case "idle": bob = Math.sin(t / 22) * 1.5; armA = Math.sin(t / 22) * 0.08; armB = -armA; break;
        case "walk": { const s = Math.sin(t / 7); legA = s * 0.7; legB = -s * 0.7; armA = -s * 0.6; armB = s * 0.6; bob = Math.abs(Math.cos(t / 7)) * -1.5; lean = f.dir * 0.08; break; }
        case "run": { const s = Math.sin(t / 5); legA = s * 1.0; legB = -s * 1.0; armA = -s * 0.9; armB = s * 0.9; bob = Math.abs(Math.cos(t / 5)) * -2; lean = f.dir * 0.16; break; }
        case "crouch": legA = 1.1; legB = -1.1; armA = 0.5; armB = 0.5; break;
        case "jump": legA = 0.5; legB = -0.4; armA = -2.4; armB = 2.4; break;
        case "fall": legA = 0.35; legB = -0.35; armA = -1.2; armB = 1.2; break;
        case "attack": { const k = Math.min(1, (f.animT || 0) / 12); armA = f.dir === 1 ? (-2.2 + k * 1.6) : (2.2 - k * 1.6); armB = -armA * 0.4; lean = f.dir * 0.2; legA = 0.4; legB = -0.3; break; }
        case "hurt": armA = -1.6; armB = 1.6; lean = -f.dir * 0.25; headDx = -f.dir * 3; break;
        case "down": this.stickDown(c, f, body, C); return;
        case "getup": bob = -4; armA = -1; armB = 1; break;
        default: bob = Math.sin(t / 22) * 1.5;
      }
      if (anim !== "walk" && anim !== "run") {
        if (anim === "idle" && Math.abs(f.vx) > 0.6) { const s = Math.sin(t / 7); legA = s * 0.7; legB = -s * 0.7; }
        if (!f.noChao) { if (f.vy < -1) { legA = 0.5; legB = -0.4; armA = -2.2; armB = 2.2; } else if (f.vy > 2) { legA = 0.35; legB = -0.35; armA = -1.1; armB = 1.1; } }
      }
      const hx = cx + headDx + lean * 20, hy = shY - 12 + bob;
      c.save(); c.lineCap = "round";
      // pernas
      c.strokeStyle = body; c.lineWidth = 4;
      limb(c, cx, hipY, legA, 16); limb(c, cx, hipY, legB, 16);
      // tronco
      c.strokeStyle = C.cor; c.lineWidth = 5;
      c.beginPath(); c.moveTo(cx, shY + bob * 0.5); c.lineTo(cx + lean * 14, hipY); c.stroke();
      // braços (um segura a arma)
      c.strokeStyle = body; c.lineWidth = 3.5;
      const wA = armWeapon(c, f, shY + bob * 0.5, armA);
      limb(c, cx + lean * 10, shY + bob * 0.5, armB, 13);
      // cabeça
      c.fillStyle = body; c.beginPath(); c.arc(hx, hy, 7.5, 0, 7); c.fill();
      c.lineWidth = 2.5; c.strokeStyle = C.cor; c.beginPath(); c.arc(hx, hy, 7.5, 0, 7); c.stroke();
      // olho
      c.fillStyle = "#0f172a"; c.beginPath(); c.arc(hx + f.dir * 3, hy - 1, 1.8, 0, 7); c.fill();
      // acessório
      this.acessorio(c, hx, hy - 8, f);
      // arma (desenhada na mão)
      this.arma(c, f, wA.x, wA.y, wA.ang);
      c.restore();
    }
    stickDown(c, f, body, C) {
      const cx = f.x + 13, y = f.y + 40;
      c.save(); c.lineCap = "round"; c.globalAlpha = 0.9;
      c.strokeStyle = body; c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx - 14, y); c.lineTo(cx + 14, y); c.stroke();
      c.strokeStyle = C.cor; c.lineWidth = 5;
      c.beginPath(); c.moveTo(cx - 12, y - 6); c.lineTo(cx + 12, y - 6); c.stroke();
      c.fillStyle = body; c.beginPath(); c.arc(cx + 16, y - 6, 7, 0, 7); c.fill();
      c.strokeStyle = C.cor; c.lineWidth = 2; c.beginPath(); c.arc(cx + 16, y - 6, 7, 0, 7); c.stroke();
      // X nos olhos
      c.strokeStyle = "#ef4444"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx + 13, y - 9); c.lineTo(cx + 19, y - 3); c.moveTo(cx + 19, y - 9); c.lineTo(cx + 13, y - 3); c.stroke();
      c.restore();
    }
    acessorio(c, x, y, f) {
      try {
        const prof = loadProf();
        const a = prof && prof.equip.acessorio;
        if (a === "coroa") { c.fillStyle = "#fbbf24"; c.fillRect(x - 7, y - 6, 14, 7); c.fillStyle = "#ef4444"; for (let i = 0; i < 3; i++) c.fillRect(x - 6 + i * 5, y - 9, 3, 4); }
        else if (a === "chapeu") { c.fillStyle = "#22d3ee"; c.fillRect(x - 9, y - 4, 18, 3); c.fillRect(x - 6, y - 12, 12, 9); }
        else if (a === "faixa") { c.fillStyle = "#ef4444"; c.fillRect(x - 8, y - 3, 16, 4); c.strokeStyle = "#ef4444"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x - 16 - Math.sin(this.time / 6) * 3, y + 4); c.stroke(); }
      } catch (e) {}
    }
    arma(c, f, hx, hy, ang) {
      const wpn = f.weapon();
      c.save(); c.translate(hx, hy); c.rotate(ang);
      c.shadowColor = wpn.cor; c.shadowBlur = 8;
      c.strokeStyle = wpn.cor; c.fillStyle = wpn.cor; c.lineWidth = 3;
      const L = 22;
      if (f.classe === "guerreiro") {
        if (wpn.id === "escudo") { c.fillStyle = "#1e3a5f"; roundRect(c, 0, -12, 8, 24, 4); c.fill(); c.strokeStyle = wpn.cor; c.strokeRect(-1, -13, 10, 26); }
        else { c.beginPath(); c.moveTo(0, 0); c.lineTo(L, 0); c.stroke(); c.beginPath(); c.moveTo(L - 7, -5); c.lineTo(L + 2, 0); c.lineTo(L - 7, 5); c.closePath(); c.fill(); }
        if (wpn.id === "martelo" || wpn.id === "machado_pesado") { c.fillRect(L - 4, -8, 8, 16); }
      } else if (f.classe === "mago") {
        c.beginPath(); c.moveTo(-4, 6); c.lineTo(10, -6); c.stroke();
        c.save(); c.shadowBlur = 14; c.beginPath(); c.arc(13, -8, 5, 0, 7); c.fill(); c.restore();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(13, -8, 2, 0, 7); c.fill();
      } else if (f.classe === "atirador") {
        if (wpn.id === "bumer") { c.beginPath(); c.arc(8, 0, 8, 0.4, 5.4); c.stroke(); }
        else { c.beginPath(); c.moveTo(0, 0); c.lineTo(20, -4); c.stroke(); c.beginPath(); c.moveTo(4, 6); c.lineTo(4, -6); c.stroke(); }
      } else {
        if (wpn.id === "minas") { c.beginPath(); c.arc(8, 0, 6, 0, 7); c.stroke(); c.fillRect(6, -2, 4, 4); }
        else if (wpn.id === "ima") { c.beginPath(); c.arc(8, 0, 7, -1.2, 1.2); c.stroke(); c.beginPath(); c.arc(8, 0, 7, Math.PI - 1.2, Math.PI + 1.2); c.stroke(); }
        else { c.fillStyle = "#334155"; roundRect(c, 0, -4, 20, 8, 3); c.fill(); c.fillStyle = wpn.cor; c.fillRect(14, -2, 8, 4); }
      }
      c.restore();
    }
    bgProps(c, A) {
      c.save();
      if (this.arenaId === "vulcao") {
        c.fillStyle = "rgba(0,0,0,.4)";
        tri(c, 90, 500, 190, 240); tri(c, 700, 500, 800, 200);
        c.fillStyle = "#ff5a1f"; c.globalAlpha = 0.8;
        c.fillRect(184, 300, 12, 40); c.fillRect(794, 260, 12, 40); c.globalAlpha = 1;
        ember(c, this.time);
      } else if (this.arenaId === "gelo") {
        c.fillStyle = "rgba(125,211,252,.12)";
        tri(c, 120, 500, 220, 180); tri(c, 740, 500, 840, 160);
        c.fillStyle = "rgba(255,255,255,.7)";
        for (let i = 0; i < 30; i++) { const x = (i * 173 + this.time * 0.4) % W, y = (i * 97) % 300; c.fillRect(x, y, 2, 2); }
      } else if (this.arenaId === "floresta") {
        c.fillStyle = "rgba(0,0,0,.35)";
        for (const x of [70, 880]) { c.fillRect(x, 300, 22, 200); c.fillStyle = "rgba(163,230,53,.5)"; c.beginPath(); c.arc(x + 11, 280, 55, 0, 7); c.fill(); c.fillStyle = "rgba(0,0,0,.35)"; }
      } else if (this.arenaId === "cyber") {
        c.strokeStyle = "rgba(34,211,238,.35)"; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 120 + i * 60); c.lineTo(W, 100 + i * 60); c.stroke(); }
        c.fillStyle = "rgba(34,211,238,.7)";
        for (let i = 0; i < 8; i++) { const x = (i * 137 + this.time) % W; c.fillRect(x, 60 + (i * 53) % 380, 3, 3); }
      } else if (this.arenaId === "deserto") {
        c.fillStyle = "rgba(251,191,36,.15)";
        const off = (this.time * 2) % 200;
        for (let i = -1; i < 6; i++) { c.save(); c.translate(i * 200 - off, 380); c.rotate(0.2); c.fillRect(0, 0, 120, 90); c.restore(); }
        c.fillStyle = "rgba(251,191,36,.5)"; c.font = "12px system-ui"; c.textAlign = "left";
        c.fillText("🌪️ " + (Math.sin(this.time / 130) > 0 ? "→" : "←"), 20, 60);
      }
      c.restore();
    }
  }

  function limb(c, x, y, ang, len) {
    const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
    c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
    return { x: ex, y: ey };
  }
  function armWeapon(c, f, y, ang) {
    // retorna posição da mão + ângulo da arma
    const cx = f.x + 13;
    const baseAng = (f.dir === 1 ? -Math.PI / 2 : Math.PI / 2) + ang * 0.7 + (f.dir === 1 ? 1.2 : -1.2);
    const hx = cx + Math.cos(baseAng) * 13, hy = y + Math.sin(baseAng) * 13 + 6;
    c.beginPath(); c.moveTo(cx, y); c.lineTo(hx, hy); c.stroke();
    return { x: hx, y: hy, ang: f.dir === 1 ? 0.3 + ang * 0.3 : Math.PI - 0.3 - ang * 0.3 };
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function tri(c, x, base, w, top) { c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x, top); c.lineTo(x + w / 2, base); c.closePath(); c.fill(); }
  function ember(c, t) {
    c.fillStyle = "rgba(255,120,40,.8)";
    for (let i = 0; i < 14; i++) { const x = (i * 211 + t * 0.7) % 960, y = 500 - ((t * 1.3 + i * 89) % 480); c.fillRect(x, y, 3, 3); }
  }
  function hash(s) { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0; return Math.abs(h); }
  function pickAnim(f, inp) {
    if (f.dead) return "down";
    if (f.anim === "attack" && f.animT < 14) return "attack";
    if (f.hurtT > 0) return "hurt";
    if (f.stun > 0) return "hurt";
    if (!f.noChao) return f.vy < 0 ? "jump" : "fall";
    if (f.agach) return "crouch";
    const sp = Math.abs(f.vx);
    if (sp > 4.2) return "run";
    if (sp > 0.5) return "walk";
    return "idle";
  }
  function botInput(g, f) {
    if (!f.bot) f.bot = { t: 0, dir: 1, jumpCd: 0 };
    const b = f.bot; b.t++;
    // alvo mais próximo
    let best = null, bd = 1e9;
    for (const e of g.fighters) {
      if (e.id === f.id || e.dead) continue;
      if (g.modo === "equipes" && e.team === f.team) continue;
      const d = Math.hypot(e.x - f.x, e.y - f.y);
      if (d < bd) { bd = d; best = e; }
    }
    let x = 0, jumpPressed = false, down = false, atk = false, power = false;
    if (g.modo === "rei") {
      const dx = 480 - (f.x + 13);
      if (Math.abs(dx) > 30) x = Math.sign(dx);
      else if (best && Math.abs(best.x - f.x) < 90) x = Math.sign(best.x - f.x);
    } else if (best) {
      const dx = best.x - f.x, dy = best.y - f.y;
      const wpn = f.weapon();
      const range = wpn.tipo === "melee" ? wpn.alcance * 0.85 : 300;
      if (Math.abs(dx) > range * 0.7) x = Math.sign(dx);
      else { x = Math.sign(dx) * 0.5; if (Math.abs(dx) < wpn.alcance && Math.abs(dy) < 80) atk = true; else if (wpn.tipo !== "melee" && Math.abs(dy) < 60) atk = true; }
      if (dy < -60 && f.noChao && b.jumpCd <= 0) { jumpPressed = true; b.jumpCd = 40; }
      if ((f.x < 30 && x < 0) || (f.x > 900 && x > 0)) { jumpPressed = true; }
      if (Math.random() < 0.004) power = true;
      if (Math.random() < 0.01) atk = true;
    } else { if (b.t % 120 === 0) b.dir *= -1; x = b.dir * 0.5; }
    if (b.jumpCd > 0) b.jumpCd--;
    // evita lava
    if (g.arena.lava && f.noChao) for (const L of g.arena.lava) {
      const nx = f.x + 13 + x * 40;
      if (nx > L.x - 10 && nx < L.x + L.w + 10) { x = 0; if (b.jumpCd <= 0) { jumpPressed = true; b.jumpCd = 50; } }
    }
    return { x, jump: jumpPressed, jumpPressed, down, atk, power };
  }
  function sfx() { /* implementado em ui.js via WebAudio; engine chama window.SA_SFX */ try { const fn = window.SA_SFX; if (fn) fn.apply(null, arguments); } catch (e) {} }
  function loadProf() { try { return JSON.parse(localStorage.getItem("stickArenaV1")); } catch (e) { return null; } }

  const api = { Game, Fighter, W, H, GROUND };
  if (typeof window !== "undefined") window.SA_ENGINE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
