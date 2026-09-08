export class Input {
  keys = new Set<string>();
  mouse = { x: 0, y: 0, left: false, right: false, leftPressed: false, rightPressed: false };
  strugglePressed = false;
  pausePressed = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
  }

  endFrame() {
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.strugglePressed = false;
    this.pausePressed = false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) || k === 'escape') {
      e.preventDefault();
    }
    this.keys.add(k);
    if (k === 'e' || k === ' ') this.strugglePressed = true;
    if (k === 'escape') this.pausePressed = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onMouseDown = (e: MouseEvent) => {
    this.updateMouse(e);
    if (e.button === 0) {
      this.mouse.left = true;
      this.mouse.leftPressed = true;
    }
    if (e.button === 2) {
      this.mouse.right = true;
      this.mouse.rightPressed = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 2) this.mouse.right = false;
  };

  private onMouseMove = (e: MouseEvent) => this.updateMouse(e);

  private updateMouse(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * sx;
    this.mouse.y = (e.clientY - rect.top) * sy;
  }

  axis(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  wantsMelee(): boolean {
    return this.keys.has('j') || this.mouse.leftPressed;
  }

  wantsProjectile(): boolean {
    return this.keys.has('k') || this.mouse.rightPressed;
  }

  wantsDash(): boolean {
    return this.keys.has('l') || this.keys.has('shift');
  }

  /** Space also used for struggle when grabbed — Game routes it */
  wantsDashSpace(): boolean {
    return this.keys.has(' ');
  }
}
