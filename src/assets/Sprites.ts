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

/** Gang types have scenes 1–3; solo/boss have only _1. */
export const TICKLE_SCENE_MAX: Record<MonsterKind, number> = {
  giggle_slime: 3,
  tickle_imp: 3,
  feather_wisp: 3,
  chuckle_brute: 3,
  snicker_shade: 3,
  root_trapper: 2,
  hand_tickler: 3,
  boss_titania: 1,
  boss_guffaw: 1,
  boss_merriwink: 1,
};

export function tickleSceneUrl(kind: MonsterKind, n: number): string {
  return publicAssetUrl(`sprites/scenes/tickle_${kind}_${n}.png`);
}

/** Resolve public asset URLs against Vite `base` (e.g. './' for Pages). */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  const clean = path.replace(/^\/+/, '');
  return `${base}${clean}`;
}

export function enemySpriteUrl(kind: MonsterKind): string {
  return publicAssetUrl(`sprites/enemy_${kind}.png`);
}

export function heroSheetUrl(): string {
  return publicAssetUrl('sprites/hero_sheet.png');
}

export function heroFrameIndex(state: CharAnimState): number {
  return HERO_ANIM_FRAME[state] ?? 0;
}

const SPRITE_LOAD_TIMEOUT_MS = 8000;

function loadImage(src: string, timeoutMs = SPRITE_LOAD_TIMEOUT_MS): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reject(new Error(`Timed out loading sprite: ${src}`));
    }, timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`Failed to load sprite: ${src}`));
    };
    img.src = src;
  });
}

/**
 * Chroma-key backdrop to transparency via flood-fill from the image edges.
 * Only backdrop-connected lavender (or near-black plate) pixels are removed —
 * never punch holes through interior dark clothing, hair, shadows, or art.
 */
export function chromaKeyToCanvas(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  tolerance = 32,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = Math.max(1, srcW);
  const h = Math.max(1, srcH);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  const lav = SPRITE_KEY_LAVENDER;
  const maxLavDist = tolerance * 3;

  // Detect black plate from border samples (legacy imp/black-bg art).
  const cornerIdx = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  let blackish = 0;
  for (const i of cornerIdx) {
    if (Math.max(px[i], px[i + 1], px[i + 2]) <= 28) blackish++;
  }
  const keyBlack = blackish >= 2;
  const blackMax = 22;

  const isBackdrop = (i: number): boolean => {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const dLav = Math.abs(r - lav.r) + Math.abs(g - lav.g) + Math.abs(b - lav.b);
    if (dLav <= maxLavDist) return true;
    if (keyBlack && Math.max(r, g, b) <= blackMax) return true;
    return false;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const tryPush = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (!isBackdrop(i)) return;
    visited[p] = 1;
    stack.push(p);
  };

  // Seed from full border so enclosed holes in the art stay opaque.
  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    px[p * 4 + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
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
  /** Indexed 0 unused; scenes[kind][n] for n=1..max */
  tickleScenes: Partial<Record<MonsterKind, (HTMLCanvasElement | undefined)[]>>;
}

export const sprites: SpriteBank = {
  ready: false,
  heroFrames: [],
  enemies: {},
  tickleScenes: {},
};

let loadPromise: Promise<SpriteBank> | null = null;

/**
 * Load all placeholder sprites, chroma-key lavender backgrounds, slice hero
 * sheet into 6 frames. Safe to call multiple times (returns same promise).
 */
export function loadSprites(): Promise<SpriteBank> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const overall = (async () => {
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

        const enemyResults = await Promise.allSettled(
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
        for (const result of enemyResults) {
          if (result.status === 'fulfilled') {
            sprites.enemies[result.value.kind] = result.value.keyed;
          } else {
            console.warn('Enemy sprite skipped:', result.reason);
          }
        }

        const sceneJobs: Promise<void>[] = [];
        for (const kind of MONSTER_KINDS) {
          const maxN = TICKLE_SCENE_MAX[kind];
          const slots: (HTMLCanvasElement | undefined)[] = [];
          sprites.tickleScenes[kind] = slots;
          for (let n = 1; n <= maxN; n++) {
            const sceneN = n;
            sceneJobs.push(
              (async () => {
                try {
                  const img = await loadImage(tickleSceneUrl(kind, sceneN));
                  // Keep authored plate (lavender/black). Runtime chroma was
                  // punching holes through soft gradients and dark clothing.
                  const w = img.naturalWidth || img.width;
                  const h = img.naturalHeight || img.height;
                  const c = document.createElement('canvas');
                  c.width = Math.max(1, w);
                  c.height = Math.max(1, h);
                  c.getContext('2d')!.drawImage(img, 0, 0);
                  slots[sceneN] = c;
                } catch (err) {
                  console.warn(`Tickle scene skipped: ${kind}_${sceneN}`, err);
                }
              })(),
            );
          }
        }
        await Promise.allSettled(sceneJobs);

        sprites.ready = sprites.heroFrames.length > 0;
      } catch (err) {
        console.warn('Sprite load failed; procedural fallbacks will be used.', err);
        sprites.ready = false;
      }
      return sprites;
    })();

    const timeout = new Promise<SpriteBank>((resolve) => {
      window.setTimeout(() => {
        if (!sprites.ready) {
          console.warn(`Sprite load exceeded ${SPRITE_LOAD_TIMEOUT_MS}ms; continuing with fallbacks.`);
          sprites.ready = sprites.heroFrames.length > 0;
        }
        resolve(sprites);
      }, SPRITE_LOAD_TIMEOUT_MS);
    });

    return Promise.race([overall, timeout]);
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

/**
 * Return chroma-keyed tickle scene for kind + grabber count.
 * Clamps to available frames (solo/boss → always 1; gang → min(count, 3)).
 */
export function getTickleScene(kind: MonsterKind, count: number): HTMLCanvasElement | null {
  const maxN = TICKLE_SCENE_MAX[kind] ?? 1;
  const n = Math.max(1, Math.min(maxN, Math.floor(count) || 1));
  const slots = sprites.tickleScenes[kind];
  if (!slots) return null;
  return slots[n] ?? slots[1] ?? null;
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
