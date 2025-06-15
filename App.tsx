
import React, {useState} from 'react'; 
import useGameEngine from './hooks/useGameEngine.ts';
import PlayerHUD from './components/PlayerHUD.tsx';
import BattleLogFeed from './components/BattleLogFeed.tsx';
import InventoryPanel from './components/InventoryPanel.tsx';
import SkillTreePanel from './components/SkillTreePanel.tsx';
import CharacterPanel from './components/CharacterPanel.tsx';
import ShopPanel from './components/ShopPanel.tsx';
import AltarOfLegacyPanel from './components/AltarOfLegacyPanel.tsx'; 
import EnhancementPanel from './components/EnhancementPanel.tsx'; 
import SessionSummaryModal from './components/SessionSummaryModal.tsx'; // New
import Modal from './components/ui/Modal.tsx';
import Button from './components/ui/Button.tsx';
import { PanelType, SkillDefinition } from './types.ts'; 
import Minimap from './components/Minimap.tsx'; 
import ActiveMonstersPanel from './components/ActiveMonstersPanel.tsx';
import { SKILL_DEFINITIONS, WAVE_CLEAR_ESSENCE_MULTIPLIER } from './diablockConstants.ts';
import { CharacterIcon, InventoryIcon, ShopIcon, SkillsIcon, AutoEquipIcon, AutoLearnSkillIcon, HardResetIcon, ForgeIcon } from './components/ui/FooterIcons.tsx'; 


const App: React.FC = () => {
  const {
    player,
    derivedPlayerStats,
    persistentProgress, 
    monsters,
    inventory,
    equippedItems,
    skills,
    battleLog,
    currentWave,
    isGameOver,
    activePanel,
    attackEvents,
    skillProcEvents,
    isBossWaveActive,
    autoEquipEnabled,
    autoLearnSkillEnabled,
    shopInventory, 
    sessionStats, // New
    equipItem,
    unequipItem,
    learnSkill,
    buyItem,        
    sellItem,       
    refreshShopStock, 
    togglePanel,
    restartGame,
    hardResetGame, 
    toggleAutoEquip,
    toggleAutoLearnSkill,
    upgradePermanentStat, 
    enhanceItem, 
  } = useGameEngine();

  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [isAltarOpenViaGameOver, setIsAltarOpenViaGameOver] = useState(false);
  const [isSessionSummaryOpen, setIsSessionSummaryOpen] = useState(false); // New
  const [showMainGameOverModal, setShowMainGameOverModal] = useState(false);


  const getPanelTitle = (panel: PanelType): string => {
    switch (panel) {
      case 'inventory': return "소지품 & 장비";
      case 'skills': return "기술 트리";
      case 'character': return "캐릭터 정보";
      case 'shop': return "상점"; 
      case 'altar_of_legacy': return "유산의 제단";
      case 'enhancement': return "대장간 (장비 강화)";
      default: return "";
    }
  };

  const allSkillDefinitions: SkillDefinition[] = SKILL_DEFINITIONS as SkillDefinition[];

  const handleHardReset = () => {
    hardResetGame();
    setIsResetConfirmationOpen(false);
  }

  const openAltarFromGameOver = () => {
    setShowMainGameOverModal(false); // Close the main game over modal
    setIsAltarOpenViaGameOver(true); // Open altar modal
  };

  const closeAltarAndRestart = () => {
    setIsAltarOpenViaGameOver(false);
    restartGame(); 
  };
  
  const handleAltarClose = () => {
    if (isAltarOpenViaGameOver) {
      closeAltarAndRestart();
    } else {
      togglePanel('altar_of_legacy');
    }
  };

  const handleSessionSummaryClosed = () => {
    setIsSessionSummaryOpen(false);
    setShowMainGameOverModal(true); // Now show the original game over modal
  };
  
  // Effect to trigger session summary when game is over
  React.useEffect(() => {
    if (isGameOver && !isSessionSummaryOpen && !showMainGameOverModal && !isAltarOpenViaGameOver) {
      setIsSessionSummaryOpen(true);
    }
  }, [isGameOver, isSessionSummaryOpen, showMainGameOverModal, isAltarOpenViaGameOver]);


  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200 antialiased">
      <header className="py-3 bg-gray-800 border-b border-gray-700 shadow-md flex-shrink-0">
        <h1 className="text-3xl text-center font-bold diablo-red text-shadow-diablo">디아블록</h1>
      </header>

      <main className="flex-1 flex flex-row p-4 gap-4 overflow-hidden">
        {/* Left Column: Minimap */}
        <div className="flex-1 flex flex-col bg-gray-800/50 rounded-lg shadow-xl overflow-hidden border border-gray-700/50">
           <Minimap 
             player={player} 
             monsters={monsters} 
             attackEvents={attackEvents} 
             skillProcEvents={skillProcEvents}
           />
        </div>

        {/* Right Column: Info Stack */}
        <div className="w-80 md:w-96 flex-shrink-0 flex flex-col gap-3">
          <div className="bg-gray-800/50 p-3 rounded-lg shadow-lg border border-gray-700/50">
            <PlayerHUD 
              player={player} 
              derivedStats={derivedPlayerStats} 
              currentWave={currentWave}
              isBossWaveActive={isBossWaveActive}
              monsters={monsters} 
            />
          </div>
          <div className="bg-gray-800/50 p-3 rounded-lg shadow-lg border border-gray-700/50 flex-1 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-200 mb-2 border-b border-gray-600 pb-1.5">현재 표적</h3>
            <ActiveMonstersPanel monsters={monsters} />
          </div>
           <div className="bg-gray-800/50 p-0 rounded-lg shadow-lg border border-gray-700/50 h-56 md:h-64 flex-shrink-0">
            <BattleLogFeed messages={battleLog} />
          </div>
        </div>
      </main>

      <footer className="p-2 bg-gray-800 border-t border-gray-700 flex-shrink-0 flex items-center justify-center space-x-2 shadow-inner">
        <Button onClick={() => togglePanel('character')} variant={activePanel === 'character' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="캐릭터 정보">
          <CharacterIcon /> <span className="hidden sm:inline">캐릭터</span>
        </Button>
        <Button onClick={() => togglePanel('inventory')} variant={activePanel === 'inventory' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="소지품">
          <InventoryIcon /> <span className="hidden sm:inline">소지품</span>
        </Button>
        <Button onClick={() => togglePanel('skills')} variant={activePanel === 'skills' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="기술 트리">
          <SkillsIcon /> <span className="hidden sm:inline">기술</span>
        </Button>
         <Button onClick={() => togglePanel('shop')} variant={activePanel === 'shop' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="상점">
          <ShopIcon /> <span className="hidden sm:inline">상점</span>
        </Button>
        <Button onClick={() => togglePanel('enhancement')} variant={activePanel === 'enhancement' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="대장간 (장비 강화)">
          <ForgeIcon /> <span className="hidden sm:inline">대장간</span>
        </Button>
        <Button onClick={() => togglePanel('altar_of_legacy')} variant={activePanel === 'altar_of_legacy' ? 'primary' : 'ghost'} size="sm" className="flex items-center space-x-1.5" title="유산의 제단">
          <span className="text-lg pixelated">✨</span> <span className="hidden sm:inline">제단</span>
        </Button>
        
        <div className="border-l border-gray-600 h-6 mx-1"></div>

        <Button onClick={toggleAutoEquip} variant={autoEquipEnabled ? 'primary' : 'secondary'} size="sm" className="flex items-center space-x-1.5" title={`자동 장착 ${autoEquipEnabled ? '활성' : '비활성'}`}>
          <AutoEquipIcon /> <span className="hidden md:inline">{autoEquipEnabled ? "자동장착 ON" : "자동장착 OFF"}</span>
        </Button>
        <Button onClick={toggleAutoLearnSkill} variant={autoLearnSkillEnabled ? 'primary' : 'secondary'} size="sm" className="flex items-center space-x-1.5" title={`자동 기술 습득 ${autoLearnSkillEnabled ? '활성' : '비활성'}`}>
          <AutoLearnSkillIcon /> <span className="hidden md:inline">{autoLearnSkillEnabled ? "자동습득 ON" : "자동습득 OFF"}</span>
        </Button>

        <div className="border-l border-gray-600 h-6 mx-1"></div>
        <Button onClick={() => setIsResetConfirmationOpen(true)} variant="danger" size="sm" className="flex items-center space-x-1.5" title="모든 데이터 초기화">
         <HardResetIcon /> <span className="hidden md:inline">초기화</span>
        </Button>

      </footer>
      
      {isSessionSummaryOpen && (
        <SessionSummaryModal
          isOpen={isSessionSummaryOpen}
          onClose={handleSessionSummaryClosed}
          sessionStats={sessionStats}
        />
      )}
      
      {showMainGameOverModal && (
        <Modal isOpen={showMainGameOverModal} onClose={openAltarFromGameOver} title="게임 종료" size="sm">
          <p className="mb-4">플레이어가 패배했습니다. 웨이브 {sessionStats.highestWaveReachedThisSession}까지 도달했습니다.</p>
          <p className="mb-2">획득한 영웅의 정수: <span className="text-yellow-400 font-bold">{Math.floor(persistentProgress.highestWaveAchieved * WAVE_CLEAR_ESSENCE_MULTIPLIER)}</span></p>
          <p className="text-xs text-gray-400 mb-4">골드, 아이템, 정수, 영구 강화는 유지됩니다. 레벨과 스킬은 초기화됩니다.</p>
          <Button onClick={openAltarFromGameOver} variant="primary" className="w-full">
            유산의 제단으로 이동
          </Button>
        </Modal>
      )}

      {isAltarOpenViaGameOver && (
        <Modal isOpen={isAltarOpenViaGameOver} onClose={closeAltarAndRestart} title="유산의 제단" size="lg">
          <AltarOfLegacyPanel 
            persistentProgress={persistentProgress}
            onUpgradeStat={upgradePermanentStat}
            onClose={closeAltarAndRestart}
          />
        </Modal>
      )}

      <Modal isOpen={isResetConfirmationOpen} onClose={() => setIsResetConfirmationOpen(false)} title="데이터 초기화 확인" size="sm">
        <p className="mb-4">정말로 모든 게임 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
        <div className="flex justify-end space-x-3">
          <Button onClick={() => setIsResetConfirmationOpen(false)} variant="secondary">취소</Button>
          <Button onClick={handleHardReset} variant="danger">초기화 확인</Button>
        </div>
      </Modal>

      <Modal 
        isOpen={!!activePanel && !isGameOver && !isAltarOpenViaGameOver && !isSessionSummaryOpen && !showMainGameOverModal} 
        onClose={() => togglePanel(null)} 
        title={getPanelTitle(activePanel)}
        size={activePanel === 'inventory' || activePanel === 'skills' || activePanel === 'altar_of_legacy' || activePanel === 'shop' || activePanel === 'enhancement' ? 'xl' : 'lg'}
      >
        {activePanel === 'inventory' && 
          <InventoryPanel 
            player={player} 
            inventory={inventory} 
            equippedItems={equippedItems} 
            onEquipItem={equipItem} 
            onUnequipItem={unequipItem} 
          />}
        {activePanel === 'skills' && 
          <SkillTreePanel 
            player={player} 
            skills={skills} 
            allSkillDefinitions={allSkillDefinitions}
            onLearnSkill={learnSkill} 
          />}
        {activePanel === 'character' && <CharacterPanel player={player} derivedStats={derivedPlayerStats} />}
        {activePanel === 'shop' && 
            <ShopPanel 
                player={player}
                shopInventory={shopInventory}
                playerInventory={inventory}
                onBuyItem={buyItem}
                onSellItem={sellItem}
                onRefreshStock={refreshShopStock}
            />}
        {activePanel === 'altar_of_legacy' && 
            <AltarOfLegacyPanel 
                persistentProgress={persistentProgress}
                onUpgradeStat={upgradePermanentStat}
                onClose={() => togglePanel(null)}
            />}
        {activePanel === 'enhancement' &&
            <EnhancementPanel
                player={player}
                inventory={inventory}
                equippedItems={equippedItems}
                onEnhanceItem={enhanceItem}
            />}
      </Modal>
    </div>
  );
};

export default App;
