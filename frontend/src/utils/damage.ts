export interface Move {
  power: number | null;
  type: string;
  damageClass: 'physical' | 'special' | 'status';
}

export interface Pokemon {
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  types: string[];
}

export function calculateDamage(
  attacker: Pokemon,
  defender: Pokemon,
  move: Move,
  level: number = 50
): number {
  if (move.damageClass === 'status' || !move.power) return 0;

  const attackStat = move.damageClass === 'physical'
    ? attacker.attack
    : attacker.spAttack;

  const defenseStat = move.damageClass === 'physical'
    ? defender.defense
    : defender.spDefense;

  const baseDamage = Math.floor(
    Math.floor(
      Math.floor((2 * level) / 5 + 2) * move.power * attackStat / defenseStat
    ) / 50
  ) + 2;

  const randomFactor = (Math.floor(Math.random() * 16) + 85) / 100;

  return Math.floor(baseDamage * randomFactor);
}

export function getTypeMultiplier(attackType: string, defenderTypes: string[]): number {
  return 1;
}