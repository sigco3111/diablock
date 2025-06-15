
import React, { useState } from 'react';
import { Item, Player, Rarity, StatModifier } from '../types.ts';
import Button from './ui/Button.tsx';
import { getRarityColorClass } from '../utils/gameUtils.ts';
import { INVENTORY_SLOTS, SELL_PRICE_MODIFIER, SHOP_REFRESH_COST, GAME_CONFIG } from '../diablockConstants.ts'; // RENAMED

interface ShopPanelProps {
  player: Player;
  shopInventory: Item[];
  playerInventory: Array<Item | null>;
  onBuyItem: (item: Item, shopItemIndex: number) => void;
  onSellItem: (item: Item, inventoryIndex: number) => void;
  onRefreshStock: (isFreeRefresh?: boolean) => boolean;
}

interface ShopItemDisplayProps {
  item: Item;
  onAction: () => void;
  actionLabel: string;
  price?: number; // Buy price or sell price
  canAfford?: boolean; // For buying
  levelRequirementMet?: boolean;
  isBeingSold?: boolean; // True if this card represents an item the player is selling
}

const ShopItemCard: React.FC<ShopItemDisplayProps> = ({ 
    item, 
    onAction, 
    actionLabel, 
    price, 
    canAfford = true, 
    levelRequirementMet = true,
    isBeingSold = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const rarityColorClass = getRarityColorClass(item.rarity as Rarity);
  const disabled = !isBeingSold && (!canAfford || !levelRequirementMet);
  const displayName = `${item.name}${item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}`;

  const getEnhancedModifierValue = (modifier: StatModifier, enhancementLevel: number): number => {
    const enhancementBonus = 1 + (enhancementLevel * GAME_CONFIG.ITEM_ENHANCEMENT_CONFIG.bonusPerLevel);
    return modifier.value * enhancementBonus;
  };

  return (
    <div 
      className={`relative p-2 border ${rarityColorClass} ${disabled ? 'border-gray-500 opacity-60' : 'border-gray-600'} rounded-md hover:bg-gray-700 flex flex-col text-center transition-all `}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex-grow flex flex-col items-center justify-center">
        <span className="text-3xl pixelated">{item.icon}</span>
        <span className={`text-xs truncate w-full mt-1 ${rarityColorClass}`} title={displayName}>{displayName}</span>
      </div>
      
      {price !== undefined && <p className="text-xs diablo-gold mt-1">{isBeingSold ? "판매가" : "가격"}: {price} G</p>}
      {!levelRequirementMet && <p className="text-xs text-red-500">레벨 {item.levelRequirement} 필요</p>}
      
      <Button 
        onClick={onAction} 
        disabled={disabled} 
        size="sm" 
        variant={disabled ? "secondary" : "primary"} 
        className="mt-2 w-full text-xs py-1"
      >
        {actionLabel}
      </Button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-60 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 text-xs text-left">
          <h4 className={`font-bold ${rarityColorClass} mb-1`}>{displayName}</h4>
          <p className="text-gray-400 capitalize">{item.rarity} {item.type}</p>
          {item.levelRequirement && <p className={`text-xs ${levelRequirementMet ? 'text-gray-400' : 'text-red-500'}`}>요구 레벨: {item.levelRequirement}</p>}
          <ul className="my-1 space-y-0.5">
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
          <p className="text-yellow-500">기본 가치: {item.goldValue} 골드</p>
          {price !== undefined && <p className="text-yellow-300 font-semibold">{isBeingSold ? "판매 가격" : "구매 가격"}: {price} 골드</p>}
           {!isBeingSold && !canAfford && <p className="text-red-400 mt-1">골드가 부족합니다.</p>}
           {!isBeingSold && !levelRequirementMet && <p className="text-red-400 mt-1">레벨이 낮습니다.</p>}
        </div>
      )}
    </div>
  );
};

const ShopPanel: React.FC<ShopPanelProps> = ({ player, shopInventory, playerInventory, onBuyItem, onSellItem, onRefreshStock }) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  const hasEmptyInventorySlot = playerInventory.some(slot => slot === null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-lg text-yellow-400 font-semibold">플레이어 골드: {player.gold} G</p>
        {activeTab === 'buy' && (
          <Button 
            onClick={() => onRefreshStock()} 
            size="sm"
            disabled={player.gold < SHOP_REFRESH_COST && SHOP_REFRESH_COST > 0}
            title={SHOP_REFRESH_COST > 0 ? `비용: ${SHOP_REFRESH_COST} 골드` : "무료 새로고침"}
          >
            목록 새로고침 {SHOP_REFRESH_COST > 0 ? `(${SHOP_REFRESH_COST}G)` : ''}
          </Button>
        )}
      </div>

      <div className="flex border-b border-gray-700">
        <button 
          className={`px-4 py-2 -mb-px text-sm font-medium ${activeTab === 'buy' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('buy')}
          aria-current={activeTab === 'buy' ? 'page' : undefined}
        >
          구매
        </button>
        <button 
          className={`px-4 py-2 -mb-px text-sm font-medium ${activeTab === 'sell' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('sell')}
          aria-current={activeTab === 'sell' ? 'page' : undefined}
        >
          판매
        </button>
      </div>

      {activeTab === 'buy' && (
        <div>
          <h3 className="text-md font-semibold mb-3 text-gray-300">구매 가능한 아이템 ({shopInventory.length})</h3>
          {shopInventory.length === 0 && <p className="text-gray-500">상점에 판매 중인 아이템이 없습니다.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {shopInventory.map((item, index) => (
              <ShopItemCard
                key={item.id}
                item={item}
                onAction={() => onBuyItem(item, index)}
                actionLabel="구매"
                price={item.goldValue}
                canAfford={player.gold >= item.goldValue && hasEmptyInventorySlot}
                levelRequirementMet={player.level >= (item.levelRequirement || 0)}
              />
            ))}
          </div>
           {!hasEmptyInventorySlot && shopInventory.length > 0 && (
             <p className="text-red-500 text-sm mt-4 text-center">소지품이 가득 차 더 이상 아이템을 구매할 수 없습니다.</p>
           )}
        </div>
      )}

      {activeTab === 'sell' && (
        <div>
          <h3 className="text-md font-semibold mb-3 text-gray-300">판매할 아이템 선택 (소지품: {playerInventory.filter(i=>i!==null).length}/{INVENTORY_SLOTS})</h3>
          {playerInventory.every(i => i === null) && <p className="text-gray-500">판매할 아이템이 소지품에 없습니다.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {playerInventory.map((item, index) => {
              if (!item) {
                return <div key={`empty-${index}`} className="border border-dashed border-gray-700 rounded-md aspect-square"></div>;
              }
              const sellPrice = Math.floor(item.goldValue * SELL_PRICE_MODIFIER);
              return (
                <ShopItemCard
                  key={item.id}
                  item={item}
                  onAction={() => onSellItem(item, index)}
                  actionLabel="판매"
                  price={sellPrice}
                  isBeingSold={true}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPanel;