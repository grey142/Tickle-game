import { Input } from './Input';
import {
  MELEE_ARC, MELEE_RANGE, PROJECTILE_SPEED, RESOLVE_MAX, STAMINA_MAX,
  type Cheats, type MonsterKind, type Vec2,
} from './types';
import { Player } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Projectile } from '../entities/Projectile';
import { StruggleSystem } from '../systems/StruggleSystem';
import { circlesOverlap } from '../systems/Collision';
import { getLevel } from '../data/MissionData';
import { MONSTER_DEFS } from '../data/MonsterDefs';
import { loadSave, writeSave } from '../save/Save';
import type { SaveData } from './types';
import { CharacterPanel } from '../ui/CharacterPanel';
import { UI, type MenuScreen } from '../ui/UI';
import { drawSpriteCentered, getHeroFrame } from '../assets/Sprites';

interface PotionEnt { x: number; y: number; amount: number; taken: boolean }
interface SlashFx { x: number; y: number; angle: number; life: number }

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: Input;
  ui: UI;
  panel: CharacterPanel;

  mode: 'menu' | 'playing' | 'paused' | 'gameover' | 'levelclear' | 'missionclear' = 'menu';
  menuScreen: MenuScreen = 'main';

  save: SaveData;
  mission = 1;
  level = 1;

  player!: Player;
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  potions: PotionEnt[] = [];
  walls: { x: number; y: number; w: number; h: number }[] = [];
  exit!: Vec2;
  mapW = 1400;
  mapH = 800;
  camera = { x: 0, y: 0 };
  struggle = new StruggleSystem();
  slashFx: SlashFx[] = [];
  levelName = '';
  flavor = '';
  gameOverEnemy: MonsterKind | null = null;
  gallerySelected: MonsterKind = 'giggle_slime';
  private lastTs = 0;
  private gameOverDelay = 0;
  private exitOpen = true;

  constructor(canvas: HTMLCanvasElement, ui: UI, panel: CharacterPanel) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ui = ui;
    this.panel = panel;
    this.input = new Input(canvas);
    this.canvas.tabIndex = 0;
    this.canvas.addEventListener('pointerdown', () => this.canvas.focus());
    this.save = loadSave();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.ui.onAction = (action, payload) => this.handleUI(action, payload);
    this.showMainMenu();
    requestAnimationFrame(this.frame);
  }

  resize() {
    const wrap = this.canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.panel.resize();
  }

  get cheats(): Cheats { return this.save.cheats; }

  /** Ensure keys reach the game after menu button clicks steal focus. */
  private focusPlayfield() {
    // Input listens on window already; blur active menu control and focus canvas.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.canvas.focus({ preventScroll: true });
  }


  showMainMenu() {
    this.mode = 'menu';
    this.menuScreen = 'main';
    this.ui.showMain(this.save.unlockedMission, this.cheats);
    this.panel.setState('idle');
    this.panel.clearPreview();
  }

  startMission(mission: number, level = 1) {
    this.mission = mission;
    this.level = level;
    this.loadLevel();
    this.mode = 'playing';
    this.ui.hide();
    this.panel.clearPreview();
    this.focusPlayfield();
  }

  loadLevel() {
    const def = getLevel(this.mission, this.level);
    this.mapW = def.width;
    this.mapH = def.height;
    this.walls = def.walls.map((w) => ({ ...w }));
    this.exit = { ...def.exit };
    this.levelName = def.name;
    this.flavor = def.flavor;
    this.player = new Player(def.playerStart);
    this.player.resolve = this.save.resolve > 0 ? Math.min(RESOLVE_MAX, this.save.resolve) : RESOLVE_MAX;
    this.player.stamina = STAMINA_MAX;
    this.monsters = def.enemies.map((e) => new Monster(e.kind, e.x, e.y, this.mission));
    this.potions = def.potions.map((p) => ({ ...p, taken: false }));
    this.projectiles = [];
    this.slashFx = [];
    this.struggle.clear(this.player);
    this.panel.clearTickle();
    this.gameOverEnemy = null;
    this.gameOverDelay = 0;
    this.exitOpen = true;
    this.save.lastMission = this.mission;
    this.save.lastLevel = this.level;
  }

  persist(partial?: Partial<SaveData>) {
    Object.assign(this.save, partial);
    this.save.resolve = this.player?.resolve ?? this.save.resolve;
    this.save.stamina = this.player?.stamina ?? this.save.stamina;
    writeSave(this.save);
  }

  handleUI(action: string, payload?: string) {
    switch (action) {
      case 'play':
        this.startMission(Number(payload) || 1, 1);
        break;
      case 'continue':
        this.startMission(this.save.lastMission || 1, this.save.lastLevel || 1);
        break;
      case 'resume':
        this.mode = 'playing';
        this.ui.hide();
        this.focusPlayfield();
        break;
      case 'pause':
        this.mode = 'paused';
        this.menuScreen = 'pause';
        this.ui.showPause();
        break;
      case 'save':
        this.persist();
        this.ui.toast('Game saved');
        break;
      case 'quit':
        this.persist();
        this.showMainMenu();
        break;
      case 'cheats':
        this.menuScreen = 'cheats';
        this.ui.showCheats(this.cheats, this.mode === 'paused' ? 'pause' : 'main');
        break;
      case 'help':
        this.ui.showHelp(this.mode === 'paused' ? 'pause' : 'main');
        break;
      case 'gallery':
        this.menuScreen = 'gallery';
        this.ui.showGallery();
        break;
      case 'back-main':
        this.showMainMenu();
        break;
      case 'back-pause':
        this.mode = 'paused';
        this.ui.showPause();
        break;
      case 'toggle-cheat': {
        const key = payload as keyof Cheats;
        if (key && key in this.save.cheats) {
          this.save.cheats[key] = !this.save.cheats[key];
          writeSave(this.save);
          if (key === 'unlockAllMissions' && this.mode === 'menu') {
            this.ui.showMain(this.save.unlockedMission, this.cheats);
          }
        }
        break;
      }
      case 'gallery-preview':
        if (payload) {
          this.gallerySelected = payload as MonsterKind;
          this.panel.startPreview(this.gallerySelected, 'tickle', 1);
          this.ui.toast(MONSTER_DEFS[this.gallerySelected].name);
        }
        break;
      case 'gallery-tickle':
        this.panel.startPreview(this.gallerySelected, 'tickle', 1);
        break;
      case 'gallery-tickle-count': {
        const n = Math.max(1, Math.min(3, Number(payload) || 1));
        this.panel.startPreview(this.gallerySelected, 'tickle', n);
        break;
      }
      case 'gallery-gameover':
        this.panel.startPreview(this.gallerySelected, 'gameOver');
        break;
      case 'restart-level':
        // reload from save resolve if any
        this.save = loadSave();
        this.loadLevel();
        this.player.refillFull();
        this.mode = 'playing';
        this.ui.hide();
        this.focusPlayfield();
        break;
      case 'next-level':
        if (this.level < 3) {
          this.startMission(this.mission, this.level + 1);
        } else {
          this.showMainMenu();
        }
        break;
    }
  }

  frame = (ts: number) => {
    const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000);
    this.lastTs = ts;
    this.update(dt);
    this.draw();
    this.panel.update(dt);
    this.panel.draw();
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  update(dt: number) {
    if (this.input.pausePressed) {
      if (this.mode === 'playing') {
        this.handleUI('pause');
      } else if (this.mode === 'paused') {
        this.handleUI('resume');
      }
    }

    if (this.mode === 'menu' || this.mode === 'paused' || this.mode === 'levelclear' || this.mode === 'missionclear') {
      this.ui.updateBars(
        this.player?.resolve ?? RESOLVE_MAX,
        this.player?.stamina ?? STAMINA_MAX,
        false,
        0,
      );
      return;
    }

    if (this.mode === 'gameover') {
      this.gameOverDelay -= dt;
      this.panel.setState('gameOver', this.gameOverEnemy);
      this.ui.updateBars(0, this.player.stamina, false, 0);
      if (this.gameOverDelay <= 0 && !this.ui.overlay.classList.contains('show')) {
        const name = this.gameOverEnemy ? MONSTER_DEFS[this.gameOverEnemy].name : 'A creature';
        this.ui.showGameOver(name);
      }
      return;
    }

    // playing
    const worldMouse = this.screenToWorld(this.input.mouse.x, this.input.mouse.y);

    if (this.struggle.active) {
      const result = this.struggle.update(dt, this.player, this.input, this.cheats);
      if (this.struggle.active && this.struggle.grabbers.length) {
        const pk = this.struggle.grabbers[0].kind;
        this.panel.setTickle(pk, this.struggle.grabbers.length);
        this.panel.setState(this.player.anim, this.gameOverEnemy);
      }
      if (result === 'escaped') {
        this.panel.clearTickle();
        this.ui.toast('Escaped!');
      }
      if (result === 'drained') this.triggerGameOver();
    } else {
      const actions = this.player.update(dt, this.input, this.walls, this.cheats, worldMouse, true);
      if (actions.didMelee) this.doMelee(actions.meleeAngle);
      if (actions.didProjectile) this.spawnPlayerProjectile(actions.meleeAngle || this.player.facing);
    }

    // monsters
    const canGrab =
      !this.player.isDashing &&
      this.player.immunity <= 0 &&
      !this.player.grabbed &&
      !this.player.dead;

    for (const m of this.monsters) {
      if (m.dead) continue;
      const ranged = m.update(dt, this.player, this.walls, canGrab && !this.struggle.active);
      if (ranged?.requestRanged) {
        const kind = ranged.rangedKind;
        const ang = m.telegraphAngle;
        if (kind === 'root') {
          // spawn root trap near player
          const tx = this.player.x + Math.cos(ang) * 40;
          const ty = this.player.y + Math.sin(ang) * 40;
          this.monsters.push(new Monster('root_trapper', tx, ty, this.mission));
        } else {
          this.projectiles.push(new Projectile(m.x, m.y, ang, 280, { fromBoss: true, kind: 'hand' }));
        }
      }
    }

    // initiate grab: gather nearby grabbers (same kind as first only)
    if (canGrab && !this.struggle.active) {
      const rawGrabbers = this.monsters.filter(
        (m) => !m.dead && m.state === 'grabbing' && circlesOverlap(m.x, m.y, m.radius + 6, this.player.x, this.player.y, this.player.radius + 4),
      );
      if (rawGrabbers.length) {
        // Initial filter: only same kind as the first grabber
        const primaryKind = rawGrabbers[0].kind;
        const grabbers = rawGrabbers.filter((m) => m.kind === primaryKind);
        // respect gang max of primary
        const primary = grabbers[0];
        const maxG = primary.def.gangMax;
        const gang = grabbers.slice(0, maxG);
        // Only same monster type may join a gang tickle (reinforce)
        if (maxG > 1) {
          for (const m of this.monsters) {
            if (gang.length >= maxG) break;
            if (m.dead || gang.includes(m)) continue;
            if (m.kind !== primaryKind) continue;
            if (Math.hypot(m.x - this.player.x, m.y - this.player.y) < 100) {
              m.state = 'grabbing';
              gang.push(m);
            }
          }
        }
        this.struggle.begin(gang, this.player);
        this.panel.setTickle(primaryKind, gang.length);
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      p.update(dt);
      if (p.dead) continue;
      // wall collide simple
      for (const w of this.walls) {
        if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + w.h) {
          p.dead = true;
        }
      }
      if (p.fromBoss) {
        if (!this.player.grabbed && this.player.immunity <= 0 && !this.player.isDashing &&
            circlesOverlap(p.x, p.y, p.radius, this.player.x, this.player.y, this.player.radius)) {
          p.dead = true;
          if (p.kind === 'hand') {
            const hand = new Monster('hand_tickler', p.x, p.y, this.mission);
            hand.state = 'grabbing';
            this.monsters.push(hand);
            if (!this.struggle.active) this.struggle.begin([hand], this.player);
          }
        }
      } else {
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (circlesOverlap(p.x, p.y, p.radius, m.x, m.y, m.radius)) {
            p.dead = true;
            const dmg = this.cheats.oneHitKill ? 9999 : 1;
            const killed = m.takeDamage(dmg, Math.atan2(m.y - p.y, m.x - p.x));
            if (killed && this.struggle.grabbers.includes(m)) {
              // handled by struggle filter
            }
            break;
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // potions
    for (const pot of this.potions) {
      if (pot.taken) continue;
      if (circlesOverlap(pot.x, pot.y, 14, this.player.x, this.player.y, this.player.radius)) {
        pot.taken = true;
        this.player.healResolve(pot.amount);
        this.ui.toast(`+${pot.amount} Resolve`);
      }
    }

    // exit
    if (this.exitOpen && !this.player.grabbed && !this.player.dead &&
        circlesOverlap(this.exit.x, this.exit.y, 28, this.player.x, this.player.y, this.player.radius)) {
      this.onLevelClear();
    }

    // fx
    for (const s of this.slashFx) s.life -= dt;
    this.slashFx = this.slashFx.filter((s) => s.life > 0);

    // camera
    const viewW = this.canvas.clientWidth;
    const viewH = this.canvas.clientHeight;
    this.camera.x = Math.max(0, Math.min(this.mapW - viewW, this.player.x - viewW / 2));
    this.camera.y = Math.max(0, Math.min(this.mapH - viewH, this.player.y - viewH / 2));

    if (this.struggle.active && this.struggle.grabbers.length) {
      this.panel.setTickle(this.struggle.grabbers[0].kind, this.struggle.grabbers.length);
    } else if (this.panel.preview === 'none') {
      // keep gallery preview tickle; clear in-game scene when free
      if (this.player.anim !== 'grabbed' && this.player.anim !== 'tickled') {
        this.panel.clearTickle();
      }
    }
    this.panel.setState(this.player.anim, this.gameOverEnemy);
    this.ui.updateBars(this.player.resolve, this.player.stamina, this.struggle.active, this.struggle.struggle);

    if (this.player.dead && this.mode === 'playing') this.triggerGameOver();
  }

  doMelee(angle: number) {
    this.slashFx.push({ x: this.player.x, y: this.player.y, angle, life: 0.18 });
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dx = m.x - this.player.x;
      const dy = m.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MELEE_RANGE + m.radius) continue;
      const ang = Math.atan2(dy, dx);
      let diff = ang - angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > MELEE_ARC / 2) continue;
      const dmg = this.cheats.oneHitKill ? 9999 : 1;
      m.takeDamage(dmg, ang);
      // L2 knockback on player already defined on monster hit — apply to monster instead
      m.x += Math.cos(ang) * m.def.knockbackOnHit * 0.15;
      m.y += Math.sin(ang) * m.def.knockbackOnHit * 0.15;
      // if monster has knockbackOnHit, also nudge player slightly when they get hit — handled on grab contact
    }
  }

  spawnPlayerProjectile(angle: number) {
    this.projectiles.push(new Projectile(
      this.player.x + Math.cos(angle) * 20,
      this.player.y + Math.sin(angle) * 20,
      angle,
      PROJECTILE_SPEED,
      { kind: 'slash' },
    ));
  }

  triggerGameOver() {
    this.mode = 'gameover';
    this.gameOverDelay = 1.8;
    const src = this.struggle.grabbers[0] || this.monsters.find((m) => !m.dead);
    this.gameOverEnemy = src?.kind ?? 'giggle_slime';
    this.player.anim = 'gameOver';
    this.panel.setState('gameOver', this.gameOverEnemy);
    this.struggle.clear(this.player);
    this.panel.clearTickle();
    this.player.dead = true;
  }

  onLevelClear() {
    this.player.refillFull();
    this.persist({
      resolve: RESOLVE_MAX,
      stamina: STAMINA_MAX,
      lastMission: this.mission,
      lastLevel: this.level,
    });
    writeSave(this.save);
    this.ui.toast('Autosaved');

    if (this.level >= 3) {
      // boss clear — unlock next mission
      this.save.unlockedMission = Math.max(this.save.unlockedMission, Math.min(10, this.mission + 1));
      this.persist();
      this.mode = 'missionclear';
      this.ui.showMissionClear(this.mission);
    } else {
      this.save.lastLevel = this.level + 1;
      this.persist();
      this.mode = 'levelclear';
      this.ui.showLevelClear(this.mission, this.level);
    }
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return { x: sx + this.camera.x, y: sy + this.camera.y };
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    if (this.mode === 'menu' && !this.player) {
      this.drawMenuBackdrop(w, h);
      return;
    }

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // floor
    ctx.fillStyle = '#1e1830';
    ctx.fillRect(0, 0, this.mapW, this.mapH);
    ctx.strokeStyle = 'rgba(90,70,130,0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.mapW; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.mapH); ctx.stroke();
    }
    for (let y = 0; y < this.mapH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.mapW, y); ctx.stroke();
    }

    // walls
    for (const wall of this.walls) {
      ctx.fillStyle = '#2c2048';
      ctx.strokeStyle = '#5a4080';
      ctx.lineWidth = 2;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    // exit
    ctx.save();
    ctx.translate(this.exit.x, this.exit.y);
    const pulse = 0.6 + Math.sin(performance.now() / 300) * 0.4;
    ctx.fillStyle = `rgba(120, 220, 180, ${0.25 + pulse * 0.25})`;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7eebc0';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cffff0';
    ctx.font = 'bold 12px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', 0, 4);
    ctx.restore();

    // potions
    for (const pot of this.potions) {
      if (pot.taken) continue;
      ctx.fillStyle = '#2ecc71';
      ctx.strokeStyle = '#a6ffce';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pot.x - 8, pot.y - 12, 16, 22, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff8';
      ctx.fillRect(pot.x - 3, pot.y - 8, 6, 8);
    }

    // monsters
    for (const m of this.monsters) m.draw(ctx);

    // projectiles
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.kind === 'hand') {
        ctx.fillStyle = '#e8c4a0';
        ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = '#dff';
        ctx.shadowColor = '#8cf';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -5); ctx.lineTo(-8, 5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // slash fx
    for (const s of this.slashFx) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = `rgba(200,230,255,${s.life / 0.18})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, MELEE_RANGE - 8, -MELEE_ARC / 2, MELEE_ARC / 2);
      ctx.stroke();
      ctx.restore();
    }

    // player
    if (this.player) this.drawPlayer(ctx);

    ctx.restore();

    // HUD overlays on canvas
    ctx.fillStyle = 'rgba(16,10,28,0.72)';
    ctx.fillRect(10, 10, 280, 52);
    ctx.strokeStyle = '#4a3568';
    ctx.strokeRect(10, 10, 280, 52);
    ctx.fillStyle = '#d8c8f0';
    ctx.font = '600 13px Segoe UI';
    ctx.textAlign = 'left';
    ctx.fillText(this.levelName || 'Tickle Struggle', 20, 30);
    ctx.font = '11px Segoe UI';
    ctx.fillStyle = '#9a88b8';
    ctx.fillText(this.flavor.slice(0, 48), 20, 48);

    if (this.struggle.active) {
      ctx.fillStyle = 'rgba(240, 200, 60, 0.15)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.immunity > 0) ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 40) * 0.3;
    if (p.isDashing) {
      ctx.strokeStyle = 'rgba(140,200,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2); ctx.stroke();
    }
    const frame = getHeroFrame(p.anim);
    if (frame) {
      const flip = Math.cos(p.facing) < 0;
      drawSpriteCentered(ctx, frame, 0, -4, p.radius * 28.8, flip);
    } else {
      ctx.fillStyle = '#6a5a9a';
      ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c4b08a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(p.facing);
      ctx.fillStyle = '#e8c8a8';
      ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#eef';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(22, 0); ctx.stroke();
    }
    ctx.restore();
  }

  drawMenuBackdrop(w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1430';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const x = (Math.sin(i * 12.3 + performance.now() / 2000) * 0.5 + 0.5) * w;
      const y = (Math.cos(i * 7.1 + performance.now() / 3000) * 0.5 + 0.5) * h;
      ctx.fillStyle = `hsla(${280 + i * 5}, 60%, 60%, 0.15)`;
      ctx.beginPath(); ctx.arc(x, y, 20 + (i % 5) * 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#cbb8ea';
    ctx.font = '16px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Use the menu to begin your run', w / 2, h / 2);
  }
}
