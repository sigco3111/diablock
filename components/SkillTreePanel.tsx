
import React from 'react';
import { PlayerSkill, Player, SkillDefinition } from '../types.ts';
import Button from './ui/Button.tsx';

interface SkillTreePanelProps {
  player: Player;
  skills: PlayerSkill[]; // This is PlayerSkill[], which includes currentLevel
  allSkillDefinitions: SkillDefinition[]; // Pass all definitions for finding children
  onLearnSkill: (skillId: string) => void;
}

interface SkillNodeProps {
  skill: PlayerSkill;
  player: Player;
  allSkillsPlayer: PlayerSkill[]; // All skills with current levels
  allSkillDefinitions: SkillDefinition[];
  onLearnSkill: (skillId: string) => void;
  depth: number;
}

const SkillNode: React.FC<SkillNodeProps> = ({ skill, player, allSkillsPlayer, allSkillDefinitions, onLearnSkill, depth }) => {
  const cost = skill.cost(skill.currentLevel);
  const canAfford = player.skillPoints >= cost;
  const isMaxLevel = skill.currentLevel >= skill.maxLevel;
  
  let prerequisiteMet = true;
  let prereqMessage = "";

  if (skill.prerequisites && skill.prerequisites.length > 0) {
    prerequisiteMet = skill.prerequisites.every(prereqId => {
      const prereqPlayerSkill = allSkillsPlayer.find(s => s.id === prereqId);
      const met = !!prereqPlayerSkill && prereqPlayerSkill.currentLevel > 0;
      if (!met && !prereqMessage) {
        const prereqDef = allSkillDefinitions.find(sd => sd.id === prereqId);
        prereqMessage = `요구: ${prereqDef?.name || prereqId} (레벨 1 이상)`;
      }
      return met;
    });
  }

  const canLearn = canAfford && !isMaxLevel && prerequisiteMet;

  // Find children of this skill
  const children = allSkillDefinitions
    .filter(sd => sd.prerequisites?.includes(skill.id))
    .map(childDef => allSkillsPlayer.find(ps => ps.id === childDef.id))
    .filter(Boolean) as PlayerSkill[];

  return (
    <div style={{ marginLeft: `${depth * 20}px` }} className={`mb-3 ${depth > 0 ? 'pt-2 border-t border-gray-700/50' : ''}`}>
      <div className={`p-3 bg-gray-700 border border-gray-600 rounded-md shadow ${!prerequisiteMet && skill.currentLevel === 0 ? 'opacity-60' : ''}`}>
        <div className="flex justify-between items-start">
          <div>
            <h4 className={`text-md font-semibold ${!prerequisiteMet && skill.currentLevel === 0 ? 'text-gray-500' : 'text-gray-100'}`}>
              {skill.icon} {skill.name} <span className="text-sm text-yellow-400">(레벨 {skill.currentLevel}/{skill.maxLevel})</span>
            </h4>
            <p className="text-xs text-gray-300 mt-1">{skill.description(skill.currentLevel > 0 ? skill.currentLevel : 1)}</p>
            {skill.currentLevel > 0 && skill.currentLevel < skill.maxLevel && (
               <p className="text-xs text-green-400 mt-0.5">다음: {skill.description(skill.currentLevel + 1)}</p>
            )}
            {!prerequisiteMet && skill.currentLevel === 0 && <p className="text-xs text-red-400 mt-0.5">{prereqMessage}</p>}
          </div>
          {!isMaxLevel && (prerequisiteMet || skill.currentLevel > 0) && ( // Show button if prereqs met OR if already invested points
            <Button 
              onClick={() => onLearnSkill(skill.id)} 
              disabled={!canLearn}
              size="sm"
              variant={canLearn ? 'primary' : 'secondary'}
              className="mt-1"
            >
              업그레이드 ({cost} SP)
            </Button>
          )}
           {isMaxLevel && <span className="text-xs text-green-500 font-semibold p-2">최대</span>}
        </div>
      </div>
      {children.length > 0 && skill.currentLevel > 0 && ( // Only show children if parent has at least 1 point
        <div className={`mt-2 pl-3 border-l-2 ${skill.currentLevel > 0 ? 'border-yellow-500/70' : 'border-gray-600'}`}>
          {children.map(childSkill => (
            <SkillNode
              key={childSkill.id}
              skill={childSkill}
              player={player}
              allSkillsPlayer={allSkillsPlayer}
              allSkillDefinitions={allSkillDefinitions}
              onLearnSkill={onLearnSkill}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};


const SkillTreePanel: React.FC<SkillTreePanelProps> = ({ player, skills, allSkillDefinitions, onLearnSkill }) => {
  // Identify root skills (no prerequisites or prerequisites that are not in the skill list - should not happen with current setup)
  const rootSkills = skills.filter(skill => {
    const definition = allSkillDefinitions.find(sd => sd.id === skill.id);
    return !definition?.prerequisites || definition.prerequisites.length === 0;
  });

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 diablo-gold">기술 트리</h3>
      <p className="text-sm text-gray-400 mb-4">사용 가능 기술 포인트: <span className="font-bold diablo-gold">{player.skillPoints}</span></p>
      
      {skills.length === 0 && <p className="text-gray-500">사용 가능한 기술이 없습니다.</p>}
      <div className="space-y-3">
        {rootSkills.map(skill => (
          <SkillNode
            key={skill.id}
            skill={skill}
            player={player}
            allSkillsPlayer={skills}
            allSkillDefinitions={allSkillDefinitions}
            onLearnSkill={onLearnSkill}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

export default SkillTreePanel;
