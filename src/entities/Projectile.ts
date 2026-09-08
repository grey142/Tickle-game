export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life = 1.4;
  radius = 8;
  dead = false;
  fromBoss = false;
  kind: 'slash' | 'hand' | 'root' = 'slash';

  constructor(x: number, y: number, angle: number, speed: number, opts?: { fromBoss?: boolean; kind?: 'slash' | 'hand' | 'root' }) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.fromBoss = opts?.fromBoss ?? false;
    this.kind = opts?.kind ?? 'slash';
    if (this.kind === 'root') this.life = 4;
    if (this.kind === 'hand') this.radius = 12;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}
