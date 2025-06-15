
import React from 'react';
import { ActiveMonster } from '../types.ts';
import ProgressBar from './ui/ProgressBar.tsx'; // Assuming ProgressBar can be styled for small size

interface ActiveMonstersPanelProps {
  monsters: ActiveMonster[];
}

const ActiveMonstersPanel: React.FC<ActiveMonstersPanelProps> = ({ monsters }) => {
  if (monsters.length === 0) {
    return <p className="text-center text-xs text-gray-500 pt-4">현재 필드에 몬스터가 없습니다.</p>;
  }

  return (
    <div className="space-y-2 overflow-y-auto h-full pr-1">
      {monsters.map((monster) => (
        <div 
          key={monster.instanceId} 
          className={`p-1.5 rounded border ${monster.isBoss ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-700 bg-gray-700/30'} shadow-sm`}
        >
          <div className="flex justify-between items-center mb-0.5">
            <h4 
              className={`text-xs font-semibold truncate ${monster.isBoss ? 'text-yellow-300' : 'text-gray-200'}`}
              title={monster.name}
            >
              {monster.isBoss && '👑 '}
              {monster.name}
            </h4>
            {/* Optionally display level or other small info here */}
          </div>
          <ProgressBar 
            value={monster.currentHp} 
            maxValue={monster.scaledHp} 
            color={monster.isBoss ? "bg-orange-500" : "bg-red-500"} 
            showPercentage={false} // Keep it compact
            // To make progress bar smaller, you might need to adjust its internal styling or pass size props
          />
           {monster.activeStatusEffects && monster.activeStatusEffects.length > 0 && (
            <div className="flex items-center justify-start space-x-0.5 mt-1 flex-wrap">
              {monster.activeStatusEffects.map(effect => (
                <span 
                  key={effect.id} 
                  title={`${effect.name} (${effect.durationTicks}턴)`} 
                  className="text-[9px] pixelated bg-black bg-opacity-50 px-0.5 rounded"
                >
                  {effect.icon}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ActiveMonstersPanel;
