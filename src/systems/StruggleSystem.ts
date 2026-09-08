import type { Cheats } from '../game/types';
import { IMMUNITY_AFTER_ESCAPE } from '../game/types';
import type { Player } from '../entities/Player';
import type { Monster } from '../entities/Monster';
import type { Input } from '../game/Input';

export class StruggleSystem {
  active = false;
  struggle = 0; // 0..100
  grabbers: Monster[] = [];
  tickling = false;
  private mashCooldown = 0;

  begin(grabbers: Monster[], player: Player) {
    this.active = true;
    this.struggle = 8;
    this.grabbers = grabbers;
    this.tickling = false;
    player.grabbed = true;
    player.anim = 'grabbed';
    for (const g of grabbers) {
      g.state = 'grabbing';
      g.grabTimer = 0;
    }
  }

  clear(player: Player) {
    this.active = false;
    this.struggle = 0;
    this.tickling = false;
    for (const g of this.grabbers) {
      if (!g.dead && (g.state === 'grabbing' || g.state === 'tickling')) {
        g.state = 'hitstun';
        g.hitstun = 0.4;
      }
    }
    this.grabbers = [];
    player.grabbed = false;
  }

  update(dt: number, player: Player, input: Input, cheats: Cheats): 'escaped' | 'drained' | null {
    if (!this.active || player.dead) return null;

    // drop dead grabbers
    this.grabbers = this.grabbers.filter((g) => !g.dead);
    if (this.grabbers.length === 0) {
      this.clear(player);
      return 'escaped';
    }

    const primary = this.grabbers[0];
    const def = primary.def;
    const gang = Math.min(this.grabbers.length, def.gangMax);
    const hardness = def.struggleHardness;

    for (const g of this.grabbers) {
      g.grabTimer += dt;
    }

    // start tickle after delay (use shortest delay among grabbers)
    const delay = Math.min(...this.grabbers.map((g) => g.def.grabDelay));
    if (!this.tickling && primary.grabTimer >= delay) {
      this.tickling = true;
      for (const g of this.grabbers) g.state = 'tickling';
      player.anim = 'tickled';
    }

    if (this.tickling) {
      for (const g of this.grabbers) g.tickleTime += dt;
      // drain from primary (highest threat) with gang mult
      const drain = this.computeDrain(primary, gang);
      if (!cheats.infiniteResolve) {
        player.resolve -= drain * dt;
      }
      player.anim = 'tickled';
    } else {
      player.anim = 'grabbed';
    }

    // mash to fill struggle
    this.mashCooldown = Math.max(0, this.mashCooldown - dt);

    // also accept held mash via key repeats simulated: check keys each frame with cooldown
    const holding = input.keys.has('e') || input.keys.has(' ');
    if ((input.strugglePressed || (holding && this.mashCooldown <= 0)) && this.mashCooldown <= 0) {
      const gain = cheats.instantStruggle ? 100 : 7 + (1 - hardness) * 6;
      this.struggle = Math.min(100, this.struggle + gain);
      this.mashCooldown = cheats.instantStruggle ? 0.01 : 0.09;
    }

    // passive decay so you must mash
    this.struggle = Math.max(0, this.struggle - (8 + hardness * 10) * dt);

    if (this.struggle >= 100 || cheats.instantStruggle && input.strugglePressed) {
      // escape
      const angle = Math.atan2(player.y - primary.y, player.x - primary.x) || Math.random() * Math.PI * 2;
      player.applyKnockback(angle, 280);
      player.immunity = IMMUNITY_AFTER_ESCAPE;
      for (const g of this.grabbers) {
        g.state = 'hitstun';
        g.hitstun = 0.55;
        g.x -= Math.cos(angle) * 40;
        g.y -= Math.sin(angle) * 40;
      }
      this.clear(player);
      player.anim = 'idle';
      return 'escaped';
    }

    if (player.resolve <= 0) {
      player.resolve = 0;
      player.dead = true;
      player.anim = 'gameOver';
      return 'drained';
    }

    return null;
  }

  private computeDrain(primary: Monster, gang: number): number {
    const def = primary.def;
    let stage = 0;
    let t = primary.tickleTime;
    for (let i = 0; i < def.drainStages.length; i++) {
      if (t <= def.drainStages[i]) {
        stage = i;
        break;
      }
      t -= def.drainStages[i];
      stage = i;
    }
    const rate = def.drainRates[Math.min(stage, def.drainRates.length - 1)];
    const mult = def.gangDrainMult[Math.min(gang - 1, def.gangDrainMult.length - 1)] ?? 1;
    // if multiple grabbers of different types, take max mult-ish — already using primary + gang count
    return rate * mult;
  }
}
