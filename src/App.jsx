import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import UnitTreeView from './components/UnitTreeView';
import PersonnelView from './components/PersonnelView';
import UserAdminView from './components/UserAdminView';
import CategoryAdminView from './components/CategoryAdminView';
import EquipmentDetailModal from './components/EquipmentDetailModal';
import AddEquipmentModal from './components/AddEquipmentModal';
import AddCategoryModal from './components/AddCategoryModal';
import { getToken, setToken, clearToken, decodeJwtPayload, isTokenExpired, AUTH_EXPIRED_EVENT } from './utils/api';

// Đọc token đã lưu (nếu có) ngay lúc khởi tạo state, để tránh nháy màn hình
// nội dung chính rồi mới bị đá về LoginView. Token hết hạn (claim "exp")
// bị coi như chưa đăng nhập ngay từ đầu, không cần đợi request đầu tiên 401.
function getInitialAuthUser() {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    if (token) clearToken();
    return null;
  }
  return decodeJwtPayload(token);
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [theme, setTheme] = useState('cyberpunk');
  const [refreshKey, setRefreshKey] = useState(0);
  const [authUser, setAuthUser] = useState(getInitialAuthUser);
  const [inventoryDeviceTypeId, setInventoryDeviceTypeId] = useState(null);

  // Bất kỳ request ghi nào (qua src/utils/api.js) nhận 401 từ backend sẽ tự
  // xoá token + phát event này -> quay về LoginView, không để lộ lỗi JSON thô.
  useEffect(() => {
    function handleAuthExpired() {
      setAuthUser(null);
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const handleLoginSuccess = (token) => {
    setToken(token);
    setAuthUser(decodeJwtPayload(token));
  };

  const handleLogout = () => {
    clearToken();
    setAuthUser(null);
    // Reset về dashboard: tránh trường hợp đăng nhập lại bằng user khác
    // (vd STAFF) trong khi đang ở tab "Quản Lý Người Dùng" -> màn hình
    // trắng vì tab đó bị ẩn theo role nhưng activeTab vẫn giữ giá trị cũ.
    setActiveTab('dashboard');
  };

  const handleSelectUnitFromTree = (communeId, unitId) => {
    setActiveTab('inventory');
  };

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className={`theme-${theme} min-h-screen flex font-sans`}>
      {!authUser ? (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          {/* Sidebar */}
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveTab(tab);
              if (tab === 'inventory') {
                setInventoryDeviceTypeId(null);
              }
            }} 
            authUser={authUser} 
            activeInventoryDeviceTypeId={inventoryDeviceTypeId}
            onSelectInventoryCategory={(id) => {
              setActiveTab('inventory');
              setInventoryDeviceTypeId(id);
            }}
          />

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
              onOpenHrmModal={() => setActiveTab('personnel')}
              theme={theme}
              setTheme={setTheme}
              authUser={authUser}
              onLogout={handleLogout}
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
                  initialDeviceTypeId={inventoryDeviceTypeId}
                />
              )}

              {activeTab === 'unittree' && (
                <UnitTreeView
                  key={`tree-${refreshKey}`}
                  onSelectUnitFilter={handleSelectUnitFromTree}
                />
              )}

              {activeTab === 'personnel' && (
                <PersonnelView />
              )}

              {activeTab === 'categoryadmin' && authUser?.role !== 'STAFF' && (
                <CategoryAdminView />
              )}

              {activeTab === 'useradmin' && authUser?.role !== 'STAFF' && (
                <UserAdminView authUser={authUser} />
              )}
            </main>
          </div>

          {/* Modals */}
          {selectedEquipment && (
            <EquipmentDetailModal
              equipment={selectedEquipment}
              onClose={() => setSelectedEquipment(null)}
              onUpdated={triggerRefresh}
              onDeleted={triggerRefresh}
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
        </>
      )}
    </div>
  );
}
