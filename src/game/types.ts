export type Vec2 = { x: number; y: number };

export type CharAnimState =
  | 'idle'
  | 'run'
  | 'slash'
  | 'dash'
  | 'grabbed'
  | 'tickled'
  | 'gameOver';

export type MonsterTier = 'L1' | 'L2' | 'L3' | 'Boss';

export type MonsterKind =
  | 'giggle_slime'
  | 'tickle_imp'
  | 'feather_wisp'
  | 'chuckle_brute'
  | 'snicker_shade'
  | 'root_trapper'
  | 'hand_tickler'
  | 'boss_titania'
  | 'boss_guffaw'
  | 'boss_merriwink';

export interface MonsterDef {
  id: MonsterKind;
  name: string;
  tier: MonsterTier;
  color: string;
  accent: string;
  shape: 'blob' | 'imp' | 'wisp' | 'brute' | 'shade' | 'trap' | 'hand' | 'boss';
  hp: number;
  speed: number;
  radius: number;
  grabDelay: number; // seconds before tickle starts after grab
  /** base resolve drain per second while tickling */
  drainRates: number[]; // staged rates
  /** seconds at each drain stage (last stage lasts forever) */
  drainStages: number[];
  gangMax: number;
  gangDrainMult: number[]; // index by gang size-1
  struggleHardness: number; // 0..1, higher = slower fill
  knockbackOnHit: number;
  description: string;
}

export interface Cheats {
  infiniteResolve: boolean;
  infiniteStamina: boolean;
  instantStruggle: boolean;
  oneHitKill: boolean;
  unlockAllMissions: boolean;
}

export interface SaveData {
  version: number;
  unlockedMission: number; // 1..10
  lastMission: number;
  lastLevel: number;
  cheats: Cheats;
  resolve: number;
  stamina: number;
  playerX?: number;
  playerY?: number;
  levelCleared?: boolean;
  timestamp: number;
}

export interface LevelEnemySpawn {
  kind: MonsterKind;
  x: number;
  y: number;
}

export interface LevelPotion {
  x: number;
  y: number;
  amount: number;
}

export interface LevelDef {
  mission: number;
  level: number; // 1..3
  name: string;
  width: number;
  height: number;
  playerStart: Vec2;
  exit: Vec2;
  enemies: LevelEnemySpawn[];
  potions: LevelPotion[];
  walls: { x: number; y: number; w: number; h: number }[];
  flavor: string;
}

export const RESOLVE_MAX = 1500;
export const STAMINA_MAX = 500;
export const STAMINA_REGEN = 90; // per second
export const MELEE_COST = 500 / 8;
export const PROJECTILE_COST = 125;
export const DASH_COST = 125;
export const DASH_DURATION = 0.22;
export const DASH_SPEED = 520;
export const PLAYER_SPEED = 210;
export const MELEE_RANGE = 58;
export const MELEE_ARC = Math.PI * 0.7;
export const PROJECTILE_SPEED = 420;
export const IMMUNITY_AFTER_ESCAPE = 1.1;
