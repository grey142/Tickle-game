import type { MonsterDef, MonsterKind } from '../game/types';
import { MONSTER_DEFS, bossHpForMission } from '../data/MonsterDefs';
import { resolveWalls, circlesOverlap } from '../systems/Collision';
import { drawSpriteCentered, getEnemySprite } from '../assets/Sprites';
import type { Player } from './Player';

export type MonsterState = 'idle' | 'chase' | 'grabbing' | 'tickling' | 'hitstun' | 'telegraph' | 'dead';

export class Monster {
  def: MonsterDef;
  kind: MonsterKind;
  x: number;
  y: number;
  hp: number;
  radius: number;
  state: MonsterState = 'idle';
  facing = 0;
  grabTimer = 0;
  tickleTime = 0;
  hitstun = 0;
  telegraph = 0;
  telegraphAngle = 0;
  dead = false;
  animT = Math.random() * 10;
  flash = 0;
  mission: number;

  constructor(kind: MonsterKind, x: number, y: number, mission = 1) {
    this.kind = kind;
    this.def = MONSTER_DEFS[kind];
    this.x = x;
    this.y = y;
    this.radius = this.def.radius;
    this.mission = mission;
    if (this.def.tier === 'Boss') {
      this.hp = bossHpForMission(mission);
    } else {
      this.hp = this.def.hp;
    }
  }

  get isBoss() { return this.def.tier === 'Boss'; }

  update(
    dt: number,
    player: Player,
    walls: { x: number; y: number; w: number; h: number }[],
    canGrabPlayer: boolean,
  ): { requestRanged: boolean; rangedKind: 'hand' | 'root' } | null {
    if (this.dead) return null;
    this.animT += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.hitstun > 0) {
      this.hitstun -= dt;
      this.state = 'hitstun';
      return null;
    }

    let ranged: { requestRanged: boolean; rangedKind: 'hand' | 'root' } | null = null;

    // Boss telegraph / ranged
    if (this.isBoss && this.state === 'telegraph') {
      this.telegraph -= dt;
      if (this.telegraph <= 0) {
        this.state = 'chase';
        ranged = {
          requestRanged: true,
          rangedKind: this.kind === 'boss_guffaw' ? 'root' : 'hand',
        };
      }
      return ranged;
    }

    if (this.state === 'grabbing' || this.state === 'tickling') {
      // held in place near player — StruggleSystem owns progression
      this.x += (player.x - this.x) * Math.min(1, 8 * dt);
      this.y += (player.y - this.y) * Math.min(1, 8 * dt);
      return null;
    }

    if (this.def.speed <= 0) {
      // stationary trap: try grab if close
      if (canGrabPlayer && circlesOverlap(this.x, this.y, this.radius + 8, player.x, player.y, player.radius)) {
        this.state = 'grabbing';
        this.grabTimer = 0;
      }
      return null;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.facing = Math.atan2(dy, dx);

    // Limited sight — do not aggro from across the whole map
    const sight =
      this.isBoss ? 240 :
      this.def.tier === 'L3' ? 175 :
      this.def.tier === 'L2' ? 155 :
      140;
    const loseAggro = sight * 1.35;
    const wasChasing = this.state === 'chase' || this.state === 'telegraph';
    const inSight = dist <= sight || (wasChasing && dist <= loseAggro);

    if (!inSight) {
      this.state = 'idle';
      // light idle drift so they aren't statues
      this.x += Math.cos(this.animT * 0.7 + this.radius) * 12 * dt;
      this.y += Math.sin(this.animT * 0.9 + this.radius) * 12 * dt;
      resolveWalls(this, this.radius, walls);
      return null;
    }

    // Boss occasionally telegraph ranged (only while aware)
    if (this.isBoss && Math.random() < 0.35 * dt && dist > 120 && dist < sight + 40) {
      this.state = 'telegraph';
      this.telegraph = 1.0;
      this.telegraphAngle = this.facing;
      return null;
    }

    const spd = this.def.speed;
    this.x += (dx / dist) * spd * dt;
    this.y += (dy / dist) * spd * dt;
    resolveWalls(this, this.radius, walls);
    this.state = 'chase';

    if (canGrabPlayer && circlesOverlap(this.x, this.y, this.radius, player.x, player.y, player.radius)) {
      this.state = 'grabbing';
      this.grabTimer = 0;
    }
    return null;
  }

  takeDamage(amount: number, fromAngle: number): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.flash = 0.12;
    this.hitstun = 0.12;
    this.x += Math.cos(fromAngle) * 12;
    this.y += Math.sin(fromAngle) * 12;
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      return true;
    }
    // interrupt grab if hit hard enough for L2+
    if (this.state === 'grabbing' || this.state === 'tickling') {
      this.state = 'hitstun';
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    const { color, accent, shape } = this.def;
    const sprite = getEnemySprite(this.kind);
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.flash > 0) ctx.globalAlpha = 0.55 + Math.sin(this.flash * 40) * 0.45;

    const bob = Math.sin(this.animT * 4) * 2;
    ctx.translate(0, bob);

    if (this.state === 'telegraph') {
      ctx.strokeStyle = 'rgba(255,60,60,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(this.telegraphAngle) * 180, Math.sin(this.telegraphAngle) * 180);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,40,40,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10 + Math.sin(this.animT * 20) * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (sprite) {
      const flipX = Math.cos(this.facing) < 0;
      drawSpriteCentered(ctx, sprite, 0, 0, this.radius * 7.2, flipX);
    } else {
      ctx.rotate(this.facing * 0.15);
      drawShape(ctx, shape, this.radius, color, accent, this.animT, this.state);
    }
    ctx.restore();

    // HP pip for multi-HP
    if (this.def.hp > 1 || this.isBoss) {
      const maxHp = this.isBoss ? bossHpForMission(this.mission) : this.def.hp;
      const ratio = Math.max(0, this.hp / maxHp);
      const barY = this.y - (sprite ? this.radius * 1.3 : this.radius) - 12;
      ctx.fillStyle = '#220';
      ctx.fillRect(this.x - 18, barY, 36, 5);
      ctx.fillStyle = this.isBoss ? '#e85' : '#6c6';
      ctx.fillRect(this.x - 18, barY, 36 * ratio, 5);
    }
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: MonsterDef['shape'],
  r: number,
  color: string,
  accent: string,
  t: number,
  state: MonsterState,
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;

  switch (shape) {
    case 'blob': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = r * (0.85 + 0.15 * Math.sin(t * 5 + i));
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // eyes
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-6, -2, 3, 0, Math.PI * 2); ctx.arc(6, -2, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'imp': {
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 0.7, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-8, -r * 0.5); ctx.lineTo(-12, -r - 4); ctx.lineTo(-2, -r * 0.6);
      ctx.moveTo(8, -r * 0.5); ctx.lineTo(12, -r - 4); ctx.lineTo(2, -r * 0.6);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-5, 0, 2.5, 0, Math.PI * 2); ctx.arc(5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      // fingers wiggle when tickling
      if (state === 'tickling' || state === 'grabbing') {
        ctx.strokeStyle = color;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, r * 0.4);
          ctx.quadraticCurveTo(8 + i * 3, r + Math.sin(t * 12 + i) * 4, 4 + i * 4, r + 10);
          ctx.stroke();
        }
      }
      break;
    }
    case 'wisp': {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff8';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(10, 0, 0, r);
      ctx.quadraticCurveTo(-10, 0, 0, -r);
      ctx.stroke();
      break;
    }
    case 'brute': {
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.8, r * 2, r * 1.6, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-r * 0.7, -4, r * 1.4, 8);
      ctx.fillStyle = '#222';
      ctx.fillRect(-8, -10, 5, 5); ctx.fillRect(3, -10, 5, 5);
      break;
    }
    case 'shade': {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r, -r * 0.3, r * 0.8, r, 0, r * 0.7);
      ctx.bezierCurveTo(-r * 0.8, r, -r, -r * 0.3, 0, -r);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f8f';
      ctx.beginPath(); ctx.arc(-5, -4, 3, 0, Math.PI * 2); ctx.arc(5, -4, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'trap': {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.35;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a) * r, Math.sin(a) * r * 0.5, Math.cos(a) * r * 1.4, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'hand': {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-8 + i * 5, -r * 0.3);
        ctx.lineTo(-8 + i * 5 + Math.sin(t * 10 + i) * 2, -r - 6);
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      break;
    }
    case 'boss':
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2);
      ctx.lineTo(0, -r * 1.2);
      ctx.lineTo(r * 0.6, -r * 0.2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(-10, -2, 5, 0, Math.PI * 2); ctx.arc(10, -2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-9, -3, 2, 0, Math.PI * 2); ctx.arc(11, -3, 2, 0, Math.PI * 2); ctx.fill();
      // cape flourish
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.2);
      ctx.quadraticCurveTo(0, r + 15 + Math.sin(t * 3) * 5, r, r * 0.2);
      ctx.stroke();
      break;
    }
  }
}

export function countGrabbingNear(monsters: Monster[], exclude: Monster, radius: number): number {
  let n = 0;
  for (const m of monsters) {
    if (m === exclude || m.dead) continue;
    if ((m.state === 'grabbing' || m.state === 'tickling') && Math.hypot(m.x - exclude.x, m.y - exclude.y) < radius) {
      n++;
    }
  }
  return n;
}
