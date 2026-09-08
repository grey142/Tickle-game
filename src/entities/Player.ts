import type { CharAnimState, Cheats, Vec2 } from '../game/types';
import {
  DASH_COST, DASH_DURATION, DASH_SPEED, MELEE_COST, MELEE_RANGE,
  PLAYER_SPEED, PROJECTILE_COST, RESOLVE_MAX, STAMINA_MAX, STAMINA_REGEN,
} from '../game/types';
import type { Input } from '../game/Input';
import { resolveWalls } from '../systems/Collision';

export class Player {
  x: number;
  y: number;
  radius = 16;
  resolve = RESOLVE_MAX;
  stamina = STAMINA_MAX;
  facing = 0;
  anim: CharAnimState = 'idle';
  animTimer = 0;
  dashTimer = 0;
  dashAngle = 0;
  meleeCooldown = 0;
  projectileCooldown = 0;
  immunity = 0;
  grabbed = false;
  dead = false;
  vx = 0;
  vy = 0;
  knockbackDecay = 0;

  constructor(start: Vec2) {
    this.x = start.x;
    this.y = start.y;
  }

  get isDashing() { return this.dashTimer > 0; }

  update(
    dt: number,
    input: Input,
    walls: { x: number; y: number; w: number; h: number }[],
    cheats: Cheats,
    worldMouse: Vec2,
    allowDash: boolean,
  ): { didMelee: boolean; didProjectile: boolean; meleeAngle: number } {
    let didMelee = false;
    let didProjectile = false;
    let meleeAngle = this.facing;

    this.animTimer = Math.max(0, this.animTimer - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.projectileCooldown = Math.max(0, this.projectileCooldown - dt);
    this.immunity = Math.max(0, this.immunity - dt);

    if (cheats.infiniteResolve) this.resolve = RESOLVE_MAX;
    if (cheats.infiniteStamina) this.stamina = STAMINA_MAX;

    if (this.grabbed || this.dead) {
      this.vx = 0;
      this.vy = 0;
      return { didMelee, didProjectile, meleeAngle };
    }

    // facing toward mouse
    this.facing = Math.atan2(worldMouse.y - this.y, worldMouse.x - this.x);

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.x += Math.cos(this.dashAngle) * DASH_SPEED * dt;
      this.y += Math.sin(this.dashAngle) * DASH_SPEED * dt;
      this.anim = 'dash';
      resolveWalls(this, this.radius, walls);
      return { didMelee, didProjectile, meleeAngle };
    }

    // knockback
    if (this.knockbackDecay > 0) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.05, dt);
      this.vy *= Math.pow(0.05, dt);
      this.knockbackDecay -= dt;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    const axis = input.axis();
    this.x += axis.x * PLAYER_SPEED * dt;
    this.y += axis.y * PLAYER_SPEED * dt;

    if (!cheats.infiniteStamina) {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt);
    }

    // dash: L / Shift (Space reserved for struggle when grabbed; when free Space can dash)
    const dashWanted = input.wantsDash() || (allowDash && input.wantsDashSpace() && !input.keys.has('e'));
    if (dashWanted && this.stamina >= DASH_COST - 0.01) {
      if (!cheats.infiniteStamina) this.stamina -= DASH_COST;
      this.dashTimer = DASH_DURATION;
      if (axis.x !== 0 || axis.y !== 0) this.dashAngle = Math.atan2(axis.y, axis.x);
      else this.dashAngle = this.facing;
      this.anim = 'dash';
      this.animTimer = DASH_DURATION;
    }

    if (input.wantsMelee() && this.meleeCooldown <= 0 && this.stamina >= MELEE_COST - 0.01) {
      if (!cheats.infiniteStamina) this.stamina -= MELEE_COST;
      this.meleeCooldown = 0.28;
      this.anim = 'slash';
      this.animTimer = 0.28;
      didMelee = true;
      meleeAngle = this.facing;
    }

    if (input.wantsProjectile() && this.projectileCooldown <= 0 && this.stamina >= PROJECTILE_COST - 0.01) {
      if (!cheats.infiniteStamina) this.stamina -= PROJECTILE_COST;
      this.projectileCooldown = 0.35;
      this.anim = 'slash';
      this.animTimer = 0.25;
      didProjectile = true;
    }

    if (this.animTimer <= 0) {
      this.anim = (axis.x !== 0 || axis.y !== 0) ? 'run' : 'idle';
    }

    resolveWalls(this, this.radius, walls);
    return { didMelee, didProjectile, meleeAngle };
  }

  applyKnockback(angle: number, force: number) {
    this.vx += Math.cos(angle) * force;
    this.vy += Math.sin(angle) * force;
    this.knockbackDecay = 0.35;
  }

  healResolve(amount: number) {
    this.resolve = Math.min(RESOLVE_MAX, this.resolve + amount);
  }

  refillFull() {
    this.resolve = RESOLVE_MAX;
    this.stamina = STAMINA_MAX;
  }
}

export { MELEE_RANGE };
