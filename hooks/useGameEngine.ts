

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Player, ActiveMonster, Item, EquippedItems, PlayerSkill, BattleMessage, PanelType, 
  MonsterDefinition, SkillDefinition, StatModifier, AttackEvent,
  StatusEffectType, StatusEffectInstance, DerivedPlayerStats, ItemType, Rarity, ThreeDPosition, PlayerStats, UnstoppableForceBuff, RetributionBuff, SkillProcEvent,
  PersistentProgress, PermanentStatsLevels, InitialPlayerRunStats, SessionStats
} from '../types.ts';
import { 
  GAME_CONFIG, 
  MONSTER_DEFINITIONS as RAW_MONSTER_DEFINITIONS, 
  SKILL_DEFINITIONS as RAW_SKILL_DEFINITIONS,     
  PLAYER_ID, MAX_BATTLE_LOG_MESSAGES, INVENTORY_SLOTS, MAX_ATTACK_EVENTS,
  STATUS_EFFECT_DEFINITIONS,
  SHOP_NUM_ITEMS_TO_DISPLAY,
  SELL_PRICE_MODIFIER,
  SHOP_ITEM_LEVEL_SCALING_FACTOR,
  SHOP_REFRESH_COST,
  MAX_SKILL_PROC_EVENTS,
  PERMANENT_UPGRADES_SETTINGS,
  BOSS_ESSENCE_DROP,
  WAVE_CLEAR_ESSENCE_MULTIPLIER
} from '../diablockConstants.ts'; 
import {
  experienceToNextLevel,
  calculatePlayerStats,
  generateMonster,
  processStatusEffects,
  calculateDamage, 
  applyStatusEffect,
  generateRandomItem,
  calculateDistance, 
  moveTowards,
  generateSkillProcEventId 
} from '../utils/gameUtils.ts';


console.log('[GameEngine] Attempting to load RAW_MONSTER_DEFINITIONS:', RAW_MONSTER_DEFINITIONS);
console.log('[GameEngine] GAME_CONFIG available:', typeof GAME_CONFIG !== 'undefined');
console.log('[GameEngine] MAP_BOUNDS:', GAME_CONFIG?.MAP_BOUNDS);


const TYPED_MONSTER_DEFINITIONS: MonsterDefinition[] = Array.isArray(RAW_MONSTER_DEFINITIONS) 
  ? (RAW_MONSTER_DEFINITIONS as any[]).map((md: any) => ({
      ...md,
      goldDrop: md.goldDrop as [number, number], 
    })) as MonsterDefinition[]
  : [];

if (TYPED_MONSTER_DEFINITIONS.length === 0 ) {
    console.warn("[GameEngine] TYPED_MONSTER_DEFINITIONS is empty. This will lead to no monsters spawning or errors. Check diablockConstants.ts and its import.");
}


const TYPED_SKILL_DEFINITIONS: SkillDefinition[] = Array.isArray(RAW_SKILL_DEFINITIONS) ? RAW_SKILL_DEFINITIONS as SkillDefinition[] : [];

let gameTickCounter = 0;
const SAVEGAME_KEY = 'diablock_savegame_v3'; // Updated version for new save structure with persistentProgress

const getDefaultPersistentProgress = (): PersistentProgress => ({
  essence: 0,
  permanentStatsLevels: {
    maxHp: 0,
    attack: 0,
    defense: 0,
    healthRegen: 0,
  },
  highestWaveAchieved: 0,
});

const getDefaultSessionStats = (): SessionStats => ({
  monstersKilled: 0,
  bossesDefeated: 0,
  goldEarned: 0,
  experienceGained: 0,
  enhancementStonesAcquired: 0,
  damageDealt: 0,
  damageTaken: 0,
  itemsLooted: 0,
  itemsEnhanced: 0,
  skillsLearned: 0,
  playTime: 0,
  highestWaveReachedThisSession: 0,
});


const calculatePermanentBonus = (statKey: keyof PermanentStatsLevels, level: number): number => {
  const config = PERMANENT_UPGRADES_SETTINGS.find(s => s.key === statKey);
  if (!config) return 0;
  return config.bonusPerLevel * level;
};

const getInitialPlayerRunStatsWithPermUpgrades = (persistentProgress: PersistentProgress): InitialPlayerRunStats => {
  const baseStats = { ...GAME_CONFIG.initialPlayerRunStats };
  baseStats.maxHp += calculatePermanentBonus('maxHp', persistentProgress.permanentStatsLevels.maxHp);
  baseStats.attack += calculatePermanentBonus('attack', persistentProgress.permanentStatsLevels.attack);
  baseStats.defense += calculatePermanentBonus('defense', persistentProgress.permanentStatsLevels.defense);
  baseStats.healthRegen += calculatePermanentBonus('healthRegen', persistentProgress.permanentStatsLevels.healthRegen);
  baseStats.hp = baseStats.maxHp; // Start with full HP including permanent bonuses
  return baseStats;
};


const getDefaultPlayerState = (persistentProgress: PersistentProgress): Player => {
  const initialRunStats = getInitialPlayerRunStatsWithPermUpgrades(persistentProgress);
  const initialPosition: ThreeDPosition = { x: 0, y: GAME_CONFIG.PLAYER_Y_POSITION, z: 0 };
  
  return {
    id: PLAYER_ID,
    ...initialRunStats, 
    level: 1,
    experience: 0,
    experienceToNextLevel: experienceToNextLevel(1, GAME_CONFIG.baseExpToLevel, GAME_CONFIG.expScalingFactor),
    // Gold is handled separately for retention
    skillPoints: 0,
    activeStatusEffects: [],
    position: initialPosition,
    targetPosition: initialPosition, 
    movementSpeed: GAME_CONFIG.PLAYER_MOVEMENT_SPEED,
    engagedMonsterId: null,
    targetUpdateCooldown: GAME_CONFIG.MOVEMENT_TARGET_UPDATE_COOLDOWN_TICKS, 
    powerStrikePendingDamage: 0, 
    consecutiveAttackCount: 0, 
    lastAttackTick: 0, 
    unstoppableForceBuff: null,
    dodgedThisTick: false,
    retributionBuff: null,
    recentKills: [],
    masterTacticianAppliedWave: 0,
    enhancementStones: 0, // Initialize enhancement stones
  };
};


const useGameEngine = () => {
  const [persistentProgress, setPersistentProgress] = useState<PersistentProgress>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (parsedData.persistentProgress) {
          // Ensure all keys are present, merge with defaults if not
          const defaultProg = getDefaultPersistentProgress();
          const loadedProg = parsedData.persistentProgress;
          return {
            essence: typeof loadedProg.essence === 'number' ? loadedProg.essence : defaultProg.essence,
            permanentStatsLevels: {
              ...defaultProg.permanentStatsLevels,
              ...(loadedProg.permanentStatsLevels || {}),
            },
            highestWaveAchieved: typeof loadedProg.highestWaveAchieved === 'number' ? loadedProg.highestWaveAchieved : defaultProg.highestWaveAchieved,
          };
        }
      } catch (e) { console.error("Failed to parse saved persistentProgress data:", e); }
    }
    return getDefaultPersistentProgress();
  });
  
  const [player, setPlayer] = useState<Player>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    // Always use the latest persistentProgress for initial player state, even if loading an old player save.
    let initialPlayer = getDefaultPlayerState(persistentProgress); 
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (parsedData.player && parsedData.player.id === PLAYER_ID) {
           initialPlayer = {
            ...initialPlayer, // Start with default state for the current persistent upgrades
            // Restore specific fields that define the *current run's* progress
            level: parsedData.player.level || initialPlayer.level,
            experience: parsedData.player.experience || initialPlayer.experience,
            experienceToNextLevel: parsedData.player.experienceToNextLevel || initialPlayer.experienceToNextLevel,
            gold: parsedData.player.gold || initialPlayer.gold, // Gold is now part of initialRunStats default, but we prefer saved if available.
            skillPoints: parsedData.player.skillPoints || initialPlayer.skillPoints,
            hp: parsedData.player.hp, // Keep saved HP for the current run
            enhancementStones: parsedData.player.enhancementStones || 0, // Load enhancement stones for current run if available
            // ActiveStatusEffects, position, etc., are reset by getDefaultPlayerState or by game logic.
            // Items & skills are loaded separately below.
          };
        }
      } catch (e) {
        console.error("Failed to parse saved player data:", e);
        // Don't remove the whole savegame key here, persistent progress might still be valid
      }
    }
    // Ensure core stats reflect permanent bonuses from the *current* persistentProgress.
    // This is important if persistentProgress was updated (e.g., from a different browser tab)
    // or if loading an old save where player stats didn't have perm bonuses baked in.
    const runStatsWithPerms = getInitialPlayerRunStatsWithPermUpgrades(persistentProgress);
    initialPlayer.maxHp = runStatsWithPerms.maxHp;
    initialPlayer.attack = runStatsWithPerms.attack;
    initialPlayer.defense = runStatsWithPerms.defense;
    initialPlayer.healthRegen = runStatsWithPerms.healthRegen;
    
    // If hp was loaded, ensure it's not > new maxHp
    if (initialPlayer.hp > initialPlayer.maxHp) initialPlayer.hp = initialPlayer.maxHp;
    
    return initialPlayer;
  });

  const [monsters, setMonsters] = useState<ActiveMonster[]>([]); 
  
  const [inventory, setInventory] = useState<Array<Item | null>>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (parsedData.inventory && Array.isArray(parsedData.inventory) && parsedData.inventory.length === INVENTORY_SLOTS) {
          return parsedData.inventory.map((item: Item | null) => item ? { ...item, enhancementLevel: item.enhancementLevel || 0 } : null);
        }
      } catch (e) { console.error("Failed to parse saved inventory data:", e); }
    }
    return new Array(INVENTORY_SLOTS).fill(null);
  });

  const [equippedItems, setEquippedItems] = useState<EquippedItems>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (parsedData.equippedItems && typeof parsedData.equippedItems === 'object') {
          const loadedEquipped: EquippedItems = {};
          for (const slot in parsedData.equippedItems) {
            const item = parsedData.equippedItems[slot as ItemType];
            if (item) {
              loadedEquipped[slot as ItemType] = { ...item, enhancementLevel: item.enhancementLevel || 0 };
            }
          }
          return loadedEquipped;
        }
      } catch (e) { console.error("Failed to parse saved equippedItems data:", e); }
    }
    return {};
  });
  
  const baseSkillDefinitions: SkillDefinition[] = useMemo(() => TYPED_SKILL_DEFINITIONS, []);
  
  const [skills, setSkills] = useState<PlayerSkill[]>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (parsedData.skills && Array.isArray(parsedData.skills)) {
           const loadedSkills = baseSkillDefinitions.map(def => {
             const savedSkill = parsedData.skills.find((s: PlayerSkill) => s.id === def.id);
             return { ...def, currentLevel: savedSkill ? savedSkill.currentLevel : 0 };
           });
           return loadedSkills;
        }
      } catch (e) { console.error("Failed to parse saved skills data:", e); }
    }
    return baseSkillDefinitions.map(sd => ({ ...sd, currentLevel: 0 }));
  });

  const [battleLog, setBattleLog] = useState<BattleMessage[]>([]);
  
  const [currentWave, setCurrentWave] = useState<number>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (typeof parsedData.currentWave === 'number' && parsedData.currentWave >= 1) {
          return parsedData.currentWave;
        }
      } catch (e) { console.error("Failed to parse saved currentWave data:", e); }
    }
    return 1;
  });

  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  
  const [gameTime, setGameTime] = useState<number>(() => {
    const savedGame = localStorage.getItem(SAVEGAME_KEY);
    if (savedGame) {
      try {
        const parsedData = JSON.parse(savedGame);
        if (typeof parsedData.gameTime === 'number') {
          return parsedData.gameTime;
        }
      } catch (e) { console.error("Failed to parse saved gameTime data:", e); }
    }
    return 0;
  });

  const [attackEvents, setAttackEvents] = useState<AttackEvent[]>([]);
  const [skillProcEvents, setSkillProcEvents] = useState<SkillProcEvent[]>([]);
  
  const prevInventoryRef = useRef<Array<Item | null>>(inventory);
  const [shopInventory, setShopInventory] = useState<Item[]>([]);

  const waveAdvancedForWaveRef = useRef<Record<number, boolean>>({});
  const waveInitializedRef = useRef<Record<number, boolean>>({});

  const [autoEquipEnabled, setAutoEquipEnabled] = useState<boolean>(() => {
     const savedGame = localStorage.getItem(SAVEGAME_KEY);
     if (savedGame) {
       try {
         const parsedData = JSON.parse(savedGame);
         if (typeof parsedData.autoEquipEnabled === 'boolean') return parsedData.autoEquipEnabled;
       } catch (e) { console.error("Failed to parse saved autoEquipEnabled data:", e); }
     }
     return true;
  });
  const [autoLearnSkillEnabled, setAutoLearnSkillEnabled] = useState<boolean>(() => {
     const savedGame = localStorage.getItem(SAVEGAME_KEY);
     if (savedGame) {
       try {
         const parsedData = JSON.parse(savedGame);
         if (typeof parsedData.autoLearnSkillEnabled === 'boolean') return parsedData.autoLearnSkillEnabled;
       } catch (e) { console.error("Failed to parse saved autoLearnSkillEnabled data:", e); }
     }
     return true;
  });

  const [sessionStats, setSessionStats] = useState<SessionStats>(getDefaultSessionStats());
  const initialRunGoldRef = useRef<number>(player.gold);


  const isBossWaveActive = useMemo(() => {
    return currentWave > 0 && GAME_CONFIG.BOSS_WAVE_INTERVAL > 0 && currentWave % GAME_CONFIG.BOSS_WAVE_INTERVAL === 0;
  }, [currentWave]);


  useEffect(() => {
    if (isGameOver) return; 

    const saveData = {
      player, // Player state for the current run
      inventory, // Retained
      equippedItems, // Retained
      skills, // Skills for the current run (will be reset on new run)
      currentWave,
      gameTime,
      autoEquipEnabled,
      autoLearnSkillEnabled,
      persistentProgress, // Save all persistent progress
      saveTimestamp: Date.now()
    };
    try {
      localStorage.setItem(SAVEGAME_KEY, JSON.stringify(saveData));
    } catch (e) {
      console.error("Error saving game to localStorage:", e);
    }
  }, [player, inventory, equippedItems, skills, currentWave, gameTime, autoEquipEnabled, autoLearnSkillEnabled, persistentProgress, isGameOver]);


  const derivedPlayerStats: DerivedPlayerStats = useMemo(() => {
    // Player object's base stats (maxHp, attack, defense, healthRegen) already reflect permanent upgrades
    // as they are applied during `getDefaultPlayerState` which is used in `prepareForNewRun`.
    let baseCalculatedStats = calculatePlayerStats(player, equippedItems, skills);
    
    const masterTacticianSkill = skills.find(s => s.id === 'master_tactician' && s.currentLevel > 0);
    const masterTacticianBuffActive = player.activeStatusEffects.find(eff => eff.type === StatusEffectType.MASTER_TACTICIAN_BUFF);

    if (masterTacticianSkill && masterTacticianBuffActive) {
        baseCalculatedStats.critChance += 0.20; 
        baseCalculatedStats.critDamage += 0.30; 
    }
    
    baseCalculatedStats.critChance = Math.max(0, Math.min(1, baseCalculatedStats.critChance));

    return {
        ...baseCalculatedStats,
        activeStatusEffects: player.activeStatusEffects 
    };
  }, [player, equippedItems, skills]);


  const addAttackEvent = useCallback((attackerId: string, targetId: string, isCritical: boolean) => {
    const newEvent: AttackEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      attackerId,
      targetId,
      isCritical,
      timestamp: Date.now(),
    };
    setAttackEvents(prev => [newEvent, ...prev.slice(0, MAX_ATTACK_EVENTS - 1)]);
  }, []);

  const addSkillProcEvent = useCallback((skillId: string, sourceId: string, targetId?: string, position?: ThreeDPosition, color?: number | string) => {
    const newEvent: SkillProcEvent = {
        id: generateSkillProcEventId(),
        skillId,
        sourceId,
        targetId,
        position,
        timestamp: Date.now(),
        color,
    };
    setSkillProcEvents(prev => [newEvent, ...prev.slice(0, MAX_SKILL_PROC_EVENTS - 1)]);
  }, []);


  const addBattleMessage = useCallback((text: string, type: BattleMessage['type']) => {
    setBattleLog(prevLog => {
      const newLog = [{ id: Date.now().toString() + Math.random(), text, type, timestamp: Date.now() }, ...prevLog];
      return newLog.slice(0, MAX_BATTLE_LOG_MESSAGES);
    });
  }, []);

  const generateShopItems = useCallback(() => {
    const items: Item[] = [];
    const itemLevel = Math.max(1, Math.floor(currentWave * SHOP_ITEM_LEVEL_SCALING_FACTOR + (persistentProgress.highestWaveAchieved * 0.1))); // Shop items benefit slightly from overall progress
    for (let i = 0; i < SHOP_NUM_ITEMS_TO_DISPLAY; i++) {
        let minRarity: Rarity | undefined = undefined;
        if (itemLevel > 10) minRarity = Rarity.UNCOMMON;
        if (itemLevel > 20) minRarity = Rarity.RARE;
        const newItem = generateRandomItem(itemLevel, minRarity);
        items.push(newItem);
    }
    setShopInventory(items);
  }, [currentWave, persistentProgress.highestWaveAchieved]);

  const refreshShopStock = useCallback((isFreeRefresh = false) => {
    if (!isFreeRefresh) {
        if (player.gold < SHOP_REFRESH_COST) {
            addBattleMessage(`상점 목록 새로고침 비용(${SHOP_REFRESH_COST} 골드)이 부족합니다.`, 'error');
            return false;
        }
        setPlayer(p => ({ ...p, gold: p.gold - SHOP_REFRESH_COST }));
        addBattleMessage(`상점 목록을 새로고침했습니다. (${SHOP_REFRESH_COST} 골드 소모)`, 'shop');
    } else {
         addBattleMessage('상점 목록이 준비되었습니다.', 'shop');
    }
    generateShopItems();
    return true;
  }, [player.gold, generateShopItems, addBattleMessage]);

  useEffect(() => {
    // Generate initial shop items if none exist (e.g., first load or after a hard reset)
    if (shopInventory.length === 0) {
        refreshShopStock(true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount or if shopInventory is reset by other means


  const buyItem = useCallback((itemToBuy: Item, shopItemIndex: number) => {
    if (player.gold < itemToBuy.goldValue) {
        addBattleMessage(`${itemToBuy.name} 구매에 골드가 부족합니다. (필요: ${itemToBuy.goldValue})`, 'error');
        return;
    }
    const emptySlotIndex = inventory.findIndex(slot => slot === null);
    if (emptySlotIndex === -1) {
        addBattleMessage('소지품이 가득 찼습니다. 아이템을 구매할 수 없습니다.', 'error');
        return;
    }
    setPlayer(p => ({ ...p, gold: p.gold - itemToBuy.goldValue }));
    setInventory(prevInv => {
        const newInv = [...prevInv];
        newInv[emptySlotIndex] = itemToBuy;
        return newInv;
    });
    setShopInventory(prevShopInv => prevShopInv.filter((_, index) => index !== shopItemIndex));
    setSessionStats(s => ({ ...s, itemsLooted: s.itemsLooted + 1 })); // Buying is like looting for session stats
    addBattleMessage(`${itemToBuy.name} 을(를) ${itemToBuy.goldValue} 골드에 구매했습니다.`, 'shop');
  }, [player.gold, inventory, addBattleMessage]);

  const sellItem = useCallback((itemToSell: Item, inventoryIndex: number) => {
    const sellPrice = Math.floor(itemToSell.goldValue * SELL_PRICE_MODIFIER);
    setPlayer(p => ({ ...p, gold: p.gold + sellPrice }));
    setInventory(prevInv => {
        const newInv = [...prevInv];
        newInv[inventoryIndex] = null;
        return newInv;
    });
    addBattleMessage(`${itemToSell.name} 을(를) ${sellPrice} 골드에 판매했습니다.`, 'shop');
  }, [addBattleMessage]);
  
  const gainExperience = useCallback((amount: number) => {
    if (isGameOver) return;
    setPlayer(prevPlayer => {
      let newExperience = prevPlayer.experience + amount;
      let updatedPlayer = { ...prevPlayer };
      while (newExperience >= updatedPlayer.experienceToNextLevel) {
          const expOver = newExperience - updatedPlayer.experienceToNextLevel;
          const newLevel = updatedPlayer.level + 1;
          addBattleMessage(`축하합니다! 레벨 ${newLevel}에 도달했습니다!`, 'info');
          updatedPlayer = {
              ...updatedPlayer,
              level: newLevel,
              experience: expOver,
              experienceToNextLevel: experienceToNextLevel(newLevel, GAME_CONFIG.baseExpToLevel, GAME_CONFIG.expScalingFactor),
              skillPoints: updatedPlayer.skillPoints + GAME_CONFIG.playerLevelUpStatPoints,
          };
          newExperience = expOver;
      }
      updatedPlayer.experience = newExperience;
      return updatedPlayer;
    });
    setSessionStats(s => ({ ...s, experienceGained: s.experienceGained + amount }));
  }, [addBattleMessage, isGameOver]);


  const equipItem = useCallback((itemToEquip: Item, fromInventoryIndex: number) => {
    if (itemToEquip.levelRequirement && player.level < itemToEquip.levelRequirement) {
        addBattleMessage(`레벨 ${itemToEquip.levelRequirement} 필요: ${itemToEquip.name}.`, 'error');
        return;
    }
    const itemType = itemToEquip.type;
    const previouslyEquippedItem = equippedItems[itemType];
    setEquippedItems(prev => ({ ...prev, [itemType]: itemToEquip }));
    setInventory(prevInv => {
        const newInv = [...prevInv];
        newInv[fromInventoryIndex] = previouslyEquippedItem || null; 
        return newInv;
    });
    addBattleMessage(`${itemToEquip.name}${itemToEquip.enhancementLevel > 0 ? ` +${itemToEquip.enhancementLevel}` : ''} 장착. ${previouslyEquippedItem ? `${previouslyEquippedItem.name}${previouslyEquippedItem.enhancementLevel > 0 ? ` +${previouslyEquippedItem.enhancementLevel}`:''}은(는) 소지품으로 이동.` : ''}`, 'info');
  }, [player.level, equippedItems, addBattleMessage]);


  const unequipItem = useCallback((itemType: ItemType) => {
    const itemToUnequip = equippedItems[itemType];
    if (!itemToUnequip) return;
    const emptySlotIndex = inventory.findIndex(slot => slot === null);
    if (emptySlotIndex === -1) {
      addBattleMessage('소지품이 가득 찼습니다. 벗을 수 없습니다.', 'error');
      return;
    }
    setInventory(prevInv => {
      const newInv = [...prevInv];
      newInv[emptySlotIndex] = itemToUnequip;
      return newInv;
    });
    setEquippedItems(prevEquipped => {
      const newEquipped = { ...prevEquipped };
      delete newEquipped[itemType];
      return newEquipped;
    });
    addBattleMessage(`${itemToUnequip.name}${itemToUnequip.enhancementLevel > 0 ? ` +${itemToUnequip.enhancementLevel}`:''} 해제.`, 'info');
  }, [equippedItems, inventory, addBattleMessage]);

  const learnSkill = useCallback((skillId: string) => {
    let skillLearned = false;
    setSkills(prevSkills => {
        const skillToLearn = prevSkills.find(s => s.id === skillId);
        if (!skillToLearn || skillToLearn.currentLevel >= skillToLearn.maxLevel) {
            return prevSkills;
        }
        const cost = skillToLearn.cost(skillToLearn.currentLevel);
        if (player.skillPoints < cost) {
          return prevSkills;
        }
        if (skillToLearn.prerequisites) {
            for (const prereqId of skillToLearn.prerequisites) {
                const prereqSkill = prevSkills.find(s => s.id === prereqId);
                if (!prereqSkill || prereqSkill.currentLevel === 0) {
                     addBattleMessage(`선행 기술: ${prereqSkill?.name || '알 수 없는 기술'} 필요.`, 'error');
                     return prevSkills;
                }
            }
        }
        skillLearned = true;
        setSessionStats(s => ({ ...s, skillsLearned: s.skillsLearned + 1 }));
        addBattleMessage(`${skillToLearn.name} 레벨 ${skillToLearn.currentLevel + 1} 습득!`, 'info');
        setPlayer(prevPlayer => ({ ...prevPlayer, skillPoints: prevPlayer.skillPoints - cost }));
        return prevSkills.map(s => 
            s.id === skillId ? { ...s, currentLevel: s.currentLevel + 1 } : s
        );
    });
    return skillLearned; 
  }, [player.skillPoints, addBattleMessage]);

  const enhanceItem = useCallback((itemId: string, itemSlotType: ItemType | number, isEquipped: boolean) => {
    let itemToEnhance: Item | null | undefined = null;
    let originalItemLocation: 'inventory' | 'equipped' = 'inventory';
    let itemIndexOrSlot: number | ItemType = 0;

    if (isEquipped) {
        itemToEnhance = equippedItems[itemSlotType as ItemType];
        originalItemLocation = 'equipped';
        itemIndexOrSlot = itemSlotType as ItemType;
    } else {
        itemToEnhance = inventory[itemSlotType as number];
        originalItemLocation = 'inventory';
        itemIndexOrSlot = itemSlotType as number;
    }

    if (!itemToEnhance) {
      addBattleMessage("강화할 아이템을 찾을 수 없습니다.", 'error');
      return;
    }

    const config = GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG;
    const maxLevel = config.maxLevelByRarity[itemToEnhance.rarity] || 0;

    if (itemToEnhance.enhancementLevel >= maxLevel) {
      addBattleMessage(`${itemToEnhance.name} +${itemToEnhance.enhancementLevel} 은(는) 이미 최대 강화 레벨입니다.`, 'item_enhance_fail');
      return;
    }

    const itemEffectiveLevel = itemToEnhance.levelRequirement || player.level; // Use item's level req or player level for cost scaling

    const goldCost = Math.floor(config.baseGoldCost * Math.pow(config.goldCostIncreaseFactorPerLevel, itemToEnhance.enhancementLevel) * (1 + itemEffectiveLevel * config.itemLevelMultiplier));
    const stoneCost = Math.ceil(config.baseStoneCost * Math.pow(config.stoneCostIncreaseFactorPerLevel, itemToEnhance.enhancementLevel) * (1 + itemEffectiveLevel * config.itemLevelMultiplier));


    if (player.gold < goldCost) {
      addBattleMessage(`강화 비용 부족: ${goldCost} 골드 필요.`, 'item_enhance_fail');
      return;
    }
    if (player.enhancementStones < stoneCost) {
      addBattleMessage(`강화석 부족: ${stoneCost}개 필요.`, 'item_enhance_fail');
      return;
    }

    setPlayer(p => ({
      ...p,
      gold: p.gold - goldCost,
      enhancementStones: p.enhancementStones - stoneCost,
    }));

    const enhancedItem = {
      ...itemToEnhance,
      enhancementLevel: itemToEnhance.enhancementLevel + 1,
    };

    if (originalItemLocation === 'equipped') {
      setEquippedItems(prev => ({
        ...prev,
        [itemIndexOrSlot as ItemType]: enhancedItem,
      }));
    } else {
      setInventory(prev => {
        const newInv = [...prev];
        newInv[itemIndexOrSlot as number] = enhancedItem;
        return newInv;
      });
    }
    setSessionStats(s => ({ ...s, itemsEnhanced: s.itemsEnhanced + 1 }));
    addBattleMessage(`${enhancedItem.name} +${enhancedItem.enhancementLevel -1} → +${enhancedItem.enhancementLevel} 강화 성공! (비용: ${goldCost}G, ${stoneCost}석)`, 'item_enhanced');

  }, [player, inventory, equippedItems, addBattleMessage]);


  useEffect(() => {
    if (!autoEquipEnabled || isGameOver) {
      prevInventoryRef.current = inventory;
      return;
    }
    if (inventory !== prevInventoryRef.current) {
        for (let i = 0; i < inventory.length; i++) {
        const currentItem = inventory[i];
        if (currentItem) { 
            if (currentItem.levelRequirement && player.level < currentItem.levelRequirement) {
                continue; 
            }
            const currentlyEquippedForSlot = equippedItems[currentItem.type];
            let shouldEquip = false;
            if (!currentlyEquippedForSlot) {
            shouldEquip = true;
            } else {
            const rarities = Object.values(Rarity);
            const newItemRarityIndex = rarities.indexOf(currentItem.rarity);
            const equippedRarityIndex = rarities.indexOf(currentlyEquippedForSlot.rarity);
            
            // Compare items considering enhancement levels. For simplicity, we can sum modifier values or use a primary stat.
            // A more sophisticated comparison would involve simulating derived stats, which is too complex here.
            // Let's use a simple metric: (sum of flat mod values) * (1 + enhancementLevel * bonus) + rarity bonus
            const getItemScore = (item: Item): number => {
                let score = 0;
                const enhancementMultiplier = 1 + (item.enhancementLevel * GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG.bonusPerLevel);
                item.modifiers.forEach(mod => {
                    if (mod.type === 'flat') { // Consider flat values more directly for simplicity
                         if (mod.stat === 'attack') score += mod.value * enhancementMultiplier * 2; // Weight attack more
                         else if (mod.stat === 'maxHp') score += mod.value * enhancementMultiplier * 0.5;
                         else if (mod.stat === 'defense') score += mod.value * enhancementMultiplier * 1.5;
                         else score += mod.value * enhancementMultiplier;
                    } else if (mod.type === 'percent') { // Add a smaller bonus for percent mods
                         score += mod.value * 100 * enhancementMultiplier * 0.2; // e.g. 5% = 1 point
                    }
                });
                score += rarities.indexOf(item.rarity) * 10; // Rarity bonus
                score += item.enhancementLevel * 5; // Enhancement level bonus
                return score;
            };

            const newItemScore = getItemScore(currentItem);
            const equippedItemScore = getItemScore(currentlyEquippedForSlot);

            if (newItemScore > equippedItemScore) {
                shouldEquip = true;
            }
            }
            if (shouldEquip) {
            addBattleMessage(`[자동] ${currentItem.name}${currentItem.enhancementLevel > 0 ? ` +${currentItem.enhancementLevel}` : ''} 장착.`, 'info');
            equipItem(currentItem, i);
            break; 
            }
        }
        }
        prevInventoryRef.current = inventory;
    }
  }, [inventory, autoEquipEnabled, player.level, equippedItems, equipItem, addBattleMessage, isGameOver]);

  useEffect(() => {
    if (!autoLearnSkillEnabled || player.skillPoints <= 0 || isGameOver) {
      return;
    }
    let skillPointsChanged = true; 
    while (skillPointsChanged && player.skillPoints > 0) {
      skillPointsChanged = false; 
      let bestSkillToLearnId: string | null = null;
      
      const availableSkills = skills.filter(skill => {
        if (skill.currentLevel >= skill.maxLevel) return false;
        const cost = skill.cost(skill.currentLevel);
        if (player.skillPoints < cost) return false;
        if (skill.prerequisites && skill.prerequisites.length > 0) {
          return skill.prerequisites.every(prereqId => {
            const prereqSkill = skills.find(s => s.id === prereqId);
            return prereqSkill && prereqSkill.currentLevel > 0;
          });
        }
        return true; 
      });
      
      availableSkills.sort((a,b) => a.cost(a.currentLevel) - b.cost(b.currentLevel));

      if (availableSkills.length > 0) {
          bestSkillToLearnId = availableSkills[0].id;
      }
      
      if (bestSkillToLearnId) {
        const learned = learnSkill(bestSkillToLearnId);
        if(learned) {
            skillPointsChanged = true; 
        } else {
            break; 
        }
      } else {
        break; 
      }
    }
  }, [player.skillPoints, autoLearnSkillEnabled, skills, learnSkill, isGameOver]);


  // New monster spawning logic based on currentWave
  useEffect(() => {
    if (isGameOver || TYPED_MONSTER_DEFINITIONS.length === 0) {
        return;
    }

    if (waveInitializedRef.current[currentWave]) {
        return;
    }

    if (isBossWaveActive) {
        if (monsters.some(m => m.isBoss)) { 
            waveInitializedRef.current[currentWave] = true;
            return;
        }
        const bossDefinitions = TYPED_MONSTER_DEFINITIONS.filter(m => m.isBoss);
        if (bossDefinitions.length > 0) {
            const bossDef = bossDefinitions[(Math.floor(currentWave / GAME_CONFIG.BOSS_WAVE_INTERVAL) - 1 + bossDefinitions.length) % bossDefinitions.length] || bossDefinitions[0];
            const newBoss = generateMonster(currentWave, bossDef);
            setMonsters([newBoss]);
            waveInitializedRef.current[currentWave] = true;
            addBattleMessage(`액트 ${Math.floor((currentWave -1) / GAME_CONFIG.BOSS_WAVE_INTERVAL) + 1} (웨이브 ${currentWave}): 강력한 ${newBoss.name}이(가) 모습을 드러냅니다!`, 'boss_spawn');
        } else {
            addBattleMessage(`경고: 웨이브 ${currentWave} 보스 몬스터 정의 없음.`, 'error');
            waveInitializedRef.current[currentWave] = true; 
        }
    } else { 
        let numToSpawn: number;
        if (GAME_CONFIG.INITIAL_WAVE_MONSTER_COUNT_OVERRIDES && GAME_CONFIG.INITIAL_WAVE_MONSTER_COUNT_OVERRIDES[currentWave]) {
            numToSpawn = GAME_CONFIG.INITIAL_WAVE_MONSTER_COUNT_OVERRIDES[currentWave];
        } else {
            numToSpawn = Math.floor(GAME_CONFIG.MIN_MONSTERS_PER_NON_BOSS_WAVE + Math.max(0, currentWave - 1) * GAME_CONFIG.MONSTERS_PER_WAVE_INCREMENT);
        }
        numToSpawn = Math.min(GAME_CONFIG.maxMonstersOnScreen, numToSpawn);


        if (numToSpawn <= 0) {
             waveInitializedRef.current[currentWave] = true;
             setMonsters([]); 
             return;
        }

        const newWaveMonsters: ActiveMonster[] = [];
        const nonBossMonsters = TYPED_MONSTER_DEFINITIONS.filter(m => !m.isBoss);

        if (nonBossMonsters.length === 0) {
            addBattleMessage("오류: 일반 몬스터 데이터를 찾을 수 없습니다.", 'error');
            waveInitializedRef.current[currentWave] = true; 
            setMonsters([]);
            return;
        }

        for (let i = 0; i < numToSpawn; i++) {
            const randomDefIndex = Math.floor(Math.random() * nonBossMonsters.length);
            const monsterDef = nonBossMonsters[randomDefIndex];
            const newMonster = generateMonster(currentWave, monsterDef);
            newWaveMonsters.push(newMonster);
        }
        setMonsters(newWaveMonsters);
        waveInitializedRef.current[currentWave] = true;
        addBattleMessage(`웨이브 ${currentWave} 시작! 몬스터 ${newWaveMonsters.length}마리 출현!`, 'info');
    }
  }, [currentWave, isBossWaveActive, isGameOver, addBattleMessage, monsters]); // Added monsters to dependency to re-check if boss needs spawning


  const prepareForNewRun = useCallback(() => {
    waveAdvancedForWaveRef.current = {}; 
    waveInitializedRef.current = {}; 
    
    setPersistentProgress(prev => ({
        ...prev,
        highestWaveAchieved: Math.max(prev.highestWaveAchieved, currentWave -1), // currentWave is the wave that player died on, so -1 for completed
    }));
    
    const restartMessage: BattleMessage = { 
        id: `${Date.now()}-restart`, 
        text: "전투 재시작. 골드, 장비(강화도 포함), 소지품, 영웅의 정수 및 영구 강화는 유지됩니다. 레벨, 스킬, 강화석은 초기화됩니다.", 
        type: 'info', 
        timestamp: Date.now()
    };
    setBattleLog(prevLog => [restartMessage, ...prevLog.slice(0, MAX_BATTLE_LOG_MESSAGES - 1)]);
    
    const initialPlayerForRun = getDefaultPlayerState(persistentProgress); 
    
    setPlayer({
      ...initialPlayerForRun,
      gold: player.gold, // Retain current gold
      enhancementStones: 0, // Reset enhancement stones for the new run
    });
    
    setSkills(baseSkillDefinitions.map(sd => ({ ...sd, currentLevel: 0 }))); 
    setSessionStats(getDefaultSessionStats()); // Reset session stats
    initialRunGoldRef.current = player.gold; // Capture gold at the start of the new run

    setMonsters([]); 
    setCurrentWave(1); 
    setIsGameOver(false);
    setActivePanel(null); 
    setGameTime(0); 
    setAttackEvents([]);
    setSkillProcEvents([]);
    gameTickCounter = 0;
    refreshShopStock(true); 
  }, [player.gold, persistentProgress, baseSkillDefinitions, addBattleMessage, refreshShopStock, currentWave]);

  const restartGame = useCallback(() => {
    if(isGameOver) {
        const essenceFromWaves = Math.floor(persistentProgress.highestWaveAchieved * WAVE_CLEAR_ESSENCE_MULTIPLIER); 
        if (essenceFromWaves > 0) {
          setPersistentProgress(prev => ({ ...prev, essence: prev.essence + essenceFromWaves }));
          addBattleMessage(`${essenceFromWaves} 영웅의 정수 획득 (웨이브 진행도).`, 'loot');
        }
    }
    prepareForNewRun();
  }, [prepareForNewRun, persistentProgress.highestWaveAchieved, addBattleMessage, isGameOver]);

  const hardResetGame = useCallback(() => {
    localStorage.removeItem(SAVEGAME_KEY);
    waveAdvancedForWaveRef.current = {};   
    waveInitializedRef.current = {}; 
    
    const defaultProg = getDefaultPersistentProgress();
    setPersistentProgress(defaultProg);
    const initialPlayer = getDefaultPlayerState(defaultProg); 
    setPlayer({
        ...initialPlayer,
        gold: GAME_CONFIG.initialPlayerRunStats.gold, 
        enhancementStones: 0,
    });
    initialRunGoldRef.current = GAME_CONFIG.initialPlayerRunStats.gold; // Reset initial run gold

    setInventory(new Array(INVENTORY_SLOTS).fill(null));
    setEquippedItems({});
    setSkills(baseSkillDefinitions.map(sd => ({ ...sd, currentLevel: 0 })));
    setBattleLog([]);
    setMonsters([]); 
    setCurrentWave(1);
    setIsGameOver(false);
    setActivePanel(null);
    setGameTime(0);
    setAttackEvents([]);
    setSkillProcEvents([]);
    setAutoEquipEnabled(true);
    setAutoLearnSkillEnabled(true);
    setSessionStats(getDefaultSessionStats()); // Reset session stats
    gameTickCounter = 0;
    refreshShopStock(true);
    addBattleMessage("게임 데이터가 완전히 초기화되었습니다.", 'info');
  }, [addBattleMessage, baseSkillDefinitions, refreshShopStock]);


  const upgradePermanentStat = useCallback((statToUpgradeKey: keyof PermanentStatsLevels) => {
    const config = PERMANENT_UPGRADES_SETTINGS.find(s => s.key === statToUpgradeKey);
    if (!config) {
      addBattleMessage(`오류: '${statToUpgradeKey}' 영구 강화 설정을 찾을 수 없습니다.`, 'error');
      return;
    }

    const currentLevel = persistentProgress.permanentStatsLevels[statToUpgradeKey];
    if (currentLevel >= config.maxUpgradeLevel) {
      addBattleMessage(`${config.name}이(가) 이미 최대 레벨입니다.`, 'permanent_upgrade');
      return;
    }

    const cost = config.baseCost + currentLevel * config.costIncreasePerLevel;

    if (persistentProgress.essence < cost) {
      addBattleMessage(`${config.name} 강화에 필요한 정수가 부족합니다. (필요: ${cost})`, 'error');
      return;
    }

    setPersistentProgress(prev => ({
      ...prev,
      essence: prev.essence - cost,
      permanentStatsLevels: {
        ...prev.permanentStatsLevels,
        [statToUpgradeKey]: currentLevel + 1,
      },
    }));
    const newBonus = (currentLevel + 1) * config.bonusPerLevel;
    const bonusDisplay = config.key === 'healthRegen' ? newBonus.toFixed(2) : newBonus.toFixed(0);

    addBattleMessage(`${config.name}이(가) 레벨 ${currentLevel + 1}로 강화되었습니다! (총 보너스: +${bonusDisplay}${config.isPercentage ? '%' : ''})`, 'permanent_upgrade');
  }, [persistentProgress, addBattleMessage]);


  const handleGameOver = useCallback(() => {
    if (!isGameOver) { // Ensure this runs only once
        setIsGameOver(true);
        const finalWaveAchieved = currentWave > 0 ? currentWave - 1 : 0;
        setPersistentProgress(prev => ({
            ...prev,
            highestWaveAchieved: Math.max(prev.highestWaveAchieved, finalWaveAchieved),
        }));
        setSessionStats(s => ({
            ...s,
            playTime: gameTime,
            goldEarned: player.gold - initialRunGoldRef.current,
            highestWaveReachedThisSession: finalWaveAchieved
        }));
    }
  }, [currentWave, gameTime, player.gold, isGameOver, setPersistentProgress, setSessionStats ]);


  useEffect(() => {
    if (isGameOver) return;

    const gameTickInterval = setInterval(() => {
      gameTickCounter++;
      setGameTime(prev => prev + GAME_CONFIG.battleTickIntervalMs / 1000);
      let playerStunnedThisTick = false;
      let playerDiedThisTick = false;
      let playerAttackedThisTick = false; 

      setPlayer(currentPlayer => {
        if (currentPlayer.hp <= 0) { 
            playerDiedThisTick = true;
            if(!isGameOver) { 
                 handleGameOver();
            }
            return {...currentPlayer, dodgedThisTick: false }; 
        }
        
        let purificationChance = 0;
        const purificationSkill = skills.find(s => s.id === 'purification' && s.currentLevel > 0);
        if (purificationSkill) {
            purificationChance = (purificationSkill.currentLevel * 0.05 + 0.05);
        }

        const { updatedTarget, wasStunned, resistedEffectName } = processStatusEffects(
            { ...currentPlayer, dodgedThisTick: false }, 
             PLAYER_ID, 
             addBattleMessage,
             skills.find(s => s.id === 'iron_will' && s.currentLevel > 0) ? (skills.find(s => s.id === 'iron_will' && s.currentLevel > 0)!.currentLevel * 0.06 + 0.04) : 0,
             purificationChance
        );
        if (resistedEffectName) { 
            addBattleMessage(`정화! 플레이어가 ${resistedEffectName} 효과에 저항했습니다!`, 'skill_proc');
        }
        playerStunnedThisTick = wasStunned;
        let newPlayerState = updatedTarget as Player;

        const masterTacticianSkillDef = skills.find(s => s.id === 'master_tactician' && s.currentLevel > 0);
        if (masterTacticianSkillDef && currentWave > newPlayerState.masterTacticianAppliedWave && !isBossWaveActive) {
            const durationTicks = masterTacticianSkillDef.currentLevel * 3 + 2;
            const { newEffects, appliedEffect } = applyStatusEffect(
                newPlayerState.activeStatusEffects,
                StatusEffectType.MASTER_TACTICIAN_BUFF,
                0, 
                durationTicks,
                PLAYER_ID
            );
            newPlayerState.activeStatusEffects = newEffects;
            newPlayerState.masterTacticianAppliedWave = currentWave;
            if (appliedEffect) {
                addBattleMessage(`전술의 대가! ${durationTicks}초간 치명타 능력 강화!`, 'skill_proc');
                addSkillProcEvent('master_tactician', PLAYER_ID, undefined, newPlayerState.position, 0xDAA520); 
            }
        }

        if (newPlayerState.hp <= 0) {
            playerDiedThisTick = true;
            if(!isGameOver) { 
                addBattleMessage('플레이어가 상태 효과로 인해 패배했습니다!', 'error');
                handleGameOver();
            }
        }
        return newPlayerState;
      });

      if (playerDiedThisTick && !isGameOver) { 
         handleGameOver();
      }
      if (isGameOver) return;

      setMonsters(currentMonsters => {
        if (isGameOver || player.hp <=0) return currentMonsters;

        return currentMonsters.map(monster => {
          let currentMonster = { ...monster };
          const { updatedTarget: mAfterEffects, wasStunned: monsterStunned } = processStatusEffects(
              currentMonster, monster.name, addBattleMessage
          );
          currentMonster = mAfterEffects as ActiveMonster;

          if (currentMonster.currentHp <= 0) return null; 
          if (monsterStunned) {
            currentMonster.isEngaged = false; 
            return currentMonster;
          }
          
          const distanceToPlayer = calculateDistance(currentMonster.position, player.position);
          let effectiveMonsterSpeed = currentMonster.movementSpeed;
          const slowEffect = currentMonster.activeStatusEffects.find(eff => eff.type === StatusEffectType.SLOW);
          if (slowEffect) {
            effectiveMonsterSpeed *= (1 - slowEffect.potency);
          }
          
          if (player.hp > 0) { 
              if (distanceToPlayer <= GAME_CONFIG.ENGAGEMENT_RANGE) {
                  currentMonster.isEngaged = true;
                  currentMonster.targetPosition = currentMonster.position; 
                  
                  setPlayer(p => { 
                      if(p.engagedMonsterId === null || p.engagedMonsterId === currentMonster.instanceId) {
                          return {...p, engagedMonsterId: currentMonster.instanceId};
                      }
                      if (p.engagedMonsterId !== currentMonster.instanceId && p.engagedMonsterId !== null) {
                        return {...p, consecutiveAttackCount: 0, engagedMonsterId: currentMonster.instanceId };
                      }
                      return p; 
                  });

              } else if (distanceToPlayer <= GAME_CONFIG.AGGRO_RANGE) {
                  currentMonster.isEngaged = false;
                  currentMonster.targetPosition = player.position;
              } else { 
                  currentMonster.isEngaged = false;
                   if (player.engagedMonsterId === currentMonster.instanceId) { 
                        setPlayer(p => ({...p, engagedMonsterId: null, consecutiveAttackCount: 0})); 
                   }
                  if (!currentMonster.targetPosition || currentMonster.targetUpdateCooldown <= 0 || calculateDistance(currentMonster.position, currentMonster.targetPosition) < 1) {
                      const newTargetX = GAME_CONFIG.MAP_BOUNDS.minX + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxX - GAME_CONFIG.MAP_BOUNDS.minX);
                      const newTargetZ = GAME_CONFIG.MAP_BOUNDS.minZ + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxZ - GAME_CONFIG.MAP_BOUNDS.minZ);
                      currentMonster.targetPosition = { x: newTargetX, y: currentMonster.position.y, z: newTargetZ };
                      currentMonster.targetUpdateCooldown = GAME_CONFIG.MOVEMENT_TARGET_UPDATE_COOLDOWN_TICKS;
                  }
              }
          } else { 
              currentMonster.isEngaged = false;
              if (player.engagedMonsterId === currentMonster.instanceId) {
                 setPlayer(p => ({...p, engagedMonsterId: null, consecutiveAttackCount: 0}));
              }
              if (!currentMonster.targetPosition || currentMonster.targetUpdateCooldown <= 0 || calculateDistance(currentMonster.position, currentMonster.targetPosition) < 1) {
                  const newTargetX = GAME_CONFIG.MAP_BOUNDS.minX + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxX - GAME_CONFIG.MAP_BOUNDS.minX);
                  const newTargetZ = GAME_CONFIG.MAP_BOUNDS.minZ + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxZ - GAME_CONFIG.MAP_BOUNDS.minZ);
                  currentMonster.targetPosition = { x: newTargetX, y: currentMonster.position.y, z: newTargetZ }; 
                  currentMonster.targetUpdateCooldown = GAME_CONFIG.MOVEMENT_TARGET_UPDATE_COOLDOWN_TICKS;
              }
          }

          if (currentMonster.targetPosition && !currentMonster.isEngaged && player.hp > 0) { 
              currentMonster.position = moveTowards(currentMonster.position, currentMonster.targetPosition, effectiveMonsterSpeed);
          }
          currentMonster.targetUpdateCooldown = (currentMonster.targetUpdateCooldown || 0) -1;
          return currentMonster;
        }).filter(m => m !== null && m.currentHp > 0) as ActiveMonster[];
      });
      
      if (isGameOver) return;

      setPlayer(currentPlayer => {
        if (isGameOver || playerStunnedThisTick || currentPlayer.hp <= 0 || !currentPlayer.engagedMonsterId) {
          if (currentPlayer.lastAttackTick < gameTickCounter -1 && currentPlayer.consecutiveAttackCount > 0){ 
             return {...currentPlayer, consecutiveAttackCount: 0};
          }
          return currentPlayer;
        }
        
        let newPlayerState = { ...currentPlayer };
        const engagedMonsterFromState = monsters.find(m => m.instanceId === newPlayerState.engagedMonsterId); 
        
        if (!engagedMonsterFromState || engagedMonsterFromState.currentHp <= 0) { 
            if (newPlayerState.engagedMonsterId) { 
                newPlayerState.engagedMonsterId = null;
                newPlayerState.consecutiveAttackCount = 0;
            }
            return newPlayerState;
        }
        
        const engagedMonster = engagedMonsterFromState; 


        if (engagedMonster && engagedMonster.currentHp > 0 && calculateDistance(newPlayerState.position, engagedMonster.position) <= GAME_CONFIG.ENGAGEMENT_RANGE) {
          playerAttackedThisTick = true;
          newPlayerState.lastAttackTick = gameTickCounter;

          let effectiveAttackerStats = { ...derivedPlayerStats };
          
          if (newPlayerState.unstoppableForceBuff) {
            effectiveAttackerStats.critChance += newPlayerState.unstoppableForceBuff.critChanceBonus;
            newPlayerState.unstoppableForceBuff.attacksRemaining -= 1;
            if (newPlayerState.unstoppableForceBuff.attacksRemaining <= 0) {
              newPlayerState.unstoppableForceBuff = null;
              addBattleMessage('멈출 수 없는 힘 효과 종료.', 'info');
            }
          }

          const finishingTouchSkill = skills.find(s => s.id === 'finishing_touch' && s.currentLevel > 0);
          if (finishingTouchSkill && (engagedMonster.currentHp / engagedMonster.scaledHp) <= 0.25) {
            const critBonus = finishingTouchSkill.currentLevel * 0.05 + 0.05;
            effectiveAttackerStats.critChance += critBonus;
          }
          effectiveAttackerStats.critChance = Math.max(0, Math.min(1, effectiveAttackerStats.critChance));

          let hunterInstinctDamageMultiplier = 1.0;
          const hunterInstinctSkill = skills.find(s => s.id === 'hunter_instinct' && s.currentLevel > 0);
          if (hunterInstinctSkill && engagedMonster.isBoss) {
            hunterInstinctDamageMultiplier = 1 + (hunterInstinctSkill.currentLevel * 0.05 + 0.02);
          }

          if (newPlayerState.retributionBuff) {
            effectiveAttackerStats.attack *= newPlayerState.retributionBuff.damageBonusMultiplier;
            newPlayerState.retributionBuff.attacksRemaining -=1;
            addBattleMessage(`응징! 공격력 ${Math.round((newPlayerState.retributionBuff.damageBonusMultiplier -1) * 100)}% 증가! (${newPlayerState.retributionBuff.attacksRemaining}회 남음)`, 'skill_proc');
             addSkillProcEvent('retribution', PLAYER_ID, undefined, newPlayerState.position, 0xff8c00); 
            if (newPlayerState.retributionBuff.attacksRemaining <= 0) {
                newPlayerState.retributionBuff = null;
                 addBattleMessage('응징 효과 종료.', 'info');
            }
          }
          
          let { damage, isCritical } = calculateDamage(
              effectiveAttackerStats, 
              { defense: engagedMonster.scaledDefense }, 
              engagedMonster.activeStatusEffects 
          );

          if (hunterInstinctSkill && engagedMonster.isBoss) {
            const originalDamage = damage;
            damage = Math.round(damage * hunterInstinctDamageMultiplier);
            if (damage > originalDamage && engagedMonster.currentHp > 0) addSkillProcEvent('hunter_instinct', PLAYER_ID, engagedMonster.instanceId, engagedMonster.position, 0xFF4500); 
          }
          
          let finalDamage = damage;
          
          const powerStrikeSkill = skills.find(s => s.id === 'power_strike' && s.currentLevel > 0);
          if (newPlayerState.powerStrikePendingDamage > 0) {
            finalDamage += newPlayerState.powerStrikePendingDamage;
            addBattleMessage(`강타 발동! 추가 피해 ${newPlayerState.powerStrikePendingDamage}!`, 'skill_proc');
            if (engagedMonster.currentHp > 0) addSkillProcEvent('power_strike', PLAYER_ID, engagedMonster.instanceId, engagedMonster.position, 0xFFD700); 
            newPlayerState.powerStrikePendingDamage = 0;
          }
          if (powerStrikeSkill) {
            const procChance = (powerStrikeSkill.currentLevel * 6 + 4) / 100; 
            if (Math.random() < procChance) {
              const bonusDamage = powerStrikeSkill.currentLevel * 10; 
              newPlayerState.powerStrikePendingDamage = bonusDamage;
            }
          }

          const executionerStrikeSkill = skills.find(s => s.id === 'executioner_strike' && s.currentLevel > 0);
          if (executionerStrikeSkill && (engagedMonster.currentHp / engagedMonster.scaledHp) <= 0.30) {
            const bonusDamageMultiplier = (executionerStrikeSkill.currentLevel * 0.10 + 0.05); 
            const bonusDamage = Math.round(finalDamage * bonusDamageMultiplier); 
            finalDamage += bonusDamage;
            addBattleMessage(`처형자의 일격! 추가 피해 ${bonusDamage}!`, 'skill_proc');
            if (engagedMonster.currentHp > 0) addSkillProcEvent('executioner_strike', PLAYER_ID, engagedMonster.instanceId, engagedMonster.position, 0xDC143C); 
          }
          
          const shatteringBlowsSkill = skills.find(s => s.id === 'shattering_blows' && s.currentLevel > 0);
          if (shatteringBlowsSkill) {
            const defenseDownEffect = engagedMonster.activeStatusEffects.find(eff => eff.type === StatusEffectType.DEFENSE_DOWN);
            if (defenseDownEffect) {
                const bonusDamagePercent = (shatteringBlowsSkill.currentLevel * 0.15 + 0.05); 
                const bonusDamage = Math.round(finalDamage * bonusDamagePercent); 
                finalDamage += bonusDamage;
                addBattleMessage(`파쇄격! 방어 약화된 적에게 추가 피해 ${bonusDamage}!`, 'skill_proc');
                 if (engagedMonster.currentHp > 0) addSkillProcEvent('shattering_blows', PLAYER_ID, engagedMonster.instanceId, engagedMonster.position, 0xFFA500); 
            }
          }
          
          if (isCritical) {
            const piercingCritsSkill = skills.find(s => s.id === 'piercing_crits' && s.currentLevel > 0);
            if (piercingCritsSkill) {
                const defenseIgnorePercent = (piercingCritsSkill.currentLevel * 0.06 + 0.04); 
                let monsterEffectiveDefense = engagedMonster.scaledDefense * (1 - defenseIgnorePercent);
                const piercingDamageRet = calculateDamage( 
                    effectiveAttackerStats,  
                    { defense: monsterEffectiveDefense },
                    engagedMonster.activeStatusEffects
                );
                finalDamage = Math.round(piercingDamageRet.damage * (hunterInstinctSkill && engagedMonster.isBoss ? hunterInstinctDamageMultiplier : 1)); 
                addBattleMessage(`꿰뚫는 치명타! 방어력 일부 무시!`, 'skill_proc');
                 if (engagedMonster.currentHp > 0) addSkillProcEvent('piercing_crits', PLAYER_ID, engagedMonster.instanceId, engagedMonster.position, 0xADD8E6); 
            }
          }

          setSessionStats(s => ({ ...s, damageDealt: s.damageDealt + finalDamage }));
          addBattleMessage(
            `플레이어가 ${engagedMonster.name}에게 ${isCritical ? '치명타! ' : ''}${finalDamage} 피해.`,
            isCritical ? 'critical' : 'damage'
          );
          addAttackEvent(PLAYER_ID, engagedMonster.instanceId, isCritical);

          let mutableEngagedMonster = { ...engagedMonster, currentHp: Math.max(0, engagedMonster.currentHp - finalDamage) };

          const sunderArmorSkill = skills.find(s => s.id === 'sunder_armor' && s.currentLevel > 0);
          if (sunderArmorSkill) {
            const procChance = (sunderArmorSkill.currentLevel * 8 + 7) / 100; 
            if (Math.random() < procChance) {
              const duration = (sunderArmorSkill.currentLevel + 2); 
              const potency = (sunderArmorSkill.currentLevel * 0.05 + 0.10); 
              const { newEffects, appliedEffect } = applyStatusEffect(
                mutableEngagedMonster.activeStatusEffects, StatusEffectType.DEFENSE_DOWN, potency, duration, PLAYER_ID
              );
              mutableEngagedMonster.activeStatusEffects = newEffects;
              if (appliedEffect) {
                  addBattleMessage(`방어구 가르기! ${engagedMonster.name} 방어력 감소!`, 'skill_proc');
                  if (mutableEngagedMonster.currentHp > 0) addSkillProcEvent('sunder_armor', PLAYER_ID, mutableEngagedMonster.instanceId, mutableEngagedMonster.position, 0x8B4513); 
              }
            }
          }
          
          const crushingImpactSkill = skills.find(s => s.id === 'crushing_impact' && s.currentLevel > 0);
          if (crushingImpactSkill) {
            const procChance = (crushingImpactSkill.currentLevel * 0.05 + 0.05); 
            if (Math.random() < procChance) {
                let stunDurationSeconds = crushingImpactSkill.currentLevel * 0.5 + 0.5; 
                if (mutableEngagedMonster.isBoss) stunDurationSeconds = Math.max(1, Math.floor(stunDurationSeconds / 2));
                const stunDurationTicks = Math.round(stunDurationSeconds); 

                const { newEffects, appliedEffect } = applyStatusEffect(
                    mutableEngagedMonster.activeStatusEffects, StatusEffectType.STUN, 0, stunDurationTicks, PLAYER_ID
                );
                mutableEngagedMonster.activeStatusEffects = newEffects;
                if (appliedEffect) {
                    addBattleMessage(`분쇄 충격! ${mutableEngagedMonster.name}을(를) ${appliedEffect.durationTicks}턴 동안 기절시킵니다!`, 'skill_proc');
                    if (mutableEngagedMonster.currentHp > 0) addSkillProcEvent('crushing_impact', PLAYER_ID, mutableEngagedMonster.instanceId, mutableEngagedMonster.position, 0x808080); 
                    const unstoppableForceSkill = skills.find(s => s.id === 'unstoppable_force' && s.currentLevel > 0);
                    if (unstoppableForceSkill) {
                        newPlayerState.unstoppableForceBuff = {
                            attacksRemaining: unstoppableForceSkill.currentLevel,
                            critChanceBonus: (unstoppableForceSkill.currentLevel * 0.10 + 0.05)
                        };
                        addBattleMessage(`멈출 수 없는 힘! 다음 ${newPlayerState.unstoppableForceBuff.attacksRemaining}회 공격 치명타 확률 증가!`, 'skill_proc');
                        addSkillProcEvent('unstoppable_force', PLAYER_ID, undefined, newPlayerState.position, 0xFFFF00); 
                    }
                }
            }
          }

          const combatFlowSkill = skills.find(s => s.id === 'combat_flow' && s.currentLevel > 0);
          if (combatFlowSkill) {
            newPlayerState.consecutiveAttackCount += 1;
            if (newPlayerState.consecutiveAttackCount >= 3) {
                const durationTicks = combatFlowSkill.currentLevel * 2; 
                const potency = combatFlowSkill.currentLevel * 0.10; 
                const { newEffects: playerNewEffects, appliedEffect } = applyStatusEffect(
                    newPlayerState.activeStatusEffects, StatusEffectType.ATTACK_SPEED_BUFF, potency, durationTicks, PLAYER_ID
                );
                newPlayerState.activeStatusEffects = playerNewEffects;
                if (appliedEffect) {
                    addBattleMessage(`전투의 흐름! ${durationTicks}턴 동안 공격 속도 ${potency*100}% 증가!`, 'skill_proc');
                    addSkillProcEvent('combat_flow', PLAYER_ID, undefined, newPlayerState.position, 0x00BFFF); 
                }
                newPlayerState.consecutiveAttackCount = 0; 
            }
          } else {
            newPlayerState.consecutiveAttackCount = 0; 
          }
          
          if (isCritical) {
            const lethalTempoSkill = skills.find(s => s.id === 'lethal_tempo' && s.currentLevel > 0);
            if (lethalTempoSkill) {
                const durationTicks = lethalTempoSkill.currentLevel + 1; 
                const potency = (lethalTempoSkill.currentLevel * 0.05 + 0.05); 
                const { newEffects: playerNewEffects, appliedEffect } = applyStatusEffect(
                    newPlayerState.activeStatusEffects, StatusEffectType.ATTACK_SPEED_BUFF, potency, durationTicks, PLAYER_ID
                );
                newPlayerState.activeStatusEffects = playerNewEffects;
                if (appliedEffect) {
                    addBattleMessage(`치명적 속도! ${durationTicks}턴 동안 공격 속도 ${potency*100}% 증가!`, 'skill_proc');
                    addSkillProcEvent('lethal_tempo', PLAYER_ID, undefined, newPlayerState.position, 0xFF8C00); 
                }
            }
            const exposeWeaknessSkill = skills.find(s => s.id === 'expose_weakness' && s.currentLevel > 0);
            if (exposeWeaknessSkill) {
                const procChance = (exposeWeaknessSkill.currentLevel * 0.10 + 0.05); 
                if (Math.random() < procChance) {
                    const duration = 5; 
                    const potency = (exposeWeaknessSkill.currentLevel * 0.03 + 0.02); 
                    const { newEffects, appliedEffect } = applyStatusEffect(
                        mutableEngagedMonster.activeStatusEffects, StatusEffectType.VULNERABILITY, potency, duration, PLAYER_ID
                    );
                    mutableEngagedMonster.activeStatusEffects = newEffects;
                    if (appliedEffect && mutableEngagedMonster.currentHp > 0) {
                         addBattleMessage(`약점 노출! ${mutableEngagedMonster.name}이(가) ${duration}턴 동안 ${potency*100}% 추가 피해!`, 'skill_proc');
                         addSkillProcEvent('expose_weakness', PLAYER_ID, mutableEngagedMonster.instanceId, mutableEngagedMonster.position, 0xEE82EE); 
                    }
                }
            }
          }

          const quakeStompSkill = skills.find(s => s.id === 'quake_stomp' && s.currentLevel > 0);
          if (quakeStompSkill) {
            const aoeDamagePercent = quakeStompSkill.currentLevel * 0.10 + 0.05;
            const slowDuration = quakeStompSkill.currentLevel + 1;
            const slowPotency = 0.20; 
            addSkillProcEvent('quake_stomp', PLAYER_ID, undefined, newPlayerState.position, 0xA0522D); 

            let monstersToUpdateForQuake: ActiveMonster[] = [];
            setMonsters(prevMs => {
                monstersToUpdateForQuake = prevMs.map(m => ({...m, activeStatusEffects: [...m.activeStatusEffects]})); 
                monstersToUpdateForQuake.forEach(otherMonster => {
                    if (otherMonster.instanceId !== mutableEngagedMonster.instanceId && otherMonster.currentHp > 0) {
                        if (calculateDistance(mutableEngagedMonster.position, otherMonster.position) <= GAME_CONFIG.QUAKE_STOMP_RADIUS) {
                            const aoeDamage = Math.round(derivedPlayerStats.attack * aoeDamagePercent);
                            otherMonster.currentHp = Math.max(0, otherMonster.currentHp - aoeDamage);
                            setSessionStats(s => ({ ...s, damageDealt: s.damageDealt + aoeDamage }));
                            addBattleMessage(`지진 발구르기! ${otherMonster.name}에게 ${aoeDamage} 광역 피해!`, 'skill_proc');
                            
                            const { newEffects, appliedEffect } = applyStatusEffect(
                                otherMonster.activeStatusEffects, StatusEffectType.SLOW, slowPotency, slowDuration, PLAYER_ID
                            );
                            otherMonster.activeStatusEffects = newEffects;
                            if (appliedEffect) addBattleMessage(`${otherMonster.name} 이동 속도 감소!`, 'effect_applied');
                             if (otherMonster.currentHp <= 0) { 
                                 setSessionStats(s => ({ ...s, monstersKilled: s.monstersKilled + 1 }));
                                 addBattleMessage(`${otherMonster.name} 처치! (광역 피해)`, 'info');
                                 // Note: XP/Gold for AOE kills might be complex; for now, main target kill handles it.
                             }
                        }
                    }
                });
                const mainEngagedIndex = monstersToUpdateForQuake.findIndex(m => m.instanceId === mutableEngagedMonster.instanceId);
                if (mainEngagedIndex !== -1) {
                    monstersToUpdateForQuake[mainEngagedIndex] = mutableEngagedMonster;
                } else if (mutableEngagedMonster.currentHp > 0) { 
                    monstersToUpdateForQuake.push(mutableEngagedMonster);
                }
                return monstersToUpdateForQuake.filter(m => m.currentHp > 0);
            });
          } else {
             setMonsters(prevMonsters => prevMonsters.map(m => m.instanceId === mutableEngagedMonster.instanceId ? mutableEngagedMonster : m).filter(m => m.currentHp > 0));
          }
           
           const insightfulStrikesSkill = skills.find(s => s.id === 'insightful_strikes' && s.currentLevel > 0);
           if (insightfulStrikesSkill) {
               const procChance = insightfulStrikesSkill.currentLevel * 0.03 + 0.02;
               if (Math.random() < procChance) {
                   const duration = insightfulStrikesSkill.currentLevel * 2 + 1;
                   const potency = insightfulStrikesSkill.currentLevel * 0.05 + 0.03;
                   const { newEffects, appliedEffect } = applyStatusEffect(
                       newPlayerState.activeStatusEffects, StatusEffectType.ATTACK_BUFF, potency, duration, PLAYER_ID
                   );
                   newPlayerState.activeStatusEffects = newEffects;
                   if (appliedEffect) {
                       addBattleMessage(`통찰력 있는 공격! ${duration}초간 공격력 ${potency*100}% 증가!`, 'skill_proc');
                       addSkillProcEvent('insightful_strikes', PLAYER_ID, undefined, newPlayerState.position, 0xFFFFFF); 
                       
                       const tacticalAdvantageSkill = skills.find(s => s.id === 'tactical_advantage' && s.currentLevel > 0);
                       if (tacticalAdvantageSkill) {
                           const taDuration = tacticalAdvantageSkill.currentLevel * 2;
                           const taPotency = (tacticalAdvantageSkill.currentLevel * 0.02 + 0.01);
                           const { newEffects: taNewEffects, appliedEffect: taApplied } = applyStatusEffect(
                               newPlayerState.activeStatusEffects, StatusEffectType.ALL_STATS_BUFF, taPotency, taDuration, PLAYER_ID
                           );
                           newPlayerState.activeStatusEffects = taNewEffects;
                           if (taApplied) {
                               addBattleMessage(`전술적 우위! ${taDuration}초간 모든 주요 능력치 ${taPotency*100}% 증가!`, 'skill_proc');
                               addSkillProcEvent('tactical_advantage', PLAYER_ID, undefined, newPlayerState.position, 0xFFD700); 
                           }
                       }
                   }
               }
           }

          if (GAME_CONFIG.playerBaseStatusEffectChance && Math.random() < GAME_CONFIG.playerBaseStatusEffectChance.chance) {
            const effectConfig = GAME_CONFIG.playerBaseStatusEffectChance;
            setMonsters(prevMs => prevMs.map(m => { 
                if (m.instanceId === mutableEngagedMonster.instanceId) {
                    const { newEffects, appliedEffect } = applyStatusEffect(
                      m.activeStatusEffects, effectConfig.type, effectConfig.potency, effectConfig.duration, PLAYER_ID
                    );
                    if (appliedEffect) addBattleMessage(`플레이어가 ${engagedMonster.name}에게 ${appliedEffect.name} 효과를 걸었습니다!`, 'effect_applied');
                    return {...m, activeStatusEffects: newEffects};
                }
                return m;
            }));
          }
          
          if (mutableEngagedMonster.currentHp <= 0) {
            setSessionStats(s => ({ ...s, monstersKilled: s.monstersKilled + 1 }));
            if (mutableEngagedMonster.isBoss) {
                setSessionStats(s => ({ ...s, bossesDefeated: s.bossesDefeated + 1 }));
            }
            addBattleMessage(`${mutableEngagedMonster.name} 처치!`, mutableEngagedMonster.isBoss ? 'boss_defeat' : 'info');
            gainExperience(mutableEngagedMonster.scaledXpDrop);
            
            let goldDropped = Math.floor(Math.random() * (mutableEngagedMonster.scaledGoldDrop[1] - mutableEngagedMonster.scaledGoldDrop[0] + 1)) + mutableEngagedMonster.scaledGoldDrop[0];
            
            const keenSensesSkill = skills.find(s => s.id === 'keen_senses' && s.currentLevel > 0);
            if (keenSensesSkill) {
                const goldBonusPercent = (keenSensesSkill.currentLevel * 0.07 + 0.03); 
                goldDropped = Math.round(goldDropped * (1 + goldBonusPercent));
            }
            const treasureHunterSkill = skills.find(s => s.id === 'treasure_hunter' && s.currentLevel > 0);
            if (treasureHunterSkill) {
                const goldBonusPercent = treasureHunterSkill.currentLevel * 0.10; 
                goldDropped = Math.round(goldDropped * (1 + goldBonusPercent));
            }
            const fortuneFavorsSkill = skills.find(s => s.id === 'fortune_favors' && s.currentLevel > 0);
            if (fortuneFavorsSkill) {
                const procChance = (fortuneFavorsSkill.currentLevel * 0.01 + 0.01); 
                if (Math.random() < procChance) {
                    const bonusGold = Math.floor(Math.random() * 10) + 5; 
                    goldDropped += bonusGold;
                    addBattleMessage(`행운의 가호! 추가 골드 ${bonusGold} 획득!`, 'skill_proc');
                    addSkillProcEvent('fortune_favors', PLAYER_ID, undefined, newPlayerState.position, 0xFFD700); 
                }
            }
            const goldFindBuff = newPlayerState.activeStatusEffects.find(eff => eff.type === StatusEffectType.GOLD_FIND_BUFF);
            if (goldFindBuff) {
                goldDropped = Math.round(goldDropped * (1 + goldFindBuff.potency));
                addBattleMessage(`행운 연쇄 활성! 추가 골드 ${Math.round(goldDropped * goldFindBuff.potency / (1+goldFindBuff.potency) )} (기존 대비 ${goldFindBuff.potency * 100}%) 획득!`, 'skill_proc');
            }

            newPlayerState.gold += goldDropped;
            addBattleMessage(`경험치 ${mutableEngagedMonster.scaledXpDrop}, 골드 ${goldDropped} 획득.`, 'loot');

            // Enhancement Stone Drop
            if (Math.random() < GAME_CONFIG.ENHANCEMENT_STONE_DROP_CHANCE) {
                const stonesDropped = Math.floor(Math.random() * (GAME_CONFIG.ENHANCEMENT_STONE_DROP_AMOUNT[1] - GAME_CONFIG.ENHANCEMENT_STONE_DROP_AMOUNT[0] + 1)) + GAME_CONFIG.ENHANCEMENT_STONE_DROP_AMOUNT[0];
                newPlayerState.enhancementStones += stonesDropped;
                setSessionStats(s => ({ ...s, enhancementStonesAcquired: s.enhancementStonesAcquired + stonesDropped }));
                addBattleMessage(`${stonesDropped} 강화석 획득!`, 'loot');
            }
            
            if (mutableEngagedMonster.isBoss) {
                const essenceGained = BOSS_ESSENCE_DROP;
                setPersistentProgress(prev => ({ ...prev, essence: prev.essence + essenceGained }));
                addBattleMessage(`${essenceGained} 영웅의 정수 획득! (보스 처치)`, 'loot');
            }

            const battleTranceSkill = skills.find(s => s.id === 'battle_trance' && s.currentLevel > 0);
            if (battleTranceSkill) {
                const durationTicks = battleTranceSkill.currentLevel * 2; 
                const asPotency = battleTranceSkill.currentLevel * 0.05;
                const msPotency = battleTranceSkill.currentLevel * 0.03;

                const { newEffects: asEffects, appliedEffect: asApplied } = applyStatusEffect(
                    newPlayerState.activeStatusEffects, StatusEffectType.ATTACK_SPEED_BUFF, asPotency, durationTicks, PLAYER_ID
                );
                newPlayerState.activeStatusEffects = asEffects;
                if (asApplied) {
                    addBattleMessage(`전투 무아지경! 공격 속도 ${asPotency*100}% 증가!`, 'skill_proc');
                    addSkillProcEvent('battle_trance_as', PLAYER_ID, undefined, newPlayerState.position, 0x00FFFF); 
                }
                
                const { newEffects: msEffects, appliedEffect: msApplied } = applyStatusEffect(
                    newPlayerState.activeStatusEffects, StatusEffectType.MOVEMENT_SPEED_BUFF, msPotency, durationTicks, PLAYER_ID
                );
                newPlayerState.activeStatusEffects = msEffects;
                 if (msApplied) {
                    addBattleMessage(`전투 무아지경! 이동 속도 ${msPotency*100}% 증가!`, 'skill_proc');
                    addSkillProcEvent('battle_trance_ms', PLAYER_ID, undefined, newPlayerState.position, 0xAFEEEE); 
                 }
            }

            const luckyStreakSkill = skills.find(s => s.id === 'lucky_streak' && s.currentLevel > 0);
            if (luckyStreakSkill) {
                newPlayerState.recentKills.push({ tick: gameTickCounter });
                newPlayerState.recentKills = newPlayerState.recentKills.filter(
                    kill => gameTickCounter - kill.tick < GAME_CONFIG.LUCKY_STREAK_WINDOW_TICKS
                );
                if (newPlayerState.recentKills.length >= 3) {
                    const duration = luckyStreakSkill.currentLevel * GAME_CONFIG.LUCKY_STREAK_DURATION_TICKS + GAME_CONFIG.LUCKY_STREAK_DURATION_TICKS; 
                    const potency = 0.50; 
                    const { newEffects, appliedEffect } = applyStatusEffect(
                        newPlayerState.activeStatusEffects, StatusEffectType.GOLD_FIND_BUFF, potency, duration, PLAYER_ID
                    );
                    newPlayerState.activeStatusEffects = newEffects;
                    if (appliedEffect) {
                        addBattleMessage(`행운 연쇄! ${duration}초 동안 골드 발견량 50% 증가!`, 'skill_proc');
                        addSkillProcEvent('lucky_streak', PLAYER_ID, undefined, newPlayerState.position, 0xFFFFE0); 
                    }
                    newPlayerState.recentKills = []; 
                }
            }

            const lootChance = mutableEngagedMonster.isBoss ? 1.0 : 0.3;
            if (Math.random() < lootChance) {
              const itemDropLevel = newPlayerState.level; // Item level based on current player level
              const newItemRarity = mutableEngagedMonster.isBoss ? Object.values(Rarity)[GAME_CONFIG.BOSS_LOOT_MIN_RARITY_INDEX] || Rarity.UNCOMMON : undefined;
              const newItem = generateRandomItem(itemDropLevel, newItemRarity);
              setInventory(prevInv => {
                const emptySlotIndex = prevInv.findIndex(slot => slot === null);
                if (emptySlotIndex !== -1) {
                  const newInv = [...prevInv]; newInv[emptySlotIndex] = newItem;
                  setSessionStats(s => ({ ...s, itemsLooted: s.itemsLooted + 1 }));
                  addBattleMessage(`${newItem.name} 발견! (${newItem.rarity})`, 'loot'); return newInv;
                } else { addBattleMessage(`소지품 가득! 아이템(${newItem.name}) 소실!`, 'error'); return prevInv; }
              });
            }
            newPlayerState.engagedMonsterId = null; 
            newPlayerState.consecutiveAttackCount = 0; 

            if (mutableEngagedMonster.isBoss) {
                setMonsters(prevMonsters => { 
                    const stillAliveBosses = prevMonsters.filter(m => m.isBoss && m.currentHp > 0 && m.instanceId !== mutableEngagedMonster.instanceId).length;
                    if (stillAliveBosses === 0) {
                        addBattleMessage(`${mutableEngagedMonster.name} 격파! 액트 클리어! (최종 보스 처리)`, 'boss_defeat');
                        waveAdvancedForWaveRef.current[currentWave] = true; 
                        setCurrentWave(prevWave => {
                            const newWaveVal = prevWave + 1;
                             setPersistentProgress(prevPP => ({ 
                                ...prevPP,
                                highestWaveAchieved: Math.max(prevPP.highestWaveAchieved, newWaveVal -1), 
                            }));
                            return newWaveVal;
                        });
                        newPlayerState.masterTacticianAppliedWave = 0; 
                    }
                    return prevMonsters.filter(m => m.instanceId !== mutableEngagedMonster.instanceId && m.currentHp > 0);
                });
            }
          }
        } else if (engagedMonster) { 
            newPlayerState.engagedMonsterId = null;
            newPlayerState.consecutiveAttackCount = 0; 
        } else if (newPlayerState.consecutiveAttackCount > 0 && newPlayerState.lastAttackTick < gameTickCounter) { 
            newPlayerState.consecutiveAttackCount = 0;
        }
        return newPlayerState;
      });

      if (isGameOver) return;

      if (!playerAttackedThisTick && player.lastAttackTick < gameTickCounter -1 && player.consecutiveAttackCount > 0) {
        setPlayer(p => ({...p, consecutiveAttackCount: 0}));
      }

      setMonsters(currentLocalMonsters => 
        currentLocalMonsters.map(monster => {
          if (isGameOver || player.hp <= 0 || !monster.isEngaged || monster.currentHp <= 0 || monster.activeStatusEffects.some(e => e.type === StatusEffectType.STUN)) {
            return monster;
          }

          if (calculateDistance(player.position, monster.position) <= GAME_CONFIG.ENGAGEMENT_RANGE) {
            let { damage: monsterDamage, isCritical: monsterCrit } = calculateDamage(
              { attack: monster.scaledAttack, critChance: 0.05, critDamage: 1.5 }, 
              { defense: derivedPlayerStats.defense },
              player.activeStatusEffects 
            );

            const nimbleDefenseSkill = skills.find(s => s.id === 'nimble_defense' && s.currentLevel > 0);
            if (nimbleDefenseSkill) {
              const dodgeChance = (nimbleDefenseSkill.currentLevel * 0.03 + 0.02); 
              if (Math.random() < dodgeChance) {
                monsterDamage = Math.round(monsterDamage * 0.5); 
                addBattleMessage(`날렵한 방어! 플레이어가 공격 일부 회피! 피해량 ${monsterDamage}로 감소.`, 'skill_proc');
                setPlayer(p => ({...p, dodgedThisTick: true})); 
                 addSkillProcEvent('nimble_defense', PLAYER_ID, undefined, player.position, 0x00CED1); 
              }
            }
            
            const resilienceSkill = skills.find(s => s.id === 'resilience' && s.currentLevel > 0);
            if (resilienceSkill) {
                const flatReduction = resilienceSkill.currentLevel * 1 + 1; 
                monsterDamage = Math.max(1, monsterDamage - flatReduction); 
            }

            let monsterAttackedPlayerHP = player.hp; 
            setSessionStats(s => ({ ...s, damageTaken: s.damageTaken + monsterDamage }));

            setPlayer(p => {
              if (p.hp <= 0) return p; 
              let newPlayerHp = Math.max(0, p.hp - monsterDamage);
              monsterAttackedPlayerHP = newPlayerHp; 
              addBattleMessage(
                `${monster.name}이(가) 플레이어에게 ${monsterCrit ? '치명타! ' : ''}${monsterDamage} 피해. (플레이어 체력: ${newPlayerHp.toFixed(0)})`,
                monsterCrit ? 'critical' : 'damage'
              );
              addAttackEvent(monster.instanceId, PLAYER_ID, monsterCrit);
              
              let newPlayerStateAttack = { ...p, hp: newPlayerHp };

              if (monsterCrit) {
                const retributionSkill = skills.find(s => s.id === 'retribution' && s.currentLevel > 0);
                if (retributionSkill) {
                    newPlayerStateAttack.retributionBuff = {
                        attacksRemaining: retributionSkill.currentLevel,
                        damageBonusMultiplier: 1 + (retributionSkill.currentLevel * 0.10 + 0.10)
                    };
                    addBattleMessage(`응징! 다음 ${newPlayerStateAttack.retributionBuff.attacksRemaining}회 공격 피해량 증가!`, 'skill_proc');
                    addSkillProcEvent('retribution_buff_gain', PLAYER_ID, undefined, newPlayerStateAttack.position, 0xB22222); 
                }
              }
              
              if (monster.appliesEffect && Math.random() < monster.appliesEffect.chance) {
                const effectConfig = monster.appliesEffect;
                const ironWillSkill = skills.find(s => s.id === 'iron_will' && s.currentLevel > 0);
                const ironWillReduction = ironWillSkill ? (ironWillSkill.currentLevel * 0.06 + 0.04) : 0;
                
                let purificationChance = 0;
                const purificationSkill = skills.find(s => s.id === 'purification' && s.currentLevel > 0);
                if (purificationSkill) {
                    purificationChance = (purificationSkill.currentLevel * 0.05 + 0.05);
                }

                const { newEffects, appliedEffect, resisted } = applyStatusEffect(
                  newPlayerStateAttack.activeStatusEffects, effectConfig.type, effectConfig.potency, effectConfig.duration, monster.instanceId, ironWillReduction, purificationChance
                );
                if (appliedEffect) {
                  addBattleMessage(`${monster.name}이(가) 플레이어에게 ${appliedEffect.name} 효과를 걸었습니다!`, 'effect_applied');
                } else if (resisted) {
                    addBattleMessage(`정화! 플레이어가 ${STATUS_EFFECT_DEFINITIONS[effectConfig.type]?.name || '효과'}에 저항했습니다!`, 'skill_proc');
                    addSkillProcEvent('purification', PLAYER_ID, undefined, newPlayerStateAttack.position, 0xE0FFFF); 
                }
                newPlayerStateAttack.activeStatusEffects = newEffects;
              }

              if (newPlayerHp <= 0 && !isGameOver) {
                addBattleMessage('플레이어가 패배했습니다! 게임 종료.', 'error');
                handleGameOver();
                playerDiedThisTick = true;
              }
              return newPlayerStateAttack;
            });

            const thornsAuraSkill = skills.find(s => s.id === 'thorns_aura' && s.currentLevel > 0);
            if (thornsAuraSkill && monsterAttackedPlayerHP > 0) { 
              let thornsDamage = Math.round(derivedPlayerStats.defense * (thornsAuraSkill.currentLevel * 0.05 + 0.05));
              const spikedArmorSkill = skills.find(s => s.id === 'spiked_armor' && s.currentLevel > 0);
              if (spikedArmorSkill) {
                  thornsDamage = Math.round(thornsDamage * (1 + (spikedArmorSkill.currentLevel * 0.10 + 0.05)));
              }

              if (thornsDamage > 0) {
                   setSessionStats(s => ({ ...s, damageDealt: s.damageDealt + thornsDamage })); // Thorns damage counts as player dealt
                   addSkillProcEvent('thorns_aura', PLAYER_ID, monster.instanceId, monster.position, 0xff0000); 
                   monster.currentHp = Math.max(0, monster.currentHp - thornsDamage);
                   addBattleMessage(`가시 갑옷! ${monster.name}에게 ${thornsDamage} 반사 피해!`, 'skill_proc');
                   
                   if (spikedArmorSkill && monster.currentHp > 0) {
                       const bleedProcChance = spikedArmorSkill.currentLevel * 0.05 + 0.05;
                       if (Math.random() < bleedProcChance) {
                           const bleedDuration = 3; 
                           const bleedPotency = Math.max(1, Math.round(derivedPlayerStats.defense * 0.1)); 
                           const { newEffects, appliedEffect } = applyStatusEffect(
                               monster.activeStatusEffects, StatusEffectType.BLEED, bleedPotency, bleedDuration, PLAYER_ID
                           );
                           monster.activeStatusEffects = newEffects; 
                           if (appliedEffect) {
                               addBattleMessage(`날카로운 갑옷! ${monster.name}에게 출혈 발생!`, 'skill_proc');
                               addSkillProcEvent('spiked_armor_bleed', PLAYER_ID, monster.instanceId, monster.position, 0x8B0000); 
                           }
                       }
                   }
                   if (monster.currentHp <= 0) { 
                       setSessionStats(s => ({ ...s, monstersKilled: s.monstersKilled + 1 }));
                       if (monster.isBoss) setSessionStats(s => ({ ...s, bossesDefeated: s.bossesDefeated + 1 }));
                       addBattleMessage(`${monster.name} 처치! (반사/출혈 피해)`, 'info');
                       gainExperience(monster.scaledXpDrop); 
                       let goldDropped = Math.floor(Math.random() * (monster.scaledGoldDrop[1] - monster.scaledGoldDrop[0] + 1)) + monster.scaledGoldDrop[0];
                       setPlayer(p => ({...p, gold: p.gold + goldDropped}));
                       addBattleMessage(`경험치 ${monster.scaledXpDrop}, 골드 ${goldDropped} 획득.`, 'loot');
                         if (monster.isBoss) { // Also give essence if boss dies to thorns
                            const essenceGained = BOSS_ESSENCE_DROP;
                            setPersistentProgress(prev => ({ ...prev, essence: prev.essence + essenceGained }));
                            addBattleMessage(`${essenceGained} 영웅의 정수 획득! (보스 처치)`, 'loot');
                        }
                   }
              }
            }
          }
          return monster;
        }).filter(m => m !== null && m.currentHp > 0) as ActiveMonster[] 
      );
      
      if (isGameOver) return;

      setPlayer(p => {
        if (p.dodgedThisTick) {
            const evasiveManeuversSkill = skills.find(s => s.id === 'evasive_maneuvers' && s.currentLevel > 0);
            if (evasiveManeuversSkill) {
                const duration = evasiveManeuversSkill.currentLevel + 1;
                const potency = evasiveManeuversSkill.currentLevel * 0.10 + 0.10;
                const { newEffects, appliedEffect } = applyStatusEffect(
                    p.activeStatusEffects, StatusEffectType.MOVEMENT_SPEED_BUFF, potency, duration, PLAYER_ID
                );
                if (appliedEffect) {
                    addBattleMessage(`회피 기동! ${duration}초간 이동 속도 ${potency*100}% 증가!`, 'skill_proc');
                    addSkillProcEvent('evasive_maneuvers', PLAYER_ID, undefined, p.position, 0xADD8E6); 
                }
                return { ...p, activeStatusEffects: newEffects, dodgedThisTick: false }; 
            }
            return { ...p, dodgedThisTick: false }; 
        }
        return p;
      });
      
      setPlayer(p => {
        if (p.hp <= 0 || p.hp >= derivedPlayerStats.maxHp || derivedPlayerStats.healthRegen <= 0) return p;
        
        let currentHealthRegen = derivedPlayerStats.healthRegen;
        const unyieldingSpiritSkill = skills.find(s => s.id === 'unyielding_spirit' && s.currentLevel > 0);
        if (unyieldingSpiritSkill && (p.hp / derivedPlayerStats.maxHp) <= 0.30) {
            const healAmp = 1 + (unyieldingSpiritSkill.currentLevel * 0.10 + 0.10);
            currentHealthRegen *= healAmp;
            if (currentHealthRegen > derivedPlayerStats.healthRegen) { 
                 addSkillProcEvent('unyielding_spirit', PLAYER_ID, undefined, p.position, 0x32CD32); 
            }
        }
        
        const newHp = Math.min(derivedPlayerStats.maxHp, p.hp + currentHealthRegen * (GAME_CONFIG.battleTickIntervalMs / 1000));
        return { ...p, hp: newHp };
      });
      
      if (player.engagedMonsterId && !monsters.some(m => m.instanceId === player.engagedMonsterId && m.currentHp > 0)) {
        setPlayer(p => ({ ...p, engagedMonsterId: null, consecutiveAttackCount: 0 })); 
      }

    }, GAME_CONFIG.battleTickIntervalMs);

    return () => clearInterval(gameTickInterval);
  }, [
    isGameOver, 
    derivedPlayerStats, 
    player, 
    monsters, 
    currentWave, 
    gainExperience, 
    addBattleMessage, 
    addSkillProcEvent,
    isBossWaveActive,
    skills, 
    equippedItems,
    persistentProgress, 
    handleGameOver // Add handleGameOver to dependencies
  ]);


  useEffect(() => {
    if (isGameOver) return;

    const liveMonstersCount = monsters.filter(m => m.currentHp > 0).length;

    if (!isBossWaveActive) { 
        if (waveInitializedRef.current[currentWave] === true && liveMonstersCount === 0 && !waveAdvancedForWaveRef.current[currentWave]) {
            addBattleMessage(`웨이브 ${currentWave} 클리어!`, 'info');
            waveAdvancedForWaveRef.current[currentWave] = true; 
            const completedWave = currentWave;
            setCurrentWave(prevWave => {
                const newWaveVal = prevWave + 1;
                setPersistentProgress(prevPP => ({ 
                    ...prevPP,
                    highestWaveAchieved: Math.max(prevPP.highestWaveAchieved, completedWave), 
                }));
                return newWaveVal;
            });
            setPlayer(p => ({ ...p, masterTacticianAppliedWave: 0 }));
        }
    }
    // Boss wave advancement and highestWaveAchieved update is handled in player attack logic upon boss defeat.

  }, [monsters, currentWave, isBossWaveActive, isGameOver, addBattleMessage, setCurrentWave, setPlayer, setPersistentProgress]);


  const togglePanel = useCallback((panel: PanelType) => {
    setActivePanel(current => (current === panel ? null : panel));
  }, []);
  

  useEffect(() => { 
    setPlayer(p => {
      if (isGameOver && p.hp <= 0) return p;
      const currentDerivedMaxHp = derivedPlayerStats.maxHp;
      let newPlayerHp = p.hp;
      let needsUpdate = false;
      if (newPlayerHp > currentDerivedMaxHp) {
        newPlayerHp = currentDerivedMaxHp;
        needsUpdate = true;
      }
      if (newPlayerHp < 0 && p.maxHp > 0 && !isGameOver) { 
        newPlayerHp = 0; 
        needsUpdate = true;
      }
      if (needsUpdate) {
        return { ...p, hp: newPlayerHp };
      }
      return p; 
    });
  }, [derivedPlayerStats.maxHp, derivedPlayerStats.attackSpeed, isGameOver]); 

  const toggleAutoEquip = useCallback(() => {
    setAutoEquipEnabled(prev => !prev);
  }, []);

  const toggleAutoLearnSkill = useCallback(() => {
    setAutoLearnSkillEnabled(prev => !prev);
  }, []);

  return {
    player,
    derivedPlayerStats,
    persistentProgress, 
    monsters,
    inventory,
    equippedItems,
    skills,
    battleLog,
    currentWave,
    isGameOver,
    activePanel,
    gameTime,
    attackEvents,
    skillProcEvents,
    isBossWaveActive, 
    autoEquipEnabled,
    autoLearnSkillEnabled,
    shopInventory,
    sessionStats, // Expose sessionStats
    equipItem,
    unequipItem,
    learnSkill,
    buyItem,        
    sellItem,       
    refreshShopStock, 
    togglePanel,
    addBattleMessage,
    restartGame, 
    hardResetGame, 
    toggleAutoEquip,
    toggleAutoLearnSkill,
    upgradePermanentStat, 
    enhanceItem, 
  };
};

export default useGameEngine;
