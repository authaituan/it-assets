import React, { useState } from 'react';
import { Search, UserCheck, FolderPlus, LogOut, Lock } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

export default function Header({
  search,
  setSearch,
  onOpenCategoryModal,
  onOpenHrmModal,
  authUser,
  onLogout,
  activeTab
}) {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Helper function to get screen name
  const getScreenName = () => {
    switch(activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'inventory': return 'Quản lý CCDC';
      case 'unittree': return 'Quản lý mạng lưới';
      case 'emails': return 'Quản lý Email';
      case 'personnel': return 'Nhân sự';
      case 'categoryadmin': return 'Quản lý danh mục';
      case 'useradmin': return 'Quản lý người dùng';
      default: return 'Trang chủ';
    }
  };

  return (
    <header className="h-[72px] px-6 flex items-center justify-between sticky top-0 z-10 bg-transparent">
      {/* Left side: Breadcrumbs & Title */}
      <div className="min-w-0 shrink flex-1 mr-4">
        <nav aria-label="breadcrumb">
          <ol className="flex items-center space-x-2 text-[14px] text-[var(--color-subtext)] whitespace-nowrap">
            <li>Trang</li>
            <li>/</li>
            <li className="text-[var(--color-title)] truncate" aria-current="page">{getScreenName()}</li>
          </ol>
        </nav>
        <h6 className="font-bold text-[var(--color-title)] mt-0.5 text-base capitalize whitespace-nowrap truncate">{getScreenName()}</h6>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-3 xl:gap-4 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            className="input-soft w-32 xl:w-56 pl-9 pr-4 py-2"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4">
          {activeTab === 'inventory' && authUser?.role !== 'STAFF' && (
            <button
              onClick={onOpenCategoryModal}
              className="btn btn-outline-primary flex items-center gap-1.5 px-3 xl:px-6"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden xl:inline">Thêm Danh Mục CCDC</span>
            </button>
          )}

          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="text-[14px] font-semibold text-[var(--color-body)] hover:text-[var(--color-title)] transition-colors flex items-center gap-1 whitespace-nowrap"
            title="Đổi mật khẩu"
          >
            <Lock className="w-4 h-4" />
            <span className="hidden xl:inline">Đổi mật khẩu</span>
          </button>

          {authUser?.role !== 'STAFF' && (
          <button
            onClick={onOpenHrmModal}
            className="text-[14px] font-semibold text-[var(--color-body)] hover:text-[var(--color-title)] transition-colors flex items-center gap-1 whitespace-nowrap"
            title="Upload File HRM"
          >
            <UserCheck className="w-4 h-4" />
            <span className="hidden xl:inline">Upload File HRM</span>
          </button>
          )}

          <button
            onClick={onLogout}
            className="text-[14px] font-semibold text-[var(--color-body)] hover:text-[var(--color-title)] transition-colors flex items-center gap-1 whitespace-nowrap"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden xl:inline">Đăng xuất</span>
          </button>
        </div>

        {/* User Block */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-[var(--color-dark)] flex items-center justify-center font-bold text-xs text-white">
            {authUser?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-[var(--color-title)] leading-tight">{authUser?.full_name || authUser?.hrm_code || 'Người dùng'}</div>
            <div className="text-[10px] text-[var(--color-subtext)] font-medium">{authUser?.role === 'STAFF' ? 'Nhân viên (chỉ xem)' : 'Quản lý'}</div>
          </div>
        </div>
      </div>

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </header>
  );
}
