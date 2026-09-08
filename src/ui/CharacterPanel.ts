import type { CharAnimState, MonsterKind } from '../game/types';
import { MONSTER_DEFS } from '../data/MonsterDefs';

export class CharacterPanel {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: CharAnimState = 'idle';
  gameOverEnemy: MonsterKind | null = null;
  private t = 0;
  /** gallery preview mode */
  preview: 'none' | 'tickle' | 'gameOver' = 'none';
  previewKind: MonsterKind | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setState(state: CharAnimState, enemy?: MonsterKind | null) {
    this.state = state;
    if (state === 'gameOver') this.gameOverEnemy = enemy ?? this.gameOverEnemy;
  }

  startPreview(kind: MonsterKind, mode: 'tickle' | 'gameOver') {
    this.preview = mode;
    this.previewKind = kind;
    this.t = 0;
  }

  clearPreview() {
    this.preview = 'none';
    this.previewKind = null;
  }

  update(dt: number) {
    this.t += dt;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // floor glow
    const grd = ctx.createRadialGradient(w / 2, h * 0.72, 10, w / 2, h * 0.72, w * 0.45);
    grd.addColorStop(0, 'rgba(120,70,200,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    const state = this.preview === 'tickle' ? 'tickled' : this.preview === 'gameOver' ? 'gameOver' : this.state;
    const enemy = this.preview !== 'none' ? this.previewKind : this.gameOverEnemy;

    this.drawHero(w / 2, h * 0.62, state);

    if (state === 'grabbed' || state === 'tickled') {
      this.drawGrabberSilhouette(w / 2 + 40, h * 0.58, enemy);
    }
    if (state === 'gameOver' && enemy) {
      this.drawVictoryCreature(w / 2, h * 0.45, enemy);
      ctx.fillStyle = 'rgba(255,220,240,0.9)';
      ctx.font = '600 13px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Overcome…', w / 2, h * 0.88);
    }

    if (this.preview !== 'none' && this.previewKind) {
      ctx.fillStyle = '#d8c8f0';
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(MONSTER_DEFS[this.previewKind].name, w / 2, 28);
      ctx.fillStyle = '#9a88b8';
      ctx.fillText(this.preview === 'tickle' ? 'Tickle preview' : 'Defeat preview', w / 2, 46);
    }
  }

  private drawHero(x: number, y: number, state: CharAnimState) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    const bob = state === 'run' ? Math.sin(this.t * 12) * 3 : Math.sin(this.t * 2) * 1.5;
    ctx.translate(0, bob);

    if (state === 'dash') {
      ctx.translate(Math.cos(this.t * 30) * 4, 0);
      ctx.globalAlpha = 0.85;
    }
    if (state === 'tickled') {
      ctx.rotate(Math.sin(this.t * 18) * 0.08);
    }
    if (state === 'gameOver') {
      ctx.rotate(Math.sin(this.t * 6) * 0.15);
      ctx.globalAlpha = 0.7 + Math.sin(this.t * 4) * 0.2;
    }

    // adult adventurer — cloak + armor silhouette
    // legs
    ctx.fillStyle = '#3a2a55';
    const legSwing = state === 'run' ? Math.sin(this.t * 12) * 8 : state === 'slash' ? 4 : 0;
    ctx.fillRect(-12, 18, 9, 28);
    ctx.fillRect(3, 18, 9, 28);
    ctx.save();
    ctx.translate(-7, 18); ctx.rotate(legSwing * 0.03); ctx.fillRect(-4, 0, 9, 28); ctx.restore();
    ctx.save();
    ctx.translate(8, 18); ctx.rotate(-legSwing * 0.03); ctx.fillRect(-4, 0, 9, 28); ctx.restore();

    // body
    ctx.fillStyle = '#5c4a8a';
    ctx.beginPath();
    ctx.roundRect(-18, -20, 36, 42, 10);
    ctx.fill();
    // chest plate
    ctx.fillStyle = '#c4b08a';
    ctx.fillRect(-12, -8, 24, 18);
    // cloak
    ctx.fillStyle = '#7a3a9a';
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.quadraticCurveTo(-34, 20, -16, 40);
    ctx.lineTo(16, 40);
    ctx.quadraticCurveTo(34, 20, 18, -10);
    ctx.fill();

    // head
    ctx.fillStyle = '#e8c8a8';
    ctx.beginPath();
    ctx.arc(0, -32, 14, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = '#2a1a40';
    ctx.beginPath();
    ctx.arc(0, -38, 13, Math.PI, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#222';
    if (state === 'tickled' || state === 'gameOver') {
      // squint/laugh
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-5, -32, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(5, -32, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      // open mouth
      ctx.fillStyle = '#822';
      ctx.beginPath(); ctx.ellipse(0, -24, 4, 3 + Math.abs(Math.sin(this.t * 10)), 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-5, -32, 2.2, 0, Math.PI * 2); ctx.arc(5, -32, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // sword arm
    ctx.strokeStyle = '#c4b08a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    let armAngle = -0.4;
    if (state === 'slash') armAngle = -0.4 + Math.sin(this.t * 20) * 1.2;
    if (state === 'dash') armAngle = -1.2;
    if (state === 'grabbed' || state === 'tickled') armAngle = 0.8 + Math.sin(this.t * 14) * 0.3;
    ctx.save();
    ctx.translate(14, -5);
    ctx.rotate(armAngle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.stroke();
    // blade
    ctx.strokeStyle = '#ddeeff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(48, -6); ctx.stroke();
    ctx.restore();

    // sparkles when tickled
    if (state === 'tickled') {
      for (let i = 0; i < 6; i++) {
        const a = this.t * 5 + i;
        ctx.fillStyle = `hsla(${50 + i * 20}, 90%, 70%, 0.8)`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 36, -20 + Math.sin(a * 1.3) * 24, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawGrabberSilhouette(x: number, y: number, kind: MonsterKind | null) {
    const ctx = this.ctx;
    const def = kind ? MONSTER_DEFS[kind] : MONSTER_DEFS.giggle_slime;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    // wiggling fingers
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-20, -5 + i * 5);
      ctx.quadraticCurveTo(-35, -5 + i * 5 + Math.sin(this.t * 16 + i) * 5, -48, -8 + i * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawVictoryCreature(x: number, y: number, kind: MonsterKind) {
    const ctx = this.ctx;
    const def = MONSTER_DEFS[kind];
    ctx.save();
    ctx.translate(x, y + Math.sin(this.t * 3) * 4);
    ctx.fillStyle = def.color;
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // triumphant pose
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-12, -8, 5, 0, Math.PI * 2); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✧', 0, 12);
    ctx.restore();
  }
}
