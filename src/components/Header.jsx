import React, { useState } from 'react';
import { Search, UserCheck, FolderPlus } from 'lucide-react';

export default function Header({
  search,
  setSearch,
  onOpenCategoryModal,
  onOpenHrmModal,
  authUser,
  activeTab
}) {

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
        </div>
      </div>
    </header>
  );
}
