export type LevelConfig = {
  level: number;
  minXp: number;
  maxXp: number | null;
  maxStake: number;
};

const LEVEL_CONFIG: LevelConfig[] = [
  { level: 1, minXp: 0, maxXp: 99, maxStake: 5 },
  { level: 2, minXp: 100, maxXp: 499, maxStake: 10 },
  { level: 3, minXp: 500, maxXp: 1999, maxStake: 20 },
  { level: 4, minXp: 2000, maxXp: 9999, maxStake: 35 },
  { level: 5, minXp: 10000, maxXp: null, maxStake: 50 },
];

function fallbackLevel(level: number): LevelConfig {
  const normalized = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  const computedStake = Math.min(50, Math.max(5, normalized * 5));
  return {
    level: normalized,
    minXp: 0,
    maxXp: null,
    maxStake: computedStake,
  };
}

export function getLevelConfig(level: number): LevelConfig {
  return LEVEL_CONFIG.find((item) => item.level === level) ?? fallbackLevel(level);
}

export function getLevelStakeCap(level: number): number {
  return getLevelConfig(level).maxStake;
}

export function getLevelProgress(level: number, xp: number): {
  progressPct: number;
  currentXp: number;
  nextLevelXp: number | null;
  remainingXp: number | null;
} {
  const config = getLevelConfig(level);
  const currentXp = Math.max(0, Number.isFinite(xp) ? xp : 0);

  if (config.maxXp === null) {
    return {
      progressPct: 100,
      currentXp,
      nextLevelXp: null,
      remainingXp: null,
    };
  }

  const range = Math.max(1, config.maxXp - config.minXp + 1);
  const inRange = Math.min(Math.max(currentXp - config.minXp, 0), range);
  const progressPct = Math.min(100, Math.max(0, (inRange / range) * 100));
  const nextLevelXp = config.maxXp + 1;

  return {
    progressPct,
    currentXp,
    nextLevelXp,
    remainingXp: Math.max(0, nextLevelXp - currentXp),
  };
}
