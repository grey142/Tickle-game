import type { CharAnimState, MonsterKind } from '../game/types';

/** Soft lavender used as sprite sheet background (~#c9b8e8). */
export const SPRITE_KEY_LAVENDER = { r: 0xc9, g: 0xb8, b: 0xe8 };

const HERO_FRAME_COUNT = 6;

const HERO_ANIM_FRAME: Record<CharAnimState, number> = {
  idle: 0,
  run: 1,
  slash: 2,
  dash: 3,
  grabbed: 4,
  tickled: 5,
  gameOver: 5,
};

const MONSTER_KINDS: MonsterKind[] = [
  'giggle_slime',
  'tickle_imp',
  'feather_wisp',
  'chuckle_brute',
  'snicker_shade',
  'root_trapper',
  'hand_tickler',
  'boss_titania',
  'boss_guffaw',
  'boss_merriwink',
];

export function enemySpriteUrl(kind: MonsterKind): string {
  return `/sprites/enemy_${kind}.png`;
}

export function heroSheetUrl(): string {
  return '/sprites/hero_sheet.png';
}

export function heroFrameIndex(state: CharAnimState): number {
  return HERO_ANIM_FRAME[state] ?? 0;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

/**
 * Chroma-key: sample the corner pixel (and known lavender) and zero alpha for
 * near-matching pixels. Returns an offscreen canvas with transparency.
 */
export function chromaKeyToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  tolerance = 38,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, srcW);
  canvas.height = Math.max(1, srcH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data;

  // Corner sample (primary key)
  const kr = px[0];
  const kg = px[1];
  const kb = px[2];
  const lav = SPRITE_KEY_LAVENDER;
  // Per-channel tolerance; Manhattan threshold scales with 3 channels
  const maxDist = tolerance * 3;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const dCorner = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
    const dLav = Math.abs(r - lav.r) + Math.abs(g - lav.g) + Math.abs(b - lav.b);
    if (dCorner <= maxDist || dLav <= maxDist) {
      px[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}


/** Crop near-transparent padding so scaled draws fill the intended size. */
export function trimTransparent(source: HTMLCanvasElement, alphaThreshold = 8): HTMLCanvasElement {
  const ctx = source.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = source;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return source;
  // small padding
  minX = Math.max(0, minX - 2);
  minY = Math.max(0, minY - 2);
  maxX = Math.min(w - 1, maxX + 2);
  maxY = Math.min(h - 1, maxY + 2);
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  out.getContext('2d')!.drawImage(source, minX, minY, tw, th, 0, 0, tw, th);
  return out;
}

function sliceFrame(
  sheet: HTMLCanvasElement,
  index: number,
  frameCount: number,
): HTMLCanvasElement {
  const fw = Math.floor(sheet.width / frameCount);
  const fh = sheet.height;
  const frame = document.createElement('canvas');
  frame.width = fw;
  frame.height = fh;
  const ctx = frame.getContext('2d')!;
  ctx.drawImage(sheet, index * fw, 0, fw, fh, 0, 0, fw, fh);
  return frame;
}

export interface SpriteBank {
  ready: boolean;
  heroFrames: HTMLCanvasElement[];
  enemies: Partial<Record<MonsterKind, HTMLCanvasElement>>;
}

export const sprites: SpriteBank = {
  ready: false,
  heroFrames: [],
  enemies: {},
};

let loadPromise: Promise<SpriteBank> | null = null;

/**
 * Load all placeholder sprites, chroma-key lavender backgrounds, slice hero
 * sheet into 6 frames. Safe to call multiple times (returns same promise).
 */
export function loadSprites(): Promise<SpriteBank> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const heroImg = await loadImage(heroSheetUrl());
      const keyedHero = chromaKeyToCanvas(
        heroImg,
        heroImg.naturalWidth || heroImg.width,
        heroImg.naturalHeight || heroImg.height,
      );
      sprites.heroFrames = [];
      for (let i = 0; i < HERO_FRAME_COUNT; i++) {
        sprites.heroFrames.push(trimTransparent(sliceFrame(keyedHero, i, HERO_FRAME_COUNT)));
      }

      const enemyResults = await Promise.all(
        MONSTER_KINDS.map(async (kind) => {
          const img = await loadImage(enemySpriteUrl(kind));
          const keyed = trimTransparent(chromaKeyToCanvas(
            img,
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
          ));
          return { kind, keyed };
        }),
      );
      for (const { kind, keyed } of enemyResults) {
        sprites.enemies[kind] = keyed;
      }

      sprites.ready = true;
    } catch (err) {
      console.warn('Sprite load failed; procedural fallbacks will be used.', err);
      sprites.ready = false;
    }
    return sprites;
  })();
  return loadPromise;
}

export function getHeroFrame(state: CharAnimState): HTMLCanvasElement | null {
  if (!sprites.heroFrames.length) return null;
  const idx = heroFrameIndex(state);
  return sprites.heroFrames[idx] ?? sprites.heroFrames[0] ?? null;
}

export function getEnemySprite(kind: MonsterKind): HTMLCanvasElement | null {
  return sprites.enemies[kind] ?? null;
}

/** Draw a chroma-keyed canvas centered at (cx, cy) with target height. */
export function drawSpriteCentered(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  cx: number,
  cy: number,
  targetH: number,
  flipX = false,
): void {
  if (targetH <= 0 || sprite.width <= 0 || sprite.height <= 0) return;
  const scale = targetH / sprite.height;
  const dw = sprite.width * scale;
  const dh = targetH;
  ctx.save();
  ctx.translate(cx, cy);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}
