

export interface StatModifier {
  stat: keyof PlayerStats | 'critChance' | 'critDamage' | 'healthRegen' | 'attackSpeed' | 'movementSpeed'; // Added attackSpeed & movementSpeed
  value: number;
  type: 'flat' | 'percent'; // flat or percentage bonus
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  modifiers: StatModifier[];
  icon: string; // Placeholder for icon - could be emoji or simple string
  goldValue: number;
  levelRequirement?: number;
  enhancementLevel: number; // New: For equipment enhancement
}

export enum ItemType {
  WEAPON = '무기',
  ARMOR_HEAD = '투구',
  ARMOR_CHEST = '갑옷',
  ARMOR_LEGS = '다리 보호구',
  ARMOR_FEET = '장화',
  ARMOR_HANDS = '장갑',
  RING = '반지',
  AMULET = '목걸이',
}

export enum Rarity {
  COMMON = '일반', // White
  UNCOMMON = '고급', // Blue
  RARE = '희귀', // Yellow
  EPIC = '영웅', // Purple
  LEGENDARY = '전설', // Orange
}

export enum StatusEffectType {
  POISON = 'poison',
  STUN = 'stun',
  DEFENSE_DOWN = 'defense_down',
  ATTACK_SPEED_BUFF = 'attack_speed_buff', 
  MOVEMENT_SPEED_BUFF = 'movement_speed_buff', 
  VULNERABILITY = 'vulnerability', 
  SLOW = 'slow', 
  BLEED = 'bleed', 
  ATTACK_BUFF = 'attack_buff',
  ALL_STATS_BUFF = 'all_stats_buff', // New: For Tactical Advantage
  GOLD_FIND_BUFF = 'gold_find_buff', // New: For Lucky Streak
  MASTER_TACTICIAN_BUFF = 'master_tactician_buff', // New: For Master Tactician
}

export interface StatusEffectDefinition { 
  name: string;
  icon: string;
  defaultPotency: number; // For MASTER_TACTICIAN_BUFF, this might be 0 or not directly used if bonuses are fixed in skill def
  defaultDuration: number;
  description: (potencyOrDuration: number, duration?: number) => string;
  isBuff: boolean; 
}

export interface StatusEffectInstance {
  id: string; 
  type: StatusEffectType;
  name: string; 
  icon: string; 
  description: string; 
  durationTicks: number; 
  initialDuration: number; 
  potency: number; 
  sourceId: string; 
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  attackSpeed: number; 
}

export interface ThreeDPosition {
  x: number;
  y: number;
  z: number;
}

export interface UnstoppableForceBuff {
  attacksRemaining: number;
  critChanceBonus: number;
}

export interface RetributionBuff {
  attacksRemaining: number;
  damageBonusMultiplier: number;
}

export interface Player extends PlayerStats {
  id: string;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  gold: number;
  skillPoints: number;
  critChance: number; 
  critDamage: number; 
  healthRegen: number; 
  activeStatusEffects: StatusEffectInstance[];
  position: ThreeDPosition;
  targetPosition?: ThreeDPosition;
  movementSpeed: number;
  engagedMonsterId: string | null;
  targetUpdateCooldown?: number; 
  enhancementStones: number; // New: Currency for item enhancement

  // Skill-specific states
  powerStrikePendingDamage: number; 
  consecutiveAttackCount: number; 
  lastAttackTick: number; 
  unstoppableForceBuff: UnstoppableForceBuff | null; 
  dodgedThisTick: boolean; 
  retributionBuff: RetributionBuff | null; 
  recentKills: Array<{ tick: number }>; 
  masterTacticianAppliedWave: number; 
}

export interface MonsterDefinition {
  id: string;
  name: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  goldDrop: [min: number, max: number];
  xpDrop: number;
  color: string;
  sizeClass?: string; 
  isBoss?: boolean; 
  appliesEffect?: { type: StatusEffectType; chance: number; potency: number; duration: number };
}

export interface ActiveMonster extends MonsterDefinition {
  currentHp: number;
  instanceId: string;
  activeStatusEffects: StatusEffectInstance[];
  scaledHp: number;
  scaledAttack: number;
  scaledDefense: number;
  scaledXpDrop: number;
  scaledGoldDrop: [min: number, max: number];
  position: ThreeDPosition;
  targetPosition?: ThreeDPosition;
  movementSpeed: number;
  isEngaged: boolean;
  targetUpdateCooldown?: number; 
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: (level: number) => string;
  maxLevel: number;
  cost: (currentLevel: number) => number;
  effects: (level: number) => StatModifier[];
  icon: string;
  prerequisites?: string[];
}

export interface PlayerSkill extends SkillDefinition {
  currentLevel: number;
}

export interface EquippedItems {
  [ItemType.WEAPON]?: Item;
  [ItemType.ARMOR_HEAD]?: Item;
  [ItemType.ARMOR_CHEST]?: Item;
  [ItemType.ARMOR_LEGS]?: Item;
  [ItemType.ARMOR_FEET]?: Item;
  [ItemType.ARMOR_HANDS]?: Item;
  [ItemType.RING]?: Item;
  [ItemType.AMULET]?: Item;
}

export interface BattleMessage {
  id: string;
  text: string;
  type: 'damage' | 'heal' | 'info' | 'loot' | 'error' | 'critical' | 'effect_damage' | 'effect_applied' | 'effect_resisted' | 'effect_expire' | 'boss_spawn' | 'boss_defeat' | 'shop' | 'skill_proc' | 'permanent_upgrade' | 'ng_plus' | 'item_enhanced' | 'item_enhance_fail'; 
  timestamp: number;
}

export type PanelType = 'inventory' | 'skills' | 'character' | 'shop' | 'altar_of_legacy' | 'enhancement' | null;

// Represents the *levels* of permanent upgrades
export interface PermanentStatsLevels {
  maxHp: number;
  attack: number;
  defense: number;
  healthRegen: number;
  // critChance?: number; // Example for future extension
  // goldFind?: number;   // Example for future extension
}

// Configuration for a single permanent upgrade type
export interface PermanentUpgradeConfigItem {
  key: keyof PermanentStatsLevels;
  name: string;
  description: (bonusPerLevel: number, currentLevel: number, nextBonus: number) => string;
  bonusPerLevel: number;
  baseCost: number;
  costIncreasePerLevel: number; // Linear increase for simplicity
  maxUpgradeLevel: number;
  isPercentage?: boolean; // If the bonusPerLevel should be treated as a percentage (e.g., 0.01 for 1%)
  icon: string;
}

// Holds all persistent progress data for the player
export interface PersistentProgress {
  essence: number;
  permanentStatsLevels: PermanentStatsLevels;
  highestWaveAchieved: number; // To track overall progress
}

// Initial stats for a fresh run, before permanent upgrades are applied
export type InitialPlayerRunStats = Omit<Player, 
  'id' | 
  'level' | 
  'experience' | 
  'experienceToNextLevel' | 
  'skillPoints' | 
  'activeStatusEffects' | 
  'position' | 
  'targetPosition' |
  'movementSpeed' | 
  'engagedMonsterId' | 
  'targetUpdateCooldown' |
  'powerStrikePendingDamage' | 
  'consecutiveAttackCount' | 
  'lastAttackTick' |
  'unstoppableForceBuff' |
  'dodgedThisTick' |
  'retributionBuff' | 
  'recentKills' | 
  'masterTacticianAppliedWave' |
  'enhancementStones' // Enhancement stones are reset per run
  // Gold is retained, so it's part of the Player object that gets partially reset
>;


export interface ItemEnhancementConfig {
  maxLevelByRarity: Record<Rarity, number>;
  baseGoldCost: number;
  goldCostIncreaseFactorPerLevel: number; // Multiplied by (1 + currentEnhancementLevel)
  baseStoneCost: number;
  stoneCostIncreaseFactorPerLevel: number; // Multiplied by (1 + currentEnhancementLevel)
  itemLevelMultiplier: number; // Gold/Stone costs are also multiplied by item's base level requirement (or player level if none)
  bonusPerLevel: number; // e.g., 0.05 for 5% boost to each modifier's value per enhancement level
}


export interface GameConfig {
  initialPlayerRunStats: InitialPlayerRunStats;
  playerLevelUpStatPoints: number;
  baseExpToLevel: number;
  expScalingFactor: number;
  monsterSpawnIntervalMs: number;
  battleTickIntervalMs: number;
  maxMonstersOnScreen: number;
  healthRegenIntervalMs: number;
  playerBaseStatusEffectChance: { 
    type: StatusEffectType;
    chance: number;
    potency: number;
    duration: number;
  };
  BOSS_WAVE_INTERVAL: number; 
  BOSS_LOOT_MIN_RARITY_INDEX: number;
  PLAYER_MOVEMENT_SPEED: number;
  MONSTER_MOVEMENT_SPEED: number;
  ENGAGEMENT_RANGE: number;
  AGGRO_RANGE: number;
  MAP_BOUNDS: { minX: number; maxX: number; minZ: number; maxZ: number };
  PLAYER_Y_POSITION: number; 
  MONSTER_BASE_Y_SCALE_FACTOR: number; 
  MOVEMENT_TARGET_UPDATE_COOLDOWN_TICKS: number; 
  // Skill specific configs
  QUAKE_STOMP_RADIUS: number;
  LUCKY_STREAK_DURATION_TICKS: number; 
  LUCKY_STREAK_WINDOW_TICKS: number; 
  MIN_MONSTERS_PER_NON_BOSS_WAVE: number;
  MONSTERS_PER_WAVE_INCREMENT: number;
  INITIAL_WAVE_MONSTER_COUNT_OVERRIDES?: Record<number, number>;
  ENHANCEMENT_STONE_DROP_CHANCE: number;
  ENHANCEMENT_STONE_DROP_AMOUNT: [min: number, max: number];
  ITEM_ENHANCEMENT_CONFIG: ItemEnhancementConfig;
}

export interface AttackEvent {
  id: string;
  attackerId: string; 
  targetId: string;
  isCritical: boolean;
  timestamp: number;
}

export interface SkillProcEvent {
  id: string;
  skillId: string;
  sourceId: string; 
  targetId?: string; 
  position?: ThreeDPosition; 
  timestamp: number;
  color?: number | string; 
}


export interface DerivedPlayerStats extends PlayerStats {
  critChance: number;
  critDamage: number;
  healthRegen: number;
  movementSpeed: number; 
  activeStatusEffects: StatusEffectInstance[];
}

export interface SessionStats {
  monstersKilled: number;
  bossesDefeated: number;
  goldEarned: number;
  experienceGained: number;
  enhancementStonesAcquired: number;
  damageDealt: number;
  damageTaken: number;
  itemsLooted: number;
  itemsEnhanced: number;
  skillsLearned: number; // Total skill levels gained
  playTime: number; // in seconds
  highestWaveReachedThisSession: number;
}
