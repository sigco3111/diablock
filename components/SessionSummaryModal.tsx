
import React from 'react';
import { SessionStats } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionStats: SessionStats;
}

const formatPlayTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let timeString = "";
  if (h > 0) timeString += `${h}시간 `;
  if (m > 0 || h > 0) timeString += `${m}분 `; // Show minutes if hours are present or minutes > 0
  timeString += `${s}초`;
  return timeString.trim();
};

const StatRow: React.FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => (
  <div className="flex justify-between py-1.5 border-b border-gray-700/50 last:border-b-0">
    <span className="text-gray-300">{label}:</span>
    <span className="text-gray-100 font-medium">{value}{unit && ` ${unit}`}</span>
  </div>
);

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ isOpen, onClose, sessionStats }) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="세션 요약" size="md">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          <StatRow label="최고 도달 웨이브" value={sessionStats.highestWaveReachedThisSession} />
          <StatRow label="플레이 시간" value={formatPlayTime(sessionStats.playTime)} />
          <StatRow label="처치한 몬스터" value={sessionStats.monstersKilled} unit="마리" />
          <StatRow label="처치한 보스" value={sessionStats.bossesDefeated} unit="마리" />
          <StatRow label="획득한 골드" value={sessionStats.goldEarned} unit="G" />
          <StatRow label="획득한 경험치" value={sessionStats.experienceGained} unit="XP" />
          <StatRow label="획득한 강화석" value={sessionStats.enhancementStonesAcquired} unit="개" />
          <StatRow label="가한 총 피해량" value={sessionStats.damageDealt.toLocaleString()} />
          <StatRow label="받은 총 피해량" value={sessionStats.damageTaken.toLocaleString()} />
          <StatRow label="획득한 아이템" value={sessionStats.itemsLooted} unit="개" />
          <StatRow label="강화한 아이템" value={sessionStats.itemsEnhanced} unit="회" />
          <StatRow label="습득한 스킬 레벨" value={sessionStats.skillsLearned} unit="회" />
        </div>
      </div>
      <div className="mt-6 text-center">
        <Button onClick={onClose} variant="primary" size="md" className="w-full">
          다음으로
        </Button>
      </div>
    </Modal>
  );
};

export default SessionSummaryModal;
