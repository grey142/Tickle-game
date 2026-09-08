import type { LevelDef, MonsterKind } from '../game/types';
import { bossHpForMission } from './MonsterDefs';

const M1_WALLS = [
  { x: 0, y: 0, w: 1400, h: 40 },
  { x: 0, y: 760, w: 1400, h: 40 },
  { x: 0, y: 0, w: 40, h: 800 },
  { x: 1360, y: 0, w: 40, h: 800 },
  // North stubs — leave a wide mid corridor (y ~340–460) open to the exit
  { x: 280, y: 80, w: 40, h: 200 },
  { x: 560, y: 80, w: 40, h: 180 },
  { x: 880, y: 80, w: 40, h: 200 },
  // South stubs
  { x: 400, y: 520, w: 40, h: 200 },
  { x: 720, y: 540, w: 200, h: 40 },
  { x: 1040, y: 520, w: 40, h: 200 },
];

function rectRoom(
  mission: number,
  level: number,
  name: string,
  flavor: string,
  enemies: LevelDef['enemies'],
  potions: LevelDef['potions'],
  extraWalls: LevelDef['walls'] = [],
  w = 1400,
  h = 800,
): LevelDef {
  return {
    mission,
    level,
    name,
    width: w,
    height: h,
    playerStart: { x: 100, y: h / 2 },
    exit: { x: w - 90, y: h / 2 },
    enemies,
    potions,
    walls: [
      { x: 0, y: 0, w, h: 40 },
      { x: 0, y: h - 40, w, h: 40 },
      { x: 0, y: 0, w: 40, h },
      { x: w - 40, y: 0, w: 40, h },
      ...extraWalls,
    ],
    flavor,
  };
}

const BOSS_KINDS: MonsterKind[] = ['boss_titania', 'boss_guffaw', 'boss_merriwink'];

function makeBossLevel(mission: number): LevelDef {
  const boss = BOSS_KINDS[(mission - 1) % 3];
  const adds: LevelDef['enemies'] =
    mission <= 3
      ? [
          { kind: 'giggle_slime', x: 500, y: 220 },
          { kind: 'tickle_imp', x: 500, y: 580 },
        ]
      : mission <= 6
        ? [
            { kind: 'feather_wisp', x: 420, y: 200 },
            { kind: 'chuckle_brute', x: 420, y: 600 },
            { kind: 'giggle_slime', x: 700, y: 400 },
          ]
        : [
            { kind: 'snicker_shade', x: 380, y: 250 },
            { kind: 'feather_wisp', x: 380, y: 550 },
            { kind: 'chuckle_brute', x: 620, y: 200 },
            { kind: 'tickle_imp', x: 620, y: 600 },
          ];

  return rectRoom(
    mission,
    3,
    `Mission ${mission} — Boss Chamber`,
    `Defeat ${boss.replace(/_/g, ' ')}. HP scales with mission (${bossHpForMission(mission)}).`,
    [{ kind: boss, x: 1050, y: 400 }, ...adds],
    [
      { x: 200, y: 200, amount: 400 },
      { x: 200, y: 600, amount: 400 },
      { x: 700, y: 400, amount: 300 },
    ],
    [
      { x: 300, y: 120, w: 40, h: 180 },
      { x: 300, y: 500, w: 40, h: 180 },
    ],
  );
}

function scaffoldLevel(mission: number, level: number): LevelDef {
  if (level === 3) return makeBossLevel(mission);

  const pool: MonsterKind[] =
    level === 1
      ? ['giggle_slime', 'tickle_imp', 'feather_wisp']
      : ['giggle_slime', 'tickle_imp', 'feather_wisp', 'chuckle_brute', 'snicker_shade'];

  const count = level === 1 ? 4 + mission : 6 + Math.min(mission, 6);
  const enemies: LevelDef['enemies'] = [];
  for (let i = 0; i < count; i++) {
    const kind = pool[(i + mission) % pool.length];
    enemies.push({
      kind,
      x: 350 + (i % 5) * 180 + (mission * 7) % 40,
      y: 160 + Math.floor(i / 5) * 200 + ((i * 37) % 80),
    });
  }

  return rectRoom(
    mission,
    level,
    `Mission ${mission}-${level}`,
    level === 1
      ? 'Scout rooms — learn grab/struggle against L1/L2 pests.'
      : 'Escalation — denser packs and L3 shades appear.',
    enemies,
    [
      { x: 250, y: 150, amount: 250 },
      { x: 700, y: 650, amount: 300 },
      { x: 1100, y: 300, amount: 250 },
    ],
    level === 2
      ? [
          { x: 400, y: 200, w: 40, h: 250 },
          { x: 750, y: 350, w: 250, h: 40 },
          { x: 1000, y: 150, w: 40, h: 300 },
        ]
      : [
          { x: 450, y: 300, w: 180, h: 40 },
          { x: 850, y: 200, w: 40, h: 220 },
        ],
  );
}

/** Fully tuned Mission 1 levels */
const MISSION_1: LevelDef[] = [
  {
    mission: 1,
    level: 1,
    name: 'Mission 1-1 — Whisper Grove',
    width: 1400,
    height: 800,
    playerStart: { x: 120, y: 400 },
    // Keep exit clear of the right border wall (starts at x=1360)
    exit: { x: 1260, y: 400 },
    flavor: 'Two pest types. Grab → mash Struggle. Follow the open mid lane to the exit shrine.',
    walls: M1_WALLS,
    potions: [
      { x: 360, y: 560, amount: 350 },
      { x: 700, y: 200, amount: 300 },
      { x: 1100, y: 600, amount: 400 },
    ],
    enemies: [
      { kind: 'giggle_slime', x: 420, y: 240 },
      { kind: 'giggle_slime', x: 620, y: 560 },
      { kind: 'tickle_imp', x: 780, y: 240 },
      { kind: 'tickle_imp', x: 980, y: 560 },
      { kind: 'giggle_slime', x: 1120, y: 240 },
    ],
  },
  {
    mission: 1,
    level: 2,
    name: 'Mission 1-2 — Giggle Galleries',
    width: 1500,
    height: 850,
    playerStart: { x: 100, y: 425 },
    exit: { x: 1380, y: 425 },
    flavor: 'More types and denser rooms. Watch for knockback wisps.',
    walls: [
      { x: 0, y: 0, w: 1500, h: 40 },
      { x: 0, y: 810, w: 1500, h: 40 },
      { x: 0, y: 0, w: 40, h: 850 },
      { x: 1460, y: 0, w: 40, h: 850 },
      // Paired stubs with ~80px mid gaps so spawn→exit stays walkable
      { x: 300, y: 120, w: 40, h: 240 },
      { x: 300, y: 500, w: 40, h: 220 },
      { x: 560, y: 280, w: 180, h: 40 },
      { x: 860, y: 100, w: 40, h: 240 },
      { x: 860, y: 520, w: 40, h: 220 },
      { x: 1120, y: 560, w: 180, h: 40 },
    ],
    potions: [
      { x: 220, y: 200, amount: 300 },
      { x: 500, y: 700, amount: 350 },
      { x: 980, y: 250, amount: 300 },
      { x: 1250, y: 650, amount: 400 },
    ],
    enemies: [
      { kind: 'giggle_slime', x: 400, y: 220 },
      { kind: 'tickle_imp', x: 400, y: 620 },
      { kind: 'feather_wisp', x: 680, y: 200 },
      { kind: 'chuckle_brute', x: 700, y: 620 },
      { kind: 'feather_wisp', x: 980, y: 450 },
      { kind: 'snicker_shade', x: 1200, y: 280 },
      { kind: 'tickle_imp', x: 1200, y: 600 },
    ],
  },
  makeBossLevel(1),
];

export const ALL_LEVELS: LevelDef[][] = [];
for (let m = 1; m <= 10; m++) {
  if (m === 1) {
    ALL_LEVELS.push(MISSION_1);
  } else {
    ALL_LEVELS.push([scaffoldLevel(m, 1), scaffoldLevel(m, 2), makeBossLevel(m)]);
  }
}

export function getLevel(mission: number, level: number): LevelDef {
  return ALL_LEVELS[mission - 1][level - 1];
}

export const MISSION_TITLES = [
  'Whisper Grove',
  'Silk Catacombs',
  'Laughing Marsh',
  'Velvet Spire',
  'Echoing Vaults',
  'Featherfall Keep',
  'Mirthforge',
  'Gilded Menagerie',
  'Nightcap Citadel',
  'Throne of Teases',
];
