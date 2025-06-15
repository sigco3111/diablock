
import React from 'react';
import { PersistentProgress, PermanentUpgradeConfigItem, PermanentStatsLevels } from '../types.ts';
import { PERMANENT_UPGRADES_SETTINGS } from '../diablockConstants.ts';
import Button from './ui/Button.tsx';

interface AltarOfLegacyPanelProps {
  persistentProgress: PersistentProgress;
  onUpgradeStat: (statKey: keyof PermanentStatsLevels) => void;
  onClose: () => void;
}

const AltarOfLegacyPanel: React.FC<AltarOfLegacyPanelProps> = ({ persistentProgress, onUpgradeStat, onClose }) => {
  
  const calculateTotalBonus = (statKey: keyof PermanentStatsLevels, currentLevel: number): number => {
    const config = PERMANENT_UPGRADES_SETTINGS.find(s => s.key === statKey);
    if (!config) return 0;
    return config.bonusPerLevel * currentLevel;
  };

  return (
    <div className="p-4 text-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold diablo-red text-shadow-sm-dark">유산의 제단</h3>
        <p className="text-lg text-yellow-400 font-semibold">
          영웅의 정수: <span className="text-xl">{persistentProgress.essence}</span> ✨
        </p>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {PERMANENT_UPGRADES_SETTINGS.map((upgradeConfig) => {
          const currentLevel = persistentProgress.permanentStatsLevels[upgradeConfig.key];
          const nextLevel = currentLevel + 1;
          const cost = upgradeConfig.baseCost + currentLevel * upgradeConfig.costIncreasePerLevel;
          const canAfford = persistentProgress.essence >= cost;
          const isMaxLevel = currentLevel >= upgradeConfig.maxUpgradeLevel;
          
          // For description, show the bonus the *next* level would give
          const nextTotalBonusIfUpgraded = calculateTotalBonus(upgradeConfig.key, nextLevel);

          return (
            <div key={upgradeConfig.key} className="bg-gray-700/60 p-4 rounded-lg border border-gray-600 shadow-md flex items-center justify-between">
              <div>
                <h4 className="text-md font-semibold text-gray-100 flex items-center">
                  <span className="text-2xl mr-2 pixelated">{upgradeConfig.icon}</span>
                  {upgradeConfig.name} 
                  <span className="text-sm text-yellow-400 ml-2">(레벨 {currentLevel}/{upgradeConfig.maxUpgradeLevel})</span>
                </h4>
                <p className="text-xs text-gray-300 mt-1">
                  {/* Pass bonus for *next* level if not maxed, otherwise show current max bonus */}
                  {upgradeConfig.description(
                    upgradeConfig.bonusPerLevel, 
                    currentLevel, 
                    isMaxLevel ? calculateTotalBonus(upgradeConfig.key, currentLevel) : nextTotalBonusIfUpgraded
                  )}
                </p>
                 {isMaxLevel && <p className="text-xs text-green-400 mt-1">최대 레벨 도달!</p>}
              </div>
              {!isMaxLevel && (
                <div className="text-right flex-shrink-0 ml-4">
                  <Button
                    onClick={() => onUpgradeStat(upgradeConfig.key)}
                    disabled={!canAfford || isMaxLevel}
                    size="sm"
                    variant={canAfford && !isMaxLevel ? 'primary' : 'secondary'}
                  >
                    강화 (비용: {cost} ✨)
                  </Button>
                  {!canAfford && !isMaxLevel && <p className="text-xs text-red-500 mt-1">정수 부족</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <Button onClick={onClose} variant="secondary" size="md">
          닫기 및 게임 시작
        </Button>
      </div>
    </div>
  );
};

export default AltarOfLegacyPanel;