/**
 * Tipos del Sistema de Batalla - Backend
 * Define las estructuras de datos para el motor de batalla
 */

// ============================================
// ENUMS Y CONSTANTES
// ============================================

/**
 * Tipos de estados (ailments) en batalla
 */
export type AilmentType = 
  | 'burn'
  | 'poison'
  | 'toxic'
  | 'paralysis'
  | 'freeze'
  | 'sleep'
  | 'confusion'
  | 'flinch'
  | 'leech_seed'
  | 'curse';

/**
 * Categorías de movimientos para el cálculo de daño
 */
export type MoveDamageClass = 'physical' | 'special' | 'status';

/**
 * Tipo de acción que un jugador puede tomar
 */
export type ActionType = 'attack' | 'change' | 'item' | 'run';

/**
 * Fases de la batalla
 */
export type BattlePhase = 
  | 'selecting'    // Jugadores seleccionando acción
  | 'determining'  // Determinando orden
  | 'executing'    // Ejecutando acciones
  | 'finalizing'   // Efectos finales del turno
  | 'ended';       // Batalla terminada

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Movimiento con todos sus datos para batalla
 */
export interface BattleMove {
  moveId: number;
  name: string;
  type: string;
  damageClass: MoveDamageClass;
  power: number | null;
  accuracy: number | null;
  priority: number;
  pp: number;
  maxPp: number;
  meta: {
    ailment: AilmentType | null;
    ailmentChance: number;
    statChanges: Array<{ stat: string; change: number }>;
    flinchChance: number;
    heal: number;
    minHits: number | null;
    maxHits: number | null;
    minTurns: number | null;
    maxTurns: number | null;
  };
  flags: {
    recharge: boolean;
    charge: boolean; // Movimientos de 2 turnos
    protect: boolean;
    mirror: boolean;
  };
}

/**
 * Estado activo de un Pokémon en batalla
 */
export interface ActiveAilment {
  type: AilmentType;
  turnsRemaining: number;
  appliedBy: 'player1' | 'player2';
  // Para toxic: daño acumulativo (aumenta cada turno)
  toxicTurn?: number;
  // Para confusion: si ya actúó este turno
  hasActedThisTurn?: boolean;
}

/**
 * Pokémon en batalla con estado individual
 */
export interface PokemonInBattle {
  // Identificación
  id: number;
  pokeapiId: number;
  name: string;
  types: string[];
  
  // Stats base (para cálculo de daño)
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  
  // Sprites para visualización
  sprites: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
  };
  
  // Movimientos disponibles
  moves: BattleMove[];
  
  // Estados activos
  ailments: ActiveAilment[];
  
  // Banderas para efectos especiales (2 turnos, fatiga, flinch)
  isCharging: boolean;
  chargingMove?: BattleMove;
  cannotActNextTurn: boolean;
  hasFlinched: boolean;
  
  // ¿Está fuera de combate?
  isFainted: boolean;
  
  // HP guardado para cambios (se preserva al salir)
  savedHp: number;
}

/**
 * Acción seleccionada por un jugador
 */
export interface PlayerAction {
  playerId: 'player1' | 'player2';
  type: ActionType;
  moveId?: number;
  move?: BattleMove;
  pokemonId?: number; // Para cambio de Pokémon
  targetPokemonId?: number; // Para movimientos que apuntan a un objetivo específico
}

/**
 * Resultado de una acción en batalla
 */
export interface ActionResult {
  success: boolean;
  action: PlayerAction;
  message: string;
  
  // Daño aplicado
  damage?: number;
  targetHpBefore?: number;
  targetHpAfter?: number;
  
  // Efectos del ataque (para frontend)
  isCritical?: boolean;
  effectiveness?: number; // 0 = sin efecto, 0.5 = poco efectivo, 1 = normal, 2 = super efectivo
  
  // Estado aplicado
  ailmentApplied?: AilmentType;
  ailmentSuccess?: boolean;
  
  // Cambios de stats
  statChanges?: Array<{ 
    stat: string; 
    change: number; 
    target: 'attacker' | 'defender';
  }>;
  
  // Fallo
  failed?: boolean;
  failureReason?: string;
  
  // Efectos adicionales
  isCharging?: boolean;
  cannotActNextTurn?: boolean;
  flinchedTarget?: boolean;
  
  // Multi-hit
  hits?: number;
  totalDamage?: number;
  
  // Información del atacante (para frontend)
  attackerName?: string;
  defenderName?: string;
  moveName?: string;
}

/**
 * Estado de un jugador en batalla
 */
export interface PlayerBattleState {
  playerId: 'player1' | 'player2';
  name: string;
  sessionId: string;
  
  // Equipo completo (para cambios)
  team: PokemonInBattle[];
  
  // Índice del Pokémon actualmente en batalla
  activePokemonIndex: number;
  
  //getActivePokemon(): PokemonInBattle {
  //  return this.team[this.activePokemonIndex];
  //}
  
  // ¿El jugador ha seleccionado acción este turno?
  hasSelectedAction: boolean;
  selectedAction?: PlayerAction;
}

/**
 * Estado completo de la batalla
 */
export interface BattleState {
  // Identificación
  roomCode: string;
  turn: number;
  phase: BattlePhase;
  state: 'initializing' | 'in_progress' | 'finished';
  
  // Jugadores
  players: {
    player1: PlayerBattleState;
    player2: PlayerBattleState;
  };
  
  // Acciones pendientes del turno actual
  pendingActions: {
    player1: PlayerAction | null;
    player2: PlayerAction | null;
  };
  
  // Orden de ejecución del turno actual
  executionOrder: ('player1' | 'player2')[];
  
  // Resultados de acciones del turno actual
  actionResults: ActionResult[];
  
  // Historial de turnos
  history: TurnResult[];
  
  // Efectos que se aplicarán al inicio del próximo turno
  nextTurnAilments: {
    player1: ActiveAilment[];
    player2: ActiveAilment[];
  };
  
  // Mensaje actual para UI
  currentMessage: string;
  
  // Jugador que necesita cambio obligatorio (por Pokémon debilitado)
  requiresSwitchFor: 'player1' | 'player2' | null;
  
  //Ganador (cuando termina)
  winner: 'player1' | 'player2' | null;
}

/**
 * Resultado de un turno completo
 */
export interface TurnResult {
  turnNumber: number;
  actionResults: ActionResult[];
  
  // Estado HP al final del turno
  player1ActiveHp: number;
  player2ActiveHp: number;
  
  // Pokémon que desfalleció este turno
  faintedPokemon: ('player1' | 'player2' | 'both' | null);
  
  // ¿Hay ganador?
  winner: 'player1' | 'player2' | null;
  
  // Mensaje del turno
  message: string;
}

// ============================================
// FUNCIONES HELPER TYPE
// ============================================

/**
 * Obtiene el Pokémon activo de un jugador
 */
export function getActivePokemon(player: PlayerBattleState): PokemonInBattle {
  return player.team[player.activePokemonIndex];
}

/**
 * Verifica si un jugador puede actuar
 */
export function canAct(player: PlayerBattleState): { canAct: boolean; reason: string } {
  const pokemon = getActivePokemon(player);
  
  if (pokemon.isFainted) {
    return { canAct: false, reason: 'Pokémon desfallecido' };
  }
  
  if (pokemon.cannotActNextTurn) {
    return { canAct: false, reason: 'Agotado (necesita descansar)' };
  }
  
  if (pokemon.hasFlinched) {
    return { canAct: false, reason: 'Retrocedió del miedo' };
  }
  
  // Verificar estados
  for (const ailment of pokemon.ailments) {
    switch (ailment.type) {
      case 'paralysis':
        // 25% de no actuar
        if (Math.random() < 0.25) {
          return { canAct: false, reason: 'Paralizado (no puede moverse)' };
        }
        break;
        
      case 'freeze':
        // 20% de descongelar (80% permanece congelado)
        if (Math.random() < 0.8) {
          return { canAct: false, reason: 'Congelado (no puede moverse)' };
        }
        break;
        
      case 'sleep':
        if (ailment.turnsRemaining > 0) {
          return { canAct: false, reason: 'Dormido (no puede moverse)' };
        }
        break;
        
      case 'confusion':
        // 33% de atacarse a sí mismo
        // Este caso maneja internamente, pero here indicamos que puede actuar
        // El resultado del movimiento determinará si se hiere a sí mismo
        break;
    }
  }
  
  return { canAct: true, reason: '' };
}

/**
 * Verifica si un Pokémon tiene un estado específico
 */
export function hasAilment(pokemon: PokemonInBattle, ailment: AilmentType): boolean {
  return pokemon.ailments.some(a => a.type === ailment);
}

/**
 * Obtiene el daño por estado (por turno)
 */
export function getAilmentDamage(pokemon: PokemonInBattle): number {
  let totalDamage = 0;
  
  for (const ailment of pokemon.ailments) {
    const maxHp = pokemon.maxHp;
    
    switch (ailment.type) {
      case 'burn':
      case 'poison':
        // -5% HP por turno
        totalDamage += Math.floor(maxHp * 0.05);
        break;
        
      case 'toxic':
        // Daño acumulativo: -5%, -10%, -15%, -20%, ...
        const toxicDamage = Math.floor(maxHp * 0.05 * (ailment.toxicTurn || 1));
        totalDamage += toxicDamage;
        break;
        
      case 'leech_seed':
        // -10% HP por turno
        totalDamage += Math.floor(maxHp * 0.10);
        break;
        
      case 'curse':
        // -25% HP por turno
        totalDamage += Math.floor(maxHp * 0.25);
        break;
    }
  }
  
  return totalDamage;
}

/**
 * Verifica si un equipo tiene Pokémon disponibles (HP > 0)
 */
export function hasAvailablePokemon(player: PlayerBattleState): boolean {
  return player.team.some(p => !p.isFainted && p.hp > 0);
}

/**
 * Cuenta los Pokémon restantes de un jugador
 */
export function countRemainingPokemon(player: PlayerBattleState): number {
  return player.team.filter(p => !p.isFainted && p.hp > 0).length;
}

// ============================================
// CONFIGURACIÓN
// ============================================

/**
 * Configuración del sistema de batalla
 */
export const BATTLE_CONFIG = {
  // Nivel fijo para todas las batallas
  LEVEL: 50,
  
  // Prioridades
  PRIORITY_SWITCH: 6,  // Cambiar Pokémon siempre tiene prioridad +6
  PRIORITY_MIN: -7,    // Prioridad mínima de movimientos
  PRIORITY_MAX: 5,     // Prioridad máxima de movimientos
  
  // Duración de estados (turnos)
  DEFAULT_AILMENT_TURNS: 3,
  
  // Probabilidades
  PARALYSIS_FREEZE_CHANCE: 0.25,  // 25% de no actuar
  FREEZE_UNFREEZE_CHANCE: 0.20,  // 20% de descongelar
  CONFUSION_SELF_HIT_CHANCE: 0.33,  // 33% de autolesión
  
  // Daño por estado (% del HP máximo)
  BURN_DAMAGE: 0.05,      // 5%
  POISON_DAMAGE: 0.05,   // 5%
  TOXIC_BASE_DAMAGE: 0.05,  // 5% (aumenta cada turno)
  LEECH_SEED_DAMAGE: 0.10,  // 10%
  CURSE_DAMAGE: 0.25,    // 25%
  
  // Modificador quemado (físico)
  BURN_PHYSICAL_MODIFIER: 0.5,
  
  // Aleatorio daño (85% - 100%)
  DAMAGE_RANDOM_MIN: 0.85,
  DAMAGE_RANDOM_MAX: 1.00,
  
  // STAB
  STAB_MULTIPLIER: 1.5,
  
  // Movimientos de 2 turnos
  RECHARGE_MOVES: ['hyper-beam', 'giga-impact', 'blast-burn', 'frenzy-plant', 'hydro-cannon', 'roar-of-time', 'spin-out'],
  CHARGE_MOVES: ['solar-beam', 'fly', 'dig', 'skull-bash', 'razor-wind', 'sky-attack', 'bounce', 'dive', 'shadow-force', 'phantom-force'],
  
  // Multi-hit moves
  MULTI_HIT_MOVES: ['fury-swipes', 'pin-missile', 'bullet-seed', 'double-slap', 'comet-punch', 'barrage', 'bone-rush', 'arm-thrust', 'twinneedle', 'gear-grind'],
} as const;

// ============================================
// MOVIMIENTOS ESPECIALES - LOOKUP
// ============================================

/**
 * Movimientos que requieren carga (2 turnos)
 */
// Normalizar nombres (sin guiones, sin espacios, en minúsculas)
// Esto es para comparación con move.name después de aplicar la misma normalización
export const CHARGE_MOVES = new Set([
  'solarbeam', 'fly', 'dig', 'skullbash', 'razorwind', 'skyattack',
  'bounce', 'dive', 'shadowforce', 'phantomforce', 'geomancy', 'iceburn',
  'freezeshock', 'hyperspacehole', 'prehistoricward', 'galacticoblivion',
  'soulcrushingblade', 'clangoroussoulblaze', 'splinteredstormshards'
]);

/**
 * Movimientos que causan fatiga (recharge)
 */
export const RECHARGE_MOVES = new Set([
  'hyperbeam', 'gigaimpact', 'blastburn', 'frenzyplant', 'hydrocannon',
  'roaroftime', 'spinout', 'diamondstorm', 'steameruption', 'infernooverdrive',
  'freezeray', 'sinisterarrowraid', 'maliciousmoonscar', 'tectonicrage',
  'continentalcrush', 'savagespinout', 'alloutpummeling', 'highhorsepower',
  'dynamicpunch', 'powerwhirl', 'megatonpunch', 'coil', 'gigadrain'
]);

/**
 * Movimientos que pueden golpear múltiples veces
 */
export const MULTI_HIT_MOVES = new Set([
  'furyswipes', 'pinmissile', 'bulletseed', 'doubleslap', 'cometpunch',
  'barrage', 'bonerush', 'armthrust', 'twinneedle', 'geargrind', 'scaleshot',
  'watershuriken', 'populationbomb', 'doublehit'
]);