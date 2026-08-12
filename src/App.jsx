import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import UnitTreeView from './components/UnitTreeView';
import HrmMappingView from './components/HrmMappingView';
import EquipmentDetailModal from './components/EquipmentDetailModal';
import AddEquipmentModal from './components/AddEquipmentModal';
import AddCategoryModal from './components/AddCategoryModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [theme, setTheme] = useState('cyberpunk');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectUnitFromTree = (communeId, unitId) => {
    setActiveTab('inventory');
  };

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className={`theme-${theme} min-h-screen flex font-sans`}>
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header 
          search={search} 
          setSearch={(val) => {
            setSearch(val);
            if (val && activeTab !== 'inventory') {
              setActiveTab('inventory');
            }
          }}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
          onOpenHrmModal={() => setActiveTab('hrm')}
          theme={theme}
          setTheme={setTheme}
        />

        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardView 
              key={`dash-${refreshKey}`} 
              onSelectCommune={() => setActiveTab('inventory')} 
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              key={`inv-${refreshKey}`}
              search={search}
              setSearch={setSearch}
              onSelectEquipment={(eq) => setSelectedEquipment(eq)}
              onOpenAddModal={() => setIsAddModalOpen(true)}
            />
          )}

          {activeTab === 'unittree' && (
            <UnitTreeView 
              key={`tree-${refreshKey}`} 
              onSelectUnitFilter={handleSelectUnitFromTree} 
            />
          )}

          {activeTab === 'hrm' && (
            <HrmMappingView />
          )}
        </main>
      </div>

      {/* Modals */}
      {selectedEquipment && (
        <EquipmentDetailModal
          equipment={selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          onUpdated={triggerRefresh}
        />
      )}

      {isAddModalOpen && (
        <AddEquipmentModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={triggerRefresh}
        />
      )}

      {isCategoryModalOpen && (
        <AddCategoryModal
          onClose={() => setIsCategoryModalOpen(false)}
          onSuccess={triggerRefresh}
        />
      )}
    </div>
  );
}
