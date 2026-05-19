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
    // V3: Nuevos flags
    evasive?: boolean;        // Puede evadir ataques (Fly, Dig)
    interruptible?: boolean;  // Puede ser interrumpido durante carga
    fatigue?: boolean;        // Aplica fatiga al atacante
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
  
  // V3: Movimientos de 2 Turnos
  /** ¿Está en fase de carga o ejecución de movimiento de 2 turnos? */
  isChargingTwoTurn: boolean;
  /** Movimiento de 2 turnos siendo cargado/ejecutado */
  currentTwoTurnMove: BattleMove | null;
  /** Fase actual en la secuencia de 2 turnos */
  chargePhase: 'charge' | 'execute' | null;
  
  // V3: Fatiga
  /** ¿Está fatigado después de ejecutar movimiento agotador? */
  isFatigued: boolean;
  /** Causa de la fatiga ('recharge' = obligatorio, 'exhaustion' = normal) */
  fatigueSource: 'recharge' | 'exhaustion' | null;
  
  // V3: Evasión
  /** ¿Está cargando movimiento evasivo para evitar ataques? */
  isEvasivelyCharging: boolean;
  /** Movimiento evasivo siendo cargado */
  evasiveChargeMove: BattleMove | null;
  
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

// ============================================
// V3: METADATOS Y CONSTANTES (2 Turnos y Fatiga)
// ============================================

/**
 * Metadatos para movimientos de 2 turnos
 */
export interface V3MoveMetadata {
  moveId: number;
  name: string;
  isTwoTurn: boolean;
  chargeMessage: string;
  executeMessage: string;
  hasRecharge?: boolean;    // Requiere turno de recharge obligatorio
  isFatigueable?: boolean;  // Se aplica fatiga (distinto de recharge)
}

/**
 * Constante V3_MOVES: Mapeo de ID → Metadatos para movimientos de 2 turnos
 * Incluye movimientos que requieren carga o tienen fase de recharge
 */
export const V3_MOVES: Record<number, V3MoveMetadata> = {
  76: {  // Solar Beam
    moveId: 76,
    name: 'Solar Beam',
    isTwoTurn: true,
    chargeMessage: 'is absorbing solar energy',
    executeMessage: 'uses Solar Beam',
    isFatigueable: true,
    hasRecharge: false,
  },
  63: {  // Hyper Beam
    moveId: 63,
    name: 'Hyper Beam',
    isTwoTurn: false,
    chargeMessage: '',
    executeMessage: 'uses Hyper Beam',
    hasRecharge: true,
  },
  143: {  // Sky Attack
    moveId: 143,
    name: 'Sky Attack',
    isTwoTurn: true,
    chargeMessage: 'is gathering power',
    executeMessage: 'uses Sky Attack',
    isFatigueable: false,
    hasRecharge: false,
  },
  91: {  // Dig
    moveId: 91,
    name: 'Dig',
    isTwoTurn: true,
    chargeMessage: 'is digging underground',
    executeMessage: 'uses Dig',
    isFatigueable: true,
    hasRecharge: false,
  },
  34: {  // Fly
    moveId: 34,
    name: 'Fly',
    isTwoTurn: true,
    chargeMessage: 'is flying up',
    executeMessage: 'uses Fly',
    isFatigueable: false,
    hasRecharge: false,
  },
  264: {  // Focus Punch
    moveId: 264,
    name: 'Focus Punch',
    isTwoTurn: true,
    chargeMessage: 'is tightening its focus',
    executeMessage: 'uses Focus Punch',
    isFatigueable: false,
    hasRecharge: false,
  },
  37: {  // Skull Bash
    moveId: 37,
    name: 'Skull Bash',
    isTwoTurn: true,
    chargeMessage: 'is lowering its head',
    executeMessage: 'uses Skull Bash',
    isFatigueable: false,
    hasRecharge: false,
  },
  13: {  // Razor Wind
    moveId: 13,
    name: 'Razor Wind',
    isTwoTurn: true,
    chargeMessage: 'is creating a whirlwind',
    executeMessage: 'uses Razor Wind',
    isFatigueable: false,
    hasRecharge: false,
  },
  339: {  // Bounce
    moveId: 339,
    name: 'Bounce',
    isTwoTurn: true,
    chargeMessage: 'is bouncing high',
    executeMessage: 'uses Bounce',
    isFatigueable: true,
    hasRecharge: false,
  },
  291: {  // Dive
    moveId: 291,
    name: 'Dive',
    isTwoTurn: true,
    chargeMessage: 'is diving underwater',
    executeMessage: 'uses Dive',
    isFatigueable: true,
    hasRecharge: false,
  },
};

/**
 * Metadatos para movimientos evasivos
 */
export interface EvasiveMoveMetadata {
  moveId: number;
  name: string;
  evasionType: 'full' | 'partial';
  chargeMessage: string;
  executeMessage: string;
  vulnerableTo: string[];
}

/**
 * Constante EVASIVE_MOVES: Movimientos que pueden evadir ataques
 * Se usan durante la fase de carga para determinar si un ataque puede golpear
 */
export const EVASIVE_MOVES: Record<number, EvasiveMoveMetadata> = {
  34: {  // Fly
    moveId: 34,
    name: 'Fly',
    evasionType: 'full',
    chargeMessage: 'is flying up',
    executeMessage: 'uses Fly',
    vulnerableTo: ['Thunder', 'Hurricane', 'Gust', 'Twister', 'Sky Uppercut'],
  },
  91: {  // Dig
    moveId: 91,
    name: 'Dig',
    evasionType: 'full',
    chargeMessage: 'is digging underground',
    executeMessage: 'uses Dig',
    vulnerableTo: ['Earthquake', 'Magnitude'],
  },
  339: {  // Bounce
    moveId: 339,
    name: 'Bounce',
    evasionType: 'full',
    chargeMessage: 'is bouncing high',
    executeMessage: 'uses Bounce',
    vulnerableTo: ['Thunder', 'Hurricane', 'Gust', 'Sky Uppercut'],
  },
  291: {  // Dive
    moveId: 291,
    name: 'Dive',
    evasionType: 'full',
    chargeMessage: 'is diving underwater',
    executeMessage: 'uses Dive',
    vulnerableTo: ['Surf', 'Earthquake', 'Dive'],
  },
  442: {  // Shadow Force
    moveId: 442,
    name: 'Shadow Force',
    evasionType: 'full',
    chargeMessage: 'is vanishing into shadows',
    executeMessage: 'uses Shadow Force',
    vulnerableTo: ['Moonlight', 'Sunsteel Strike'],
  },
};

/**
 * Metadatos para movimientos que causan fatiga
 */
export interface FatigueMoveMetadata {
  moveId: number;
  name: string;
  fatigueStrength: 'mild' | 'strong';
  fatigueType: 'recharge' | 'exhaustion';
  turnsToRecover: number;
}

/**
 * Constante FATIGUE_MOVES: Movimientos que aplican fatiga/recharge
 * Define qué movimientos causan debilitamiento en el siguiente turno
 */
export const FATIGUE_MOVES: Record<number, FatigueMoveMetadata> = {
  63: {  // Hyper Beam
    moveId: 63,
    name: 'Hyper Beam',
    fatigueStrength: 'strong',
    fatigueType: 'recharge',
    turnsToRecover: 1,
  },
  76: {  // Solar Beam
    moveId: 76,
    name: 'Solar Beam',
    fatigueStrength: 'mild',
    fatigueType: 'exhaustion',
    turnsToRecover: 1,
  },
  339: {  // Bounce
    moveId: 339,
    name: 'Bounce',
    fatigueStrength: 'mild',
    fatigueType: 'exhaustion',
    turnsToRecover: 1,
  },
  291: {  // Dive
    moveId: 291,
    name: 'Dive',
    fatigueStrength: 'mild',
    fatigueType: 'exhaustion',
    turnsToRecover: 1,
  },
};

/**
 * TEST_MOVES: Movimientos simulados para pruebas unitarias
 * No requieren datos de base de datos
 */
export const TEST_MOVES = {
  SOLAR_BEAM: {
    moveId: 999001,
    name: 'Test Solar Beam',
    type: 'grass',
    damageClass: 'special' as const,
    power: 120,
    accuracy: 100,
    priority: 0,
    pp: 10,
    maxPp: 10,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: 2,
      maxTurns: 2,
    },
    flags: {
      recharge: false,
      charge: true,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: true,
      fatigue: true,
    },
  } as BattleMove,
  
  HYPER_BEAM: {
    moveId: 999002,
    name: 'Test Hyper Beam',
    type: 'normal',
    damageClass: 'special' as const,
    power: 150,
    accuracy: 90,
    priority: 0,
    pp: 5,
    maxPp: 5,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: null,
      maxTurns: null,
    },
    flags: {
      recharge: true,
      charge: false,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: false,
      fatigue: true,
    },
  } as BattleMove,
  
  FLY: {
    moveId: 999003,
    name: 'Test Fly',
    type: 'flying',
    damageClass: 'physical' as const,
    power: 90,
    accuracy: 100,
    priority: 0,
    pp: 15,
    maxPp: 15,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: 2,
      maxTurns: 2,
    },
    flags: {
      recharge: false,
      charge: true,
      protect: false,
      mirror: false,
      evasive: true,
      interruptible: true,
      fatigue: false,
    },
  } as BattleMove,
  
  NORMAL_ATTACK: {
    moveId: 999004,
    name: 'Test Normal Attack',
    type: 'normal',
    damageClass: 'physical' as const,
    power: 40,
    accuracy: 100,
    priority: 0,
    pp: 30,
    maxPp: 30,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: null,
      maxTurns: null,
    },
    flags: {
      recharge: false,
      charge: false,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: false,
      fatigue: false,
    },
  } as BattleMove,

  SKULL_BASH: {
    moveId: 999005,
    name: 'Test Skull Bash',
    type: 'normal',
    damageClass: 'physical' as const,
    power: 100,
    accuracy: 100,
    priority: 0,
    pp: 15,
    maxPp: 15,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [{ stat: 'defense', change: 1 }],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: 2,
      maxTurns: 2,
    },
    flags: {
      recharge: false,
      charge: true,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: true,
      fatigue: false,
    },
  } as BattleMove,
};