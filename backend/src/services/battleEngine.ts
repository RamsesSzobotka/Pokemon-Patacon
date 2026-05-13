import { GAME_CONSTANTS } from '../config/constants';

export interface BattlePokemon {
  id: number;
  name: string;
  types: string[];
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  moves: MoveData[];
  status: StatusEffect | null;
  statStages: StatStages;
}

export interface MoveData {
  name: string;
  power: number | null;
  accuracy: number | null;
  type: string;
  damageClass: 'physical' | 'special' | 'status';
  priority: number;
}

export interface StatusEffect {
  type: string;
  remainingTurns: number;
}

export interface StatStages {
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export interface BattleState {
  roomCode: string;
  turn: number;
  currentPlayer: string;
  player1Team: BattlePokemon[];
  player2Team: BattlePokemon[];
  player1Active: number;
  player2Active: number;
  player1Items: PlayerItems;
  player2Items: PlayerItems;
  actions: TurnAction[];
}

export interface PlayerItems {
  potions: number;
  revives: number;
}

export interface TurnAction {
  playerId: string;
  actionType: 'attack' | 'switch' | 'item';
  moveIndex?: number;
  pokemonIndex?: number;
  itemType?: 'potion' | 'revive';
}

export class BattleEngine {
  private state: BattleState;

  constructor(roomCode: string, team1: any[], team2: any[]) {
    this.state = {
      roomCode,
      turn: 0,
      currentPlayer: '',
      player1Team: [],
      player2Team: [],
      player1Active: 0,
      player2Active: 0,
      player1Items: { potions: GAME_CONSTANTS.MAX_POTIONS, revives: GAME_CONSTANTS.MAX_REVIVES },
      player2Items: { potions: GAME_CONSTANTS.MAX_POTIONS, revives: GAME_CONSTANTS.MAX_REVIVES },
      actions: [],
    };
  }

  addAction(action: TurnAction): void {
    this.state.actions.push(action);
  }

  executeTurn(): TurnResult {
    return { success: false, message: 'Not implemented' };
  }

  getState(): BattleState {
    return this.state;
  }

  calculateDamage(attacker: BattlePokemon, defender: BattlePokemon, move: MoveData): number {
    return 0;
  }

  applyStatusEffect(pokemon: BattlePokemon, effect: string): void {}
  removeStatusEffect(pokemon: BattlePokemon): void {}
  checkFainted(pokemon: BattlePokemon): boolean { return false; }
  checkWinner(): string | null { return null; }
}

export interface TurnResult {
  success: boolean;
  message?: string;
  logs: ActionLog[];
  state: BattleState;
}

export interface ActionLog {
  player: string;
  action: string;
  damage?: number;
  effect?: string;
  target?: string;
}