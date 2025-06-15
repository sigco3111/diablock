

import React, { useRef, useEffect } from 'react';
import { BattleMessage } from '../types.ts';

interface BattleLogFeedProps {
  messages: BattleMessage[];
}

const BattleLogFeed: React.FC<BattleLogFeedProps> = ({ messages }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getMessageColor = (type: BattleMessage['type']): string => {
    switch (type) {
      case 'damage': return 'text-red-400';
      case 'critical': return 'text-red-500 font-bold animate-pulse'; // Adjusted color for better contrast
      case 'heal': return 'text-green-400';
      case 'loot': return 'diablo-gold';
      case 'info': return 'text-blue-400';
      case 'error': return 'text-yellow-500';
      case 'effect_damage': return 'text-purple-400'; 
      case 'effect_applied': return 'text-sky-400';    
      case 'effect_resisted': return 'text-gray-400';  
      case 'effect_expire': return 'text-gray-500';  
      case 'boss_spawn': return 'text-orange-400 font-bold'; 
      case 'boss_defeat': return 'text-yellow-300 font-bold animate-pulse'; 
      case 'shop': return 'text-teal-400';
      case 'ng_plus': return 'text-lime-400 font-bold';
      case 'skill_proc': return 'text-cyan-400'; 
      case 'permanent_upgrade': return 'text-amber-400 font-semibold';
      case 'item_enhanced': return 'text-purple-300 font-semibold';
      case 'item_enhance_fail': return 'text-orange-400';
      default: return 'text-gray-300';
    }
  };

  return (
    // Removed fixed positioning and backdrop-blur. Styles will be inherited or set by parent.
    // The parent container in App.tsx will handle bg, border, shadow, and height.
    <div className="w-full h-full flex flex-col p-2.5"> 
      <h3 className="text-sm font-semibold text-gray-200 mb-1.5 border-b border-gray-600 pb-1 flex-shrink-0">전투 기록</h3>
      <div className="flex-grow overflow-y-auto text-xs space-y-0.5 pr-1">
        {messages.map((msg) => (
          <p key={msg.id} className={`${getMessageColor(msg.type)} leading-snug`}>
            {msg.text}
          </p>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default BattleLogFeed;