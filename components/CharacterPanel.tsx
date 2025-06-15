
import React from 'react';
import { Player, DerivedPlayerStats } from '../types.ts';

interface CharacterPanelProps {
  player: Player; // Base player data
  derivedStats: DerivedPlayerStats; // Stats including equipment, skills, and status effects
}

const StatItem: React.FC<{label: string, value: string | number, unit?: string, highlight?: boolean}> = ({ label, value, unit, highlight = false }) => (
    <div className="flex justify-between py-1.5 border-b border-gray-700 last:border-b-0">
        <span className="text-gray-400">{label}:</span>
        <span className={`${highlight ? 'text-yellow-400 font-semibold' : 'text-gray-200'}`}>{value}{unit}</span>
    </div>
);

const CharacterPanel: React.FC<CharacterPanelProps> = ({ player, derivedStats }) => {
  return (
    <div className="p-1">
      <h3 className="text-lg font-semibold mb-3 diablo-gold">캐릭터 시트</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {/* Column 1 */}
        <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600">
            <h4 className="font-semibold text-gray-100 mb-2 text-center">핵심 능력치</h4>
            <StatItem label="레벨" value={player.level} highlight />
            <StatItem label="경험치" value={`${player.experience} / ${player.experienceToNextLevel}`} />
            <StatItem label="체력" value={`${player.hp.toFixed(0)} / ${derivedStats.maxHp.toFixed(0)}`} />
            <StatItem label="공격력" value={derivedStats.attack.toFixed(0)} />
            <StatItem label="방어력" value={derivedStats.defense.toFixed(0)} />
        </div>

        {/* Column 2 */}
        <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600">
            <h4 className="font-semibold text-gray-100 mb-2 text-center">전투 능력치</h4>
            <StatItem label="치명타 확률" value={(derivedStats.critChance * 100).toFixed(1)} unit="%" />
            <StatItem label="치명타 피해" value={(derivedStats.critDamage * 100).toFixed(0)} unit="%" />
            <StatItem label="체력 재생" value={derivedStats.healthRegen.toFixed(1)} unit="/초" />
            <StatItem label="골드" value={player.gold} highlight />
            <StatItem label="기술 포인트" value={player.skillPoints} highlight />
        </div>
      </div>
      
      {/* Display active status effects on character sheet if desired */}
      {derivedStats.activeStatusEffects && derivedStats.activeStatusEffects.length > 0 && (
        <div className="mt-4 bg-gray-700/50 p-3 rounded-md border border-gray-600">
          <h4 className="font-semibold text-gray-100 mb-2 text-center">활성 효과</h4>
          {derivedStats.activeStatusEffects.map(effect => (
            <div key={effect.id} className="text-sm text-gray-300">
              <span className="pixelated">{effect.icon}</span> {effect.name}: {effect.description} ({effect.durationTicks}턴 남음)
            </div>
          ))}
        </div>
      )}
      
       <p className="text-xs text-gray-500 mt-4 text-center">표시된 능력치에는 장비 및 기술 보너스가 포함됩니다.</p>
    </div>
  );
};

export default CharacterPanel;
