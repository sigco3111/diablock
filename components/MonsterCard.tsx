
import React from 'react';
import { ActiveMonster } from '../types.ts';
import ProgressBar from './ui/ProgressBar.tsx';

interface MonsterCardProps {
  monster: ActiveMonster;
}

const MonsterCard: React.FC<MonsterCardProps> = ({ monster }) => {
  const isBoss = monster.isBoss || false;
  const namePrefix = isBoss ? '👑 [보스] ' : '';
  const borderColor = isBoss ? 'border-yellow-500' : 'border-gray-700';
  const titleColor = isBoss ? 'text-yellow-300' : 'text-white';

  // Adjust padding based on sizeClass to make larger monsters feel more substantial
  let cardPadding = 'p-3'; // Default padding
  if (monster.sizeClass) {
    const widthMatch = monster.sizeClass.match(/w-(\d+)/);
    if (widthMatch && widthMatch[1]) {
      const size = parseInt(widthMatch[1], 10);
      if (size >= 20) cardPadding = 'p-4'; // Larger padding for very large monsters
      else if (size >= 16) cardPadding = 'p-3.5';
    }
  }


  return (
    <div className={`${cardPadding} border-2 ${borderColor} rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 ${monster.color} relative overflow-hidden`}>
      <div className={`absolute inset-0 ${monster.color} opacity-30`}></div>
      <div className="relative z-10">
        <h3 className={`text-sm font-bold ${titleColor} text-shadow-sm-dark truncate`} title={monster.name}>
          {namePrefix}{monster.name}
        </h3>
        <ProgressBar value={monster.currentHp} maxValue={monster.baseHp} color="bg-red-500" />
        <div className="text-xs text-gray-200 mt-1">
          <span>ATK: {monster.baseAttack}</span> | <span>DEF: {monster.baseDefense}</span>
        </div>
        {monster.activeStatusEffects && monster.activeStatusEffects.length > 0 && (
          <div className="flex items-center justify-start space-x-1 mt-1.5">
            {monster.activeStatusEffects.map(effect => (
              <span 
                key={effect.id} 
                title={`${effect.name} (${effect.durationTicks}턴 남음)`} 
                className="text-xs pixelated bg-black bg-opacity-40 px-1 rounded"
              >
                {effect.icon}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonsterCard;
