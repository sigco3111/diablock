
import React, { useState, useMemo } from 'react';
import { Item, Player, EquippedItems, ItemType, Rarity, StatModifier } from '../types.ts';
import Button from './ui/Button.tsx';
import { getRarityColorClass } from '../utils/gameUtils.ts';
import { GAME_CONFIG, SLOT_ICON_MAP } from '../diablockConstants.ts';

interface EnhancementPanelProps {
  player: Player;
  inventory: Array<Item | null>;
  equippedItems: EquippedItems;
  onEnhanceItem: (itemId: string, itemSlotType: ItemType | number, isEquipped: boolean) => void;
}

interface SelectedItemDetails {
  item: Item;
  slot: ItemType | number; // ItemType for equipped, number (index) for inventory
  isEquipped: boolean;
}

const EnhancementPanel: React.FC<EnhancementPanelProps> = ({ player, inventory, equippedItems, onEnhanceItem }) => {
  const [activeTab, setActiveTab] = useState<'equipped' | 'inventory'>('equipped');
  const [selectedItemDetails, setSelectedItemDetails] = useState<SelectedItemDetails | null>(null);

  const config = GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG;

  const calculateCosts = (item: Item) => {
    if (!item) return { goldCost: 0, stoneCost: 0, maxLevelReached: true };
    const maxLevel = config.maxLevelByRarity[item.rarity] || 0;
    if (item.enhancementLevel >= maxLevel) {
      return { goldCost: 0, stoneCost: 0, maxLevelReached: true };
    }
    const itemEffectiveLevel = item.levelRequirement || player.level;
    const goldCost = Math.floor(config.baseGoldCost * Math.pow(config.goldCostIncreaseFactorPerLevel, item.enhancementLevel) * (1 + itemEffectiveLevel * config.itemLevelMultiplier));
    const stoneCost = Math.ceil(config.baseStoneCost * Math.pow(config.stoneCostIncreaseFactorPerLevel, item.enhancementLevel) * (1 + itemEffectiveLevel * config.itemLevelMultiplier));
    return { goldCost, stoneCost, maxLevelReached: false };
  };

  const getEnhancedModifierValue = (modifier: StatModifier, enhancementLevel: number): number => {
    const enhancementBonus = 1 + (enhancementLevel * config.bonusPerLevel);
    return modifier.value * enhancementBonus;
  };
  
  const selectedItemData = useMemo(() => {
    if (!selectedItemDetails) return null;
    const { item } = selectedItemDetails;
    const { goldCost, stoneCost, maxLevelReached } = calculateCosts(item);
    const canAfford = player.gold >= goldCost && player.enhancementStones >= stoneCost;
    
    return {
      ...selectedItemDetails,
      enhancementCosts: { goldCost, stoneCost },
      maxLevelReached,
      canAfford,
      canEnhance: !maxLevelReached && canAfford,
    };
  }, [selectedItemDetails, player.gold, player.enhancementStones, config]);


  const handleItemSelect = (item: Item, slot: ItemType | number, isEquipped: boolean) => {
    setSelectedItemDetails({ item, slot, isEquipped });
  };
  
  const handleEnhance = () => {
    if (selectedItemData && selectedItemData.canEnhance) {
      onEnhanceItem(selectedItemData.item.id, selectedItemData.slot, selectedItemData.isEquipped);
      // After enhancement, the item reference might change if state updates are immutable.
      // Re-fetch or clear selection to reflect potential changes or if item is gone.
      // For simplicity, we can clear it. Or, if the parent updates the item list,
      // it should re-render and selectedItemDetails might pick up new item instance.
      // Let's find the updated item.
      let updatedItem: Item | null | undefined = null;
      if (selectedItemData.isEquipped) {
        updatedItem = equippedItems[selectedItemData.slot as ItemType];
      } else {
        updatedItem = inventory[selectedItemData.slot as number];
      }
      if (updatedItem && updatedItem.id === selectedItemData.item.id) {
        setSelectedItemDetails({ item: updatedItem, slot: selectedItemData.slot, isEquipped: selectedItemData.isEquipped });
      } else {
        setSelectedItemDetails(null); // Item might have changed ID or slot, or removed.
      }
    }
  };

  const renderItemSquare = (item: Item | null, slot: ItemType | number, isEquipped: boolean) => {
    if (!item) {
      return <div className="h-24 w-full bg-gray-700/50 border border-dashed border-gray-600 rounded-md" />;
    }
    const rarityColorClass = getRarityColorClass(item.rarity as Rarity);
    const isSelected = selectedItemDetails?.item.id === item.id;
    const displayName = `${item.name}${item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}`;

    return (
      <button
        key={item.id}
        onClick={() => handleItemSelect(item, slot, isEquipped)}
        className={`relative p-2 border ${isSelected ? 'ring-2 ring-red-500' : rarityColorClass} border-gray-600 rounded-md hover:bg-gray-700 aspect-square flex flex-col items-center justify-center text-center transition-all w-full h-24`}
        title={displayName}
      >
        <span className="text-3xl pixelated">{item.icon}</span>
        <span className={`text-xs truncate w-full mt-1 ${rarityColorClass}`}>{displayName}</span>
      </button>
    );
  };
  

  return (
    <div className="flex flex-col md:flex-row gap-4 p-1 max-h-[75vh]">
      {/* Left side: Item selection */}
      <div className="md:w-3/5 space-y-4 overflow-y-auto pr-2">
        <div className="flex border-b border-gray-700">
          <button
            className={`px-4 py-2 -mb-px text-sm font-medium ${activeTab === 'equipped' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => { setActiveTab('equipped'); setSelectedItemDetails(null);}}
            aria-current={activeTab === 'equipped' ? 'page' : undefined}
          >
            장착 중인 아이템
          </button>
          <button
            className={`px-4 py-2 -mb-px text-sm font-medium ${activeTab === 'inventory' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => { setActiveTab('inventory'); setSelectedItemDetails(null); }}
            aria-current={activeTab === 'inventory' ? 'page' : undefined}
          >
            소지품
          </button>
        </div>

        {activeTab === 'equipped' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.values(ItemType).map(slotType => {
              const item = equippedItems[slotType];
              return item ? renderItemSquare(item, slotType, true) : (
                <div key={slotType} className="h-24 w-full bg-gray-700/50 border border-dashed border-gray-600 rounded-md flex items-center justify-center">
                   <span className="text-2xl text-gray-500 pixelated">{SLOT_ICON_MAP[slotType as keyof typeof SLOT_ICON_MAP] || '?'}</span>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {inventory.map((item, index) => renderItemSquare(item, index, false))}
          </div>
        )}
      </div>

      {/* Right side: Selected item details and enhancement */}
      <div className="md:w-2/5 bg-gray-700/70 p-4 rounded-lg border border-gray-600 space-y-3 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-100 border-b border-gray-600 pb-2">아이템 강화</h3>
        {!selectedItemData && <p className="text-gray-400 text-sm flex-grow flex items-center justify-center">강화할 아이템을 선택하세요.</p>}
        {selectedItemData && (
          <div className="flex-grow space-y-2 overflow-y-auto pr-1">
            <div className="flex items-center space-x-2">
              <span className="text-4xl pixelated">{selectedItemData.item.icon}</span>
              <div>
                <h4 className={`font-bold ${getRarityColorClass(selectedItemData.item.rarity as Rarity)}`}>
                    {selectedItemData.item.name} 
                    {selectedItemData.item.enhancementLevel > 0 && ` +${selectedItemData.item.enhancementLevel}`}
                </h4>
                <p className="text-xs text-gray-400 capitalize">{selectedItemData.item.rarity} {selectedItemData.item.type}</p>
              </div>
            </div>

            <div className="text-xs">
              <h5 className="font-semibold text-gray-300 mt-2 mb-1">현재 능력치:</h5>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                {selectedItemData.item.modifiers.map((mod, i) => {
                  const currentValue = getEnhancedModifierValue(mod, selectedItemData.item.enhancementLevel);
                  return <li key={`current-${i}`} className="text-green-400">{`+${currentValue.toFixed(mod.type === 'percent' ? 2 : (currentValue < 1 && currentValue > 0 ? 2:0))}${mod.type === 'percent' ? '%' : ''} ${mod.stat}`}</li>;
                })}
              </ul>
            </div>

            {!selectedItemData.maxLevelReached && (
              <>
                <div className="text-xs">
                  <h5 className="font-semibold text-gray-300 mt-2 mb-1">강화 후 예상 능력치 (+{selectedItemData.item.enhancementLevel + 1}):</h5>
                  <ul className="list-disc list-inside pl-1 space-y-0.5">
                    {selectedItemData.item.modifiers.map((mod, i) => {
                      const nextValue = getEnhancedModifierValue(mod, selectedItemData.item.enhancementLevel + 1);
                      return <li key={`next-${i}`} className="text-purple-400">{`+${nextValue.toFixed(mod.type === 'percent' ? 2 : (nextValue < 1 && nextValue > 0 ? 2:0))}${mod.type === 'percent' ? '%' : ''} ${mod.stat}`}</li>;
                    })}
                  </ul>
                </div>
                <div className="text-xs space-y-1 pt-2 border-t border-gray-600/50">
                  <p>비용:</p>
                  <p className="text-yellow-400">골드: {selectedItemData.enhancementCosts.goldCost} (보유: {player.gold})</p>
                  <p className="text-purple-400">강화석: {selectedItemData.enhancementCosts.stoneCost} (보유: {player.enhancementStones})</p>
                </div>
              </>
            )}
            {selectedItemData.maxLevelReached && <p className="text-green-500 font-semibold text-sm">최대 강화 레벨입니다.</p>}
             <div className="pt-2">
                <Button 
                    onClick={handleEnhance} 
                    disabled={!selectedItemData.canEnhance}
                    className="w-full"
                >
                    {selectedItemData.maxLevelReached ? "최대 레벨" : (selectedItemData.canAfford ? "강화하기" : "재료 부족")}
                </Button>
            </div>
          </div>
        )}
       
      </div>
    </div>
  );
};

export default EnhancementPanel;
