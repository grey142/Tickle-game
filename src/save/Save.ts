import type { Cheats, SaveData } from '../game/types';
import { RESOLVE_MAX, STAMINA_MAX } from '../game/types';

const KEY = 'tickle-struggle-save-v1';

export const DEFAULT_CHEATS: Cheats = {
  infiniteResolve: false,
  infiniteStamina: false,
  instantStruggle: false,
  oneHitKill: false,
  unlockAllMissions: false,
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    unlockedMission: 1,
    lastMission: 1,
    lastLevel: 1,
    cheats: { ...DEFAULT_CHEATS },
    resolve: RESOLVE_MAX,
    stamina: STAMINA_MAX,
    timestamp: Date.now(),
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return {
      ...defaultSave(),
      ...parsed,
      cheats: { ...DEFAULT_CHEATS, ...(parsed.cheats || {}) },
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  data.timestamp = Date.now();
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
