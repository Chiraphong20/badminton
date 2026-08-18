import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';

import { LoginScreen } from './components/LoginScreen';
import { DashboardTab } from './components/DashboardTab';
import { CourtsTab } from './components/CourtsTab';
import { MembersTab } from './components/MembersTab';
import { SettingsTab } from './components/SettingsTab';
import { LogsTab } from './components/LogsTab';
import { QueueView } from './components/QueueView';
import { SplashScreen } from './components/SplashScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TabletNav } from './components/layout/TabletNav';
import { MobileNav } from './components/layout/MobileNav';
import { NextQueuePromptModal } from './components/layout/NextQueuePromptModal';
import { GlobalModals } from './components/layout/GlobalModals';
import { useAppData } from './hooks/useAppData';

// App.tsx เป็นแค่จุดเชื่อมโยงแต่ละหน้า (routing/composition) — state, effects และ handler ทั้งหมด
// อยู่ใน useAppData(), ส่วน UI ของ layout (sidebar/nav/modal) แยกเป็น component ใน ./components/layout
export default function App() {
  const app = useAppData();

  if (app.isQueueView) return <QueueView />;

  if (!app.isAuthenticated) {
    return (
      <AnimatePresence>
        <LoginScreen onLogin={() => app.setIsAuthenticated(true)} />
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence>
        {app.isInitialLoading && <SplashScreen key="splash" clubName={app.club?.name || 'SmashPang'} />}
      </AnimatePresence>

      <NextQueuePromptModal
        prompt={app.nextQueuePrompt}
        onConfirm={app.confirmNextQueue}
        onClose={() => app.setNextQueuePrompt(null)}
      />

      <div className="min-h-screen bg-background flex flex-col lg:flex-row">
        <Sidebar
          activeTab={app.activeTab}
          onTabChange={app.setActiveTab}
          isCollapsed={app.isSidebarCollapsed}
          onToggleCollapse={() => app.setIsSidebarCollapsed(!app.isSidebarCollapsed)}
          todayRevenue={app.todayRevenue}
          isSyncing={app.isSyncing}
          lastAutoSave={app.lastAutoSave}
          onManageProducts={() => app.setShowManageProducts(true)}
          clubName={app.club?.name || 'SmashPang'}
        />

        {/* Main Container */}
        <div className={cn(
          "flex-1 transition-all duration-300",
          app.isSidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
        )}>
          <GlobalModals
            members={app.members}
            rankMemory={app.rankMemory}
            snacks={app.snacks}
            onSaveSnacks={app.setSnacks}
            showAddMember={app.showAddMember}
            onCloseAddMember={() => app.setShowAddMember(false)}
            onAddMember={app.addMember}
            showAddCourt={app.showAddCourt}
            onCloseAddCourt={() => app.setShowAddCourt(false)}
            onAddCourt={app.addCourt}
            showManageProducts={app.showManageProducts}
            onCloseManageProducts={() => app.setShowManageProducts(false)}
            showImport={app.showImport}
            onCloseImport={() => app.setShowImport(false)}
            onImportMembers={app.importMembers}
            importIsSession={app.importIsSession}
          />

          {/* Main Content Area */}
          <main className="p-4 md:p-6 court-texture pb-24 md:pb-6 md:pt-[4.5rem] lg:pt-6 min-h-screen">
            <AnimatePresence mode="wait">
              <motion.div key={app.activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {app.activeTab === 'dashboard' && (
                  <DashboardTab
                    members={app.members} courts={app.courts} snacks={app.snacks}
                    paymentHistory={app.paymentHistory} gameHistory={app.gameHistory}
                    onUpdateRank={app.updateMemberRank}
                    onRemoveSnack={app.removeSnackFromMember}
                    onUpdateSnackPrice={app.updateSnackPrice}
                    viewingSession={app.viewingSession}
                    onCloseSession={() => app.setViewingSession(null)}
                    sessionHistory={app.sessionHistory}
                    onViewSession={(s) => app.setViewingSession(s)}
                    onProcessPayment={app.processPayment}
                    onReOpen={app.reOpenSession}
                    onPullSession={app.pullSessionData}
                    isSyncing={app.isSyncing}
                    onAddCourt={() => app.setShowAddCourt(true)}
                    isSidebarCollapsed={app.isSidebarCollapsed}
                    onCheckIn={app.checkInMember}
                    onRemove={app.removeFromSession}
                    onResetDay={app.resetDay}
                    onClearBoard={app.clearBoard}
                    onUpdateGame={app.updateGame}
                    onAddSnack={app.addSnacksToMember}
                    onImportLine={() => { app.setImportIsSession(true); app.setShowImport(true); }}
                    sessionStartDate={app.sessionStartDate}
                    promptPayId={app.promptPayId}
                  />
                )}
                {app.activeTab === 'logs' && (
                  <LogsTab
                    gameHistory={app.gameHistory}
                    sessionHistory={app.sessionHistory}
                    members={app.members}
                    paymentHistory={app.paymentHistory}
                    onViewSession={app.setViewingSession}
                    onActiveTab={app.setActiveTab}
                    onUpdateGame={app.updateGame}
                    onPullSession={app.pullSessionData}
                    pendingSearch={app.pendingStatsSearch}
                    onConsumePendingSearch={() => app.setPendingStatsSearch(null)}
                  />
                )}
                {app.activeTab === 'members' && (
                  <MembersTab
                    members={app.members}
                    searchQuery={app.searchQuery}
                    onSearch={app.setSearchQuery}
                    onRemove={app.removeMember}
                    onAddMember={() => { app.setImportIsSession(false); app.setShowAddMember(true); }}
                    onImportLine={() => { app.setImportIsSession(false); app.setShowImport(true); }}
                    onUpdateRank={app.updateMemberRank}
                    onUpdateName={app.updateMemberName}
                    onAddCourt={() => app.setShowAddCourt(true)}
                    onCheckIn={app.checkInMember}
                    onBulkCheckIn={app.bulkCheckIn}
                    onBulkRemove={app.bulkRemove}
                    onBulkUpdateRank={app.bulkUpdateRank}
                    onViewStats={(name) => { app.setPendingStatsSearch(name); app.setActiveTab('logs'); }}
                  />
                )}
                {app.activeTab === 'courts' && (
                  <CourtsTab
                    members={app.members} courts={app.courts} snacks={app.snacks}
                    searchQuery={app.searchQuery} gameHistory={app.gameHistory}
                    onAutoMatch={app.autoMatch} onStartGame={app.startGame} onResetCourt={app.resetCourt}
                    onRemovePlayer={app.removePlayerFromCourt} onAddPlayer={app.addPlayerToCourt}
                    onDeleteCourt={app.deleteCourt} onAddSnack={app.addSnacksToMember}
                    onEditGame={app.editGame} onUndoGame={app.undoGame} onUpdateCourt={app.setCourts}
                    minRankFilter={app.minRankFilter} setMinRankFilter={app.setMinRankFilter}
                    maxRankFilter={app.maxRankFilter} setMaxRankFilter={app.setMaxRankFilter}
                    onAddCourt={() => app.setShowAddCourt(true)}
                    courtQueues={app.courtQueues}
                    onAddCourtQueue={app.addToCourtQueue}
                    onRemoveCourtQueue={app.removeFromCourtQueue}
                    onUpdateCourtQueue={app.updateCourtQueueSlot}
                    onMoveCourtQueue={app.moveCourtQueueSlot}
                  />
                )}
                {app.activeTab === 'settings' && (
                  <SettingsTab
                    courtFeePerPerson={app.courtFeePerPerson}
                    setCourtFeePerPerson={app.setCourtFeePerPerson}
                    shuttlePrice={app.shuttlePrice}
                    setShuttlePrice={app.setShuttlePrice}
                    promptPayId={app.promptPayId}
                    setPromptPayId={app.setPromptPayId}
                    clubSlug={app.club?.slug || ''}
                    onSeedMockHistory={app.seedMockHistory}
                    onResetDay={app.resetDay}
                    onFactoryReset={app.factoryReset}
                    rankMemory={app.rankMemory}
                    onChangePin={app.changePin}
                    onLogout={app.logout}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <TabletNav
          activeTab={app.activeTab}
          onTabChange={app.setActiveTab}
          isSyncing={app.isSyncing}
          onManageProducts={() => app.setShowManageProducts(true)}
          onImport={() => { app.setImportIsSession(false); app.setShowImport(true); }}
          clubName={app.club?.name || 'SmashPang'}
        />

        <MobileNav
          activeTab={app.activeTab}
          onTabChange={app.setActiveTab}
          onManageProducts={() => app.setShowManageProducts(true)}
        />
      </div>
    </>
  );
}
