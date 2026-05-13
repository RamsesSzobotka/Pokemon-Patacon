export const GAME_CONSTANTS = {
  LEVEL: 50,
  MAX_TEAM_SIZE: 6,
  MAX_LEGENDARIES: 1,
  MAX_POTIONS: 3,
  MAX_REVIVES: 2,
  STATUS_TURNS: 3,
  TURN_TIMEOUT_SECONDS: 30,
  ROOM_TIMEOUT_MINUTES: 30,
} as const;

export const STATUS_EFFECTS = {
  BURN: { turns: 3, damagePercent: 0.05, attackPenalty: 0.5 },
  PARALYSIS: { turns: 3, speedPenalty: 0.5, freezeChance: 0.25 },
  SLEEP: { turns: 3, canWake: true },
  FREEZE: { turns: 3, canThaw: true },
  POISON: { turns: 3, damagePercent: 0.05 },
  ATTRACTION: { turns: 3, failChance: 0.5 },
  CONFUSION: { turns: 3, selfHitChance: 0.33 },
} as const;