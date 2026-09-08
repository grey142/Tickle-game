import type { Vec2 } from '../game/types';

export function circleRectResolve(
  cx: number, cy: number, r: number,
  rx: number, ry: number, rw: number, rh: number,
): Vec2 | null {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const dist = Math.hypot(dx, dy);
  if (dist >= r || dist === 0) return null;
  const push = r - dist;
  return { x: (dx / dist) * push, y: (dy / dist) * push };
}

export function resolveWalls(
  pos: Vec2, radius: number,
  walls: { x: number; y: number; w: number; h: number }[],
): void {
  for (let i = 0; i < 3; i++) {
    for (const w of walls) {
      const push = circleRectResolve(pos.x, pos.y, radius, w.x, w.y, w.w, w.h);
      if (push) {
        pos.x += push.x;
        pos.y += push.y;
      }
    }
  }
}

export function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  return Math.hypot(ax - bx, ay - by) < ar + br;
}
