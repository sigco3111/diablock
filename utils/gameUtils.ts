

import { Item, ItemType, Rarity, StatModifier, PlayerStats, ActiveMonster, Player, MonsterDefinition, SkillDefinition, PlayerSkill, EquippedItems, StatusEffectInstance, StatusEffectType, DerivedPlayerStats, BattleMessage, ThreeDPosition } from '../types.ts';
import { ITEM_BASES, RARITY_COLORS, STATUS_EFFECT_DEFINITIONS, PLAYER_ID, GAME_CONFIG, SKILL_DEFINITIONS } from '../diablockConstants.ts'; 

export const generateItemId = (): string => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const generateMonsterInstanceId = (): string => `monster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const generateStatusEffectInstanceId = (): string => `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
export const generateSkillProcEventId = (): string => `skillproc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;


export const getSizeClassScale = (sizeClass?: string): number => {
    if (!sizeClass) return 1.0;
    const match = sizeClass.match(/w-(\d+)/);
    if (match && match[1]) {
      const widthNum = parseInt(match[1], 10);
      return widthNum / 10.0; 
    }
    return 1.0;
  };

export const generateRandomItem = (level: number, minRarity?: Rarity): Item => {
  const itemTypes = Object.values(ItemType);
  const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  
  const rarities = Object.values(Rarity);
  let randomRarityEnum: Rarity;

  if (minRarity) {
    const minRarityIndex = rarities.indexOf(minRarity);
    if (minRarityIndex === -1) { 
      randomRarityEnum = rarities[Math.floor(Math.random() * rarities.length)];
    } else {
      const possibleRarities = rarities.slice(minRarityIndex);
      randomRarityEnum = possibleRarities[Math.floor(Math.random() * possibleRarities.length)];
    }
  } else {
    randomRarityEnum = rarities[Math.floor(Math.random() * rarities.length)];
  }


  let baseItemName = "일반 아이템";
  let baseModifiers: StatModifier[] = [];
  let icon = "❓";

  const basesForType = ITEM_BASES[randomType as keyof typeof ITEM_BASES];
  if (basesForType && basesForType.length > 0) {
    const randomBase = basesForType[Math.floor(Math.random() * basesForType.length)];
    baseItemName = randomBase.name;
    baseModifiers = JSON.parse(JSON.stringify(randomBase.baseModifiers)); 
    icon = randomBase.icon;
  } else {
    switch (randomType) {
        case ItemType.ARMOR_HEAD: baseItemName = "모자"; icon = "🎓"; break;
        case ItemType.ARMOR_LEGS: baseItemName = "바지"; icon = "👖"; break;
        case ItemType.ARMOR_FEET: baseItemName = "신발"; icon = "👟"; break;
        case ItemType.ARMOR_HANDS: baseItemName = "장갑"; icon = "🧤"; break;
        case ItemType.RING: baseItemName = "반지"; icon = "💍"; break;
        case ItemType.AMULET: baseItemName = "목걸이"; icon = "💎"; break;
    }
  }

  const modifiers: StatModifier[] = [...baseModifiers];
  let itemName = `${randomRarityEnum} ${baseItemName}`;
  let goldValue = 10;

  const numAffixesByRarity = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 2,
    [Rarity.RARE]: 3,
    [Rarity.EPIC]: 4,
    [Rarity.LEGENDARY]: 5,
  };
  const numAffixes = numAffixesByRarity[randomRarityEnum] || 1;


  const possibleStats: (keyof PlayerStats | 'critChance' | 'critDamage' | 'healthRegen' | 'attackSpeed' | 'movementSpeed')[] = ['attack', 'defense', 'maxHp', 'critChance', 'critDamage', 'healthRegen', 'attackSpeed', 'movementSpeed'];

  for (let i = 0; i < numAffixes; i++) {
    if (Math.random() < 0.7) { 
        const randomStat = possibleStats[Math.floor(Math.random() * possibleStats.length)];
        const existingModifier = modifiers.find(m => m.stat === randomStat);
        let value;
        let type: 'flat' | 'percent' = Math.random() < 0.3 ? 'percent' : 'flat';

        if (randomStat === 'attack' || randomStat === 'defense' || randomStat === 'maxHp') {
            value = Math.floor((Math.random() * 5 + 1) * (level / 2 + 1) * (rarities.indexOf(randomRarityEnum) + 1));
            if (type === 'percent') value = (Math.random() * 0.05 + 0.01) * (rarities.indexOf(randomRarityEnum) + 1);
        } else if (randomStat === 'critChance' || randomStat === 'critDamage') {
            value = (Math.random() * 0.03 + 0.01) * (rarities.indexOf(randomRarityEnum) + 1);
            if(randomStat === 'critDamage') value *= 10; 
            type = 'flat'; 
        } else if (randomStat === 'attackSpeed' || randomStat === 'movementSpeed') {
            value = (Math.random() * 0.1 + 0.02) * (rarities.indexOf(randomRarityEnum) + 1); 
             type = 'flat'; 
        } else { // healthRegen
            value = (Math.random() * 1 + 0.1) * (rarities.indexOf(randomRarityEnum) + 1);
            type = 'flat';
        }
        
        value = parseFloat(value.toFixed(type === 'percent' ? 3 : (randomStat === 'attackSpeed' || randomStat === 'movementSpeed' ? 2 : 1) ));


        if (existingModifier && existingModifier.type === type) {
            existingModifier.value += value;
        } else {
            modifiers.push({ stat: randomStat, value, type });
        }
    }
  }
  
  goldValue = Math.floor(level * 5 * (rarities.indexOf(randomRarityEnum) + 1) * (1 + modifiers.length * 0.5));
  if (randomRarityEnum === Rarity.LEGENDARY) goldValue *= 2;


  return {
    id: generateItemId(),
    name: itemName,
    type: randomType,
    rarity: randomRarityEnum,
    modifiers,
    icon,
    goldValue,
    levelRequirement: Math.max(1, level - 2 + rarities.indexOf(randomRarityEnum)),
    enhancementLevel: 0, // Initialize enhancement level
  };
};

export const calculateDamage = (
    attackerStats: { attack: number, critChance: number, critDamage: number }, 
    defenderStats: { defense: number },
    defenderStatusEffects?: StatusEffectInstance[] 
  ): { damage: number, isCritical: boolean } => {
  
  let effectiveDefense = defenderStats.defense;
  if (defenderStatusEffects) {
    const defenseDownEffect = defenderStatusEffects.find(eff => eff.type === StatusEffectType.DEFENSE_DOWN);
    if (defenseDownEffect) {
      effectiveDefense = Math.max(0, effectiveDefense * (1 - defenseDownEffect.potency));
    }
  }

  const isCritical = Math.random() < attackerStats.critChance;
  let baseDamage = attackerStats.attack;
  if (isCritical) {
    baseDamage *= attackerStats.critDamage;
  }
  let mitigatedDamage = Math.max(1, baseDamage - effectiveDefense); 
  
  if (defenderStatusEffects) {
    const vulnerabilityEffect = defenderStatusEffects.find(eff => eff.type === StatusEffectType.VULNERABILITY);
    if (vulnerabilityEffect) {
      mitigatedDamage *= (1 + vulnerabilityEffect.potency);
    }
  }
  
  return { damage: Math.round(mitigatedDamage), isCritical };
};

export const calculatePlayerStats = (basePlayer: Player, equippedItems: EquippedItems, skills: PlayerSkill[]): DerivedPlayerStats => {
  let finalStats: DerivedPlayerStats = {
    hp: basePlayer.hp,
    maxHp: basePlayer.maxHp,
    attack: basePlayer.attack,
    defense: basePlayer.defense,
    critChance: basePlayer.critChance,
    critDamage: basePlayer.critDamage,
    healthRegen: basePlayer.healthRegen,
    attackSpeed: basePlayer.attackSpeed, 
    movementSpeed: basePlayer.movementSpeed, 
    activeStatusEffects: basePlayer.activeStatusEffects, 
  };

  const allModifiers: StatModifier[] = [];

  Object.values(equippedItems).forEach(item => {
    if (item) {
      const enhancementBonus = 1 + (item.enhancementLevel * GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG.bonusPerLevel);
      item.modifiers.forEach(mod => {
        allModifiers.push({
          ...mod,
          value: mod.value * enhancementBonus
        });
      });
    }
  });

  skills.forEach(skill => {
    if (skill.currentLevel > 0) {
      const skillEffects = skill.effects(skill.currentLevel) as StatModifier[];
      allModifiers.push(...skillEffects);
    }
  });

  allModifiers.filter(m => m.type === 'flat').forEach(mod => {
    const statKey = mod.stat as keyof DerivedPlayerStats;
    if (statKey in finalStats && typeof finalStats[statKey] === 'number') {
      (finalStats[statKey] as number) += mod.value;
    }
  });

  allModifiers.filter(m => m.type === 'percent').forEach(mod => {
    const statKey = mod.stat as keyof DerivedPlayerStats;
     if (statKey in finalStats && typeof finalStats[statKey] === 'number') {
      let baseValueForPercentCalculation = 0;
      if (statKey === 'attack') baseValueForPercentCalculation = basePlayer.attack + allModifiers.filter(m => m.stat === 'attack' && m.type ==='flat').reduce((sum, current) => sum + current.value, 0);
      else if (statKey === 'maxHp') baseValueForPercentCalculation = basePlayer.maxHp + allModifiers.filter(m => m.stat === 'maxHp' && m.type ==='flat').reduce((sum, current) => sum + current.value, 0);
      else if (statKey === 'defense') baseValueForPercentCalculation = basePlayer.defense + allModifiers.filter(m => m.stat === 'defense' && m.type ==='flat').reduce((sum, current) => sum + current.value, 0);
      else { 
        baseValueForPercentCalculation = finalStats[statKey] as number;
      }
      
       if (statKey === 'attack' || statKey === 'maxHp' || statKey === 'defense') {
         (finalStats[statKey] as number) += baseValueForPercentCalculation * mod.value;
       } else { 
         (finalStats[statKey] as number) *= (1 + mod.value);
       }
    }
  });
  
  basePlayer.activeStatusEffects.forEach(effect => {
    if (effect.type === StatusEffectType.ATTACK_SPEED_BUFF) {
        finalStats.attackSpeed *= (1 + effect.potency);
    } else if (effect.type === StatusEffectType.MOVEMENT_SPEED_BUFF) {
        finalStats.movementSpeed *= (1 + effect.potency);
    } else if (effect.type === StatusEffectType.ATTACK_BUFF) {
        finalStats.attack *= (1 + effect.potency);
    } else if (effect.type === StatusEffectType.ALL_STATS_BUFF) {
        finalStats.attack *= (1 + effect.potency);
        finalStats.defense *= (1 + effect.potency);
        finalStats.maxHp *= (1 + effect.potency);
    }
  });


  finalStats.hp = Math.min(finalStats.hp, finalStats.maxHp);
  
  finalStats.maxHp = Math.round(finalStats.maxHp);
  finalStats.attack = Math.round(finalStats.attack);
  finalStats.defense = Math.round(finalStats.defense);
  finalStats.healthRegen = parseFloat(finalStats.healthRegen.toFixed(1));
  finalStats.attackSpeed = parseFloat(finalStats.attackSpeed.toFixed(2));
  finalStats.movementSpeed = parseFloat(finalStats.movementSpeed.toFixed(2));

  finalStats.critChance = Math.max(0, Math.min(1, parseFloat(finalStats.critChance.toFixed(3))));
  finalStats.critDamage = parseFloat(finalStats.critDamage.toFixed(2));


  return finalStats;
};

export const getRarityColorClass = (rarity: Rarity): string => {
  return RARITY_COLORS[rarity] || 'text-gray-300';
};

export const experienceToNextLevel = (level: number, baseExp: number, scalingFactor: number): number => {
  return Math.floor(baseExp * Math.pow(scalingFactor, level -1));
};

export const generateMonster = (wave: number, monsterDef: MonsterDefinition): ActiveMonster => {
    const waveScaling = 1 + (wave - 1) * 0.07; 
    const bossWaveScaling = 1 + (wave -1) * 0.03; 
    const currentWaveScaling = monsterDef.isBoss ? bossWaveScaling : waveScaling;

    const scaledHp = Math.round(monsterDef.baseHp * currentWaveScaling);
    const scaledAttack = Math.round(monsterDef.baseAttack * currentWaveScaling);
    const scaledDefense = Math.round(monsterDef.baseDefense * currentWaveScaling);
    const scaledXpDrop = Math.round(monsterDef.xpDrop); // XP does not scale with wave for now
    const scaledGoldDropMin = Math.round(monsterDef.goldDrop[0]); // Gold does not scale with wave for now
    const scaledGoldDropMax = Math.round(monsterDef.goldDrop[1]);

    const scale = getSizeClassScale(monsterDef.sizeClass);
    const yPos = (0.6 * scale) * GAME_CONFIG.MONSTER_BASE_Y_SCALE_FACTOR; 
    
    let xPos, zPos;
    const spawnPadding = 2; 
    const side = Math.floor(Math.random() * 4); 
    switch (side) {
        case 0: 
            xPos = GAME_CONFIG.MAP_BOUNDS.minX + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxX - GAME_CONFIG.MAP_BOUNDS.minX);
            zPos = GAME_CONFIG.MAP_BOUNDS.maxZ - spawnPadding;
            break;
        case 1: 
            xPos = GAME_CONFIG.MAP_BOUNDS.maxX - spawnPadding;
            zPos = GAME_CONFIG.MAP_BOUNDS.minZ + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxZ - GAME_CONFIG.MAP_BOUNDS.minZ);
            break;
        case 2: 
            xPos = GAME_CONFIG.MAP_BOUNDS.minX + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxX - GAME_CONFIG.MAP_BOUNDS.minX);
            zPos = GAME_CONFIG.MAP_BOUNDS.minZ + spawnPadding;
            break;
        case 3: 
        default:
            xPos = GAME_CONFIG.MAP_BOUNDS.minX + spawnPadding;
            zPos = GAME_CONFIG.MAP_BOUNDS.minZ + Math.random() * (GAME_CONFIG.MAP_BOUNDS.maxZ - GAME_CONFIG.MAP_BOUNDS.minZ);
            break;
    }
    
    const initialPosition: ThreeDPosition = { 
        x: Math.max(GAME_CONFIG.MAP_BOUNDS.minX, Math.min(GAME_CONFIG.MAP_BOUNDS.maxX, xPos)), 
        y: yPos, 
        z: Math.max(GAME_CONFIG.MAP_BOUNDS.minZ, Math.min(GAME_CONFIG.MAP_BOUNDS.maxZ, zPos))
    };


    return {
        ...monsterDef, 
        instanceId: generateMonsterInstanceId(),
        currentHp: scaledHp,
        activeStatusEffects: [],
        scaledHp: scaledHp,
        scaledAttack: scaledAttack,
        scaledDefense: scaledDefense,
        scaledXpDrop: scaledXpDrop,
        scaledGoldDrop: [scaledGoldDropMin, scaledGoldDropMax],
        baseHp: scaledHp, // Store scaled values as new base for this instance for progress bar consistency
        baseAttack: scaledAttack, 
        baseDefense: scaledDefense, 
        xpDrop: scaledXpDrop, 
        goldDrop: [scaledGoldDropMin, scaledGoldDropMax], 
        position: initialPosition,
        targetPosition: undefined, 
        movementSpeed: GAME_CONFIG.MONSTER_MOVEMENT_SPEED,
        isEngaged: false,
        targetUpdateCooldown: Math.floor(Math.random() * GAME_CONFIG.MOVEMENT_TARGET_UPDATE_COOLDOWN_TICKS) + 1, 
    };
};

export const applyStatusEffect = (
  targetEffects: StatusEffectInstance[],
  effectType: StatusEffectType,
  potency: number,
  durationInTicks: number, 
  sourceId: string, 
  debuffDurationReduction: number = 0, 
  purificationChance: number = 0 
): { newEffects: StatusEffectInstance[], appliedEffect: StatusEffectInstance | null, resisted: boolean } => {
  const definition = STATUS_EFFECT_DEFINITIONS[effectType];
  if (!definition) return { newEffects: targetEffects, appliedEffect: null, resisted: false };

  if (sourceId !== PLAYER_ID && !definition.isBuff && purificationChance > 0) {
    if (Math.random() < purificationChance) {
      return { newEffects: targetEffects, appliedEffect: null, resisted: true }; 
    }
  }

  let finalDuration = durationInTicks;
  if (sourceId !== PLAYER_ID && !definition.isBuff && debuffDurationReduction > 0) {
    finalDuration = Math.max(1, Math.round(durationInTicks * (1 - debuffDurationReduction)));
  }

  const existingEffectIndex = targetEffects.findIndex(eff => eff.type === effectType && eff.sourceId === sourceId);

  let appliedEffect: StatusEffectInstance;
  const newEffects = [...targetEffects];

  if (existingEffectIndex !== -1) { 
    appliedEffect = {
        ...newEffects[existingEffectIndex],
        durationTicks: Math.max(newEffects[existingEffectIndex].durationTicks, finalDuration), 
        initialDuration: finalDuration, 
        potency: potency, 
        description: definition.description(potency, finalDuration), 
    };
    newEffects[existingEffectIndex] = appliedEffect;
  } else { 
    const effectDescription = definition.description(potency, finalDuration);
    appliedEffect = {
      id: generateStatusEffectInstanceId(),
      type: effectType,
      name: definition.name,
      icon: definition.icon,
      description: effectDescription,
      durationTicks: finalDuration,
      initialDuration: finalDuration,
      potency,
      sourceId,
    };
    newEffects.push(appliedEffect);
  }
  return { newEffects, appliedEffect, resisted: false };
};

export const processStatusEffects = (
  target: Player | ActiveMonster,
  targetIdString: string, 
  addBattleMessage: (text: string, type: BattleMessage['type']) => void,
  debuffDurationReduction: number = 0, 
  purificationChanceOnApply: number = 0 
): { updatedTarget: Player | ActiveMonster, damageDealt: number, wasStunned: boolean, expiredEffects: StatusEffectInstance[], resistedEffectName?: string } => {
  let damageDealt = 0;
  let wasStunned = false;
  const expiredEffects: StatusEffectInstance[] = [];
  
  if (!target.activeStatusEffects) { 
    target.activeStatusEffects = [];
  }

  const remainingEffects = target.activeStatusEffects.filter(effect => {
    if (effect.type === StatusEffectType.STUN) {
      wasStunned = true; 
    }

    if (effect.type === StatusEffectType.POISON || effect.type === StatusEffectType.BLEED) {
      const dotDamage = effect.potency;
      if ('hp' in target) { 
        target.hp = Math.max(0, target.hp - dotDamage);
      } else if ('currentHp' in target) { 
        target.currentHp = Math.max(0, target.currentHp - dotDamage);
      }
      damageDealt += dotDamage;
      addBattleMessage(`${targetIdString}이(가) ${effect.name} 피해로 ${dotDamage} 데미지를 입었습니다.`, 'effect_damage');
    }
    
    effect.durationTicks -= 1;
    if (effect.durationTicks <= 0) {
      expiredEffects.push(effect);
      addBattleMessage(`${targetIdString}의 ${effect.name} 효과가 사라졌습니다.`, 'effect_expire');
      return false; 
    }
    return true; 
  });
  
  return {
    updatedTarget: { ...target, activeStatusEffects: remainingEffects },
    damageDealt,
    wasStunned,
    expiredEffects,
  };
};

export const calculateDistance = (pos1: ThreeDPosition, pos2: ThreeDPosition): number => {
  const dx = pos1.x - pos2.x;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dz * dz); 
};

export const moveTowards = (currentPos: ThreeDPosition, targetPos: ThreeDPosition, speed: number): ThreeDPosition => {
  const dx = targetPos.x - currentPos.x;
  const dy = targetPos.y - currentPos.y; 
  const dz = targetPos.z - currentPos.z;
  const planarDistance = Math.sqrt(dx * dx + dz * dz);

  if (planarDistance <= speed) {
    return { x: targetPos.x, y: targetPos.y, z: targetPos.z }; 
  }

  const newX = currentPos.x + (dx / planarDistance) * speed;
  const newZ = currentPos.z + (dz / planarDistance) * speed;
  
  let newY = currentPos.y;
  if (Math.abs(targetPos.y - currentPos.y) > 0.1) { 
      const ySpeed = speed * 0.5; 
      if (Math.abs(targetPos.y - currentPos.y) <= ySpeed) {
          newY = targetPos.y;
      } else {
          newY = currentPos.y + Math.sign(targetPos.y - currentPos.y) * ySpeed;
      }
  }

  return {
    x: newX,
    y: newY, 
    z: newZ,
  };
};