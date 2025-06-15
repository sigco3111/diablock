

import React from 'react';
import { Player, DerivedPlayerStats, ActiveMonster } from '../types.ts'; 
import ProgressBar from './ui/ProgressBar.tsx';
import { AttackIcon, DefenseIcon, HealthIcon } from './ui/Icons.tsx';
import { GAME_CONFIG } from '../diablockConstants.ts';

interface PlayerHUDProps {
  player: Player; 
  derivedStats: DerivedPlayerStats; 
  currentWave: number; 
  isBossWaveActive: boolean;
  monsters: ActiveMonster[]; 
}

const StatDisplay: React.FC<{ icon: React.ReactNode, label: string, value: string | number, className?: string }> = ({ icon, label, value, className }) => (
  <div className={`flex items-center text-xs ${className}`}> 
    <span className="mr-1">{icon}</span> 
    <span className="text-gray-400 mr-1">{label}:</span> 
    <span className="font-semibold text-gray-100">{value}</span>
  </div>
);


const PlayerHUD: React.FC<PlayerHUDProps> = ({ 
    player, 
    derivedStats, 
    currentWave, 
    isBossWaveActive,
    monsters, 
}) => {
  const displayActNumber = Math.floor((currentWave - 1) / GAME_CONFIG.BOSS_WAVE_INTERVAL) + 1;
  const waveInAct = (currentWave - 1) % GAME_CONFIG.BOSS_WAVE_INTERVAL + 1;
  const waveTextPart = `액트: ${displayActNumber}-${waveInAct}`;

  const actText = isBossWaveActive 
    ? <span className="text-yellow-400 animate-pulse">!! 보스 !! - {waveTextPart}</span>
    : waveTextPart;
  
  let waveProgressTextElement: React.ReactNode = null;
  if (isBossWaveActive) {
    if (monsters.length > 0) {
      waveProgressTextElement = <span className="text-yellow-400">보스 처치 필요! ({monsters.length}마리 남음)</span>;
    }
  } else {
    waveProgressTextElement = `다음 웨이브까지: ${monsters.length}마리`;
  }

  return (
    <div className="w-full"> 
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 mb-2"> 
        <h2 className="col-span-3 text-base font-bold diablo-red text-shadow-sm-dark mb-1"> 
          플레이어 ({player.level}레벨) - {actText}
        </h2>
        
        <div className="col-span-3">
          <ProgressBar value={player.hp} maxValue={derivedStats.maxHp} color="bg-red-600" label="체력"/>
        </div>
        <div className="col-span-3">
          <ProgressBar value={player.experience} maxValue={player.experienceToNextLevel} color="bg-blue-600" label={`경험치`} showPercentage={false}/>
        </div>

        <StatDisplay icon={<AttackIcon />} label="공격력" value={derivedStats.attack.toFixed(0)} />
        <StatDisplay icon={<DefenseIcon />} label="방어력" value={derivedStats.defense.toFixed(0)} />
        <StatDisplay icon={<span>🎯</span>} label="치명%" value={`${(derivedStats.critChance * 100).toFixed(1)}%`} />
        <StatDisplay icon={<span>💥</span>} label="치피%" value={`${(derivedStats.critDamage * 100).toFixed(0)}%`} />
        <StatDisplay icon={<HealthIcon />} label="재생" value={`${derivedStats.healthRegen.toFixed(1)}/초`} />
        <StatDisplay icon={<span>💰</span>} label="골드" value={player.gold} />
        <StatDisplay icon={<span>⭐</span>} label="기술 P" value={player.skillPoints} className="diablo-gold font-bold text-shadow-sm-dark"/>
        <StatDisplay icon={<span>🔨</span>} label="강화석" value={player.enhancementStones} className="text-purple-400 font-bold text-shadow-sm-dark"/>

         {waveProgressTextElement && (
          <div className="col-span-3 text-xs text-gray-300 mt-0.5">
            {waveProgressTextElement}
          </div>
        )}
      </div>

      {derivedStats.activeStatusEffects && derivedStats.activeStatusEffects.length > 0 && (
        <div className="col-span-3 mt-1 mb-1 border-t border-gray-700/50 pt-1"> 
            <div className="flex items-center space-x-1 text-xs flex-wrap gap-y-0.5"> 
                <span className="text-gray-400 font-semibold text-[10px]">효과:</span>
                {derivedStats.activeStatusEffects.map(effect => (
                    <span 
                        key={effect.id} 
                        className="pixelated bg-gray-700/70 px-1 py-0.5 rounded text-gray-200 text-[9px]" 
                        title={`${effect.name}: ${effect.description}`}
                    >
                        {effect.icon} {effect.name.substring(0,3)} ({effect.durationTicks})
                    </span>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default PlayerHUD;