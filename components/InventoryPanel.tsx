
import React, { useState } from 'react';
import { Item, EquippedItems, ItemType, Player, Rarity, StatModifier } from '../types.ts';
import Button from './ui/Button.tsx';
import { getRarityColorClass } from '../utils/gameUtils.ts';
import { SLOT_ICON_MAP, GAME_CONFIG } from '../diablockConstants.ts'; 

interface InventoryPanelProps {
  player: Player;
  inventory: Array<Item | null>;
  equippedItems: EquippedItems;
  onEquipItem: (item: Item, inventoryIndex: number) => void;
  onUnequipItem: (itemType: ItemType) => void;
}

const ItemCard: React.FC<{ 
    item: Item; 
    onClick: () => void; 
    isEquippedSlot?: boolean;
    canInteract?: boolean; 
}> = ({ item, onClick, isEquippedSlot = false, canInteract = true }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const rarityColorClass = getRarityColorClass(item.rarity as Rarity); 
  const displayName = `${item.name}${item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}`;

  const getEnhancedModifierValue = (modifier: StatModifier, enhancementLevel: number): number => {
    const enhancementBonus = 1 + (enhancementLevel * GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG.bonusPerLevel);
    return modifier.value * enhancementBonus;
  };

  return (
    <div 
        className={`relative p-2 border ${rarityColorClass} ${item.levelRequirement && !canInteract ? 'border-red-500 opacity-60' : 'border-gray-600'} rounded-md cursor-pointer hover:bg-gray-700 aspect-square flex flex-col items-center justify-center text-center transition-all w-full h-full`}
        onClick={canInteract ? onClick : undefined}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-2xl pixelated">{item.icon}</span>
      <span className="text-xs truncate w-full mt-1" title={displayName}>{displayName}</span>
      {!canInteract && item.levelRequirement && (
           <div className="absolute top-0 left-0 bg-red-600 text-white text-xs px-1 rounded-br-md">
             레벨 {item.levelRequirement}
           </div>
      )}

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 text-xs text-left">
          <h4 className={`font-bold ${rarityColorClass} mb-1`}>{displayName}</h4>
          <p className="text-gray-400 capitalize">{item.rarity} {item.type}</p>
          {item.levelRequirement && <p className="text-yellow-400">요구 레벨: {item.levelRequirement}</p>}
          <ul className="my-1">
            {item.modifiers.map((mod, i) => {
              const enhancedValue = getEnhancedModifierValue(mod, item.enhancementLevel);
              return (
                <li key={i} className="text-green-400">
                  +{enhancedValue.toFixed(mod.type === 'percent' ? 2 : (enhancedValue < 1 && enhancedValue > 0 ? 2 : 0))}{mod.type === 'percent' ? '%' : ''} {mod.stat}
                  {item.enhancementLevel > 0 && <span className="text-xs text-purple-400 ml-1">(기본: {mod.value.toFixed(mod.type === 'percent' ? 2 : 0)}{mod.type === 'percent' ? '%' : ''})</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-yellow-500">가치: {item.goldValue} 골드</p>
          {isEquippedSlot && <p className="text-gray-500 mt-1">클릭하여 해제</p>}
          {!isEquippedSlot && canInteract && <p className="text-gray-500 mt-1">클릭하여 장착</p>}
           {!isEquippedSlot && !canInteract && <p className="text-red-500 mt-1">레벨 부족</p>}
        </div>
      )}
    </div>
  );
};

const EquipmentSlot: React.FC<{
  itemType: ItemType; 
  item: Item | undefined;
  onUnequip: (itemType: ItemType) => void;
  playerLevel: number;
}> = ({ itemType, item, onUnequip, playerLevel }) => {
  return (
    <div className="h-20 w-20 bg-gray-700 border border-gray-600 rounded-md flex items-center justify-center relative">
      <span className="absolute top-1 left-1 text-xs text-gray-500">{itemType}</span>
      {item ? (
        <ItemCard item={item} onClick={() => onUnequip(itemType)} isEquippedSlot={true} canInteract={true} />
      ) : (
        <span className="text-4xl text-gray-500 pixelated">{SLOT_ICON_MAP[itemType as keyof typeof SLOT_ICON_MAP] || '?'}</span>
      )}
    </div>
  );
};


const InventoryPanel: React.FC<InventoryPanelProps> = ({ player, inventory, equippedItems, onEquipItem, onUnequipItem }) => {
  
  const equipmentSlots: ItemType[] = [
    ItemType.ARMOR_HEAD, ItemType.AMULET, ItemType.ARMOR_CHEST, 
    ItemType.ARMOR_HANDS, ItemType.WEAPON, ItemType.RING,
    ItemType.ARMOR_LEGS, ItemType.ARMOR_FEET
  ];


  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 diablo-gold">장착 아이템</h3>
        <div className="grid grid-cols-3 gap-2 mx-auto max-w-xs">
          {equipmentSlots.map(slotType => (
            <EquipmentSlot 
              key={slotType}
              itemType={slotType} 
              item={equippedItems[slotType]}
              onUnequip={onUnequipItem}
              playerLevel={player.level}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 diablo-gold">소지품 ({inventory.filter(i => i !== null).length}/{inventory.length})</h3>
        <p className="text-sm text-gray-400 mb-2">골드: {player.gold}</p>
        <p className="text-sm text-purple-400 mb-2">강화석: {player.enhancementStones}개</p>
        {inventory.every(i => i === null) && <p className="text-gray-500">소지품이 비어있습니다.</p>}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {inventory.map((item, index) => (
            <div key={index} className="h-20 w-full bg-gray-700 border border-gray-600 rounded-md flex items-center justify-center">
              {item ? (
                <ItemCard 
                  item={item}
                  onClick={() => onEquipItem(item, index)}
                  isEquippedSlot={false}
                  canInteract={player.level >= (item.levelRequirement || 0)}
                />
              ) : (
                <div className="w-full h-full" /> 
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryPanel;