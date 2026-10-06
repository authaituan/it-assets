import React, { useState } from 'react';
import { Search, UserCheck, FolderPlus, LogOut, Lock } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

export default function Header({
  search,
  setSearch,
  onOpenCategoryModal,
  onOpenHrmModal,

  authUser,
  onLogout
}) {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  return (
    <header className="h-16 bg-surface border-b-2 border-info px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Global Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm máy tính, IP, MAC, Serial, Bưu cục, Nhân viên..."
          className="w-full pl-10 pr-4 h-10 bg-surface-alt text-[14px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-2.5">


        {/* Nút Đổi Mật Khẩu — cho MỌI user đã đăng nhập, kể cả STAFF */}
        <button
          onClick={() => setIsChangePasswordOpen(true)}
          title="Đổi mật khẩu"
          className="flex items-center gap-1.5 px-3 h-10 text-[14px] font-bold text-ink bg-surface-alt hover:bg-sky transition-all"
        >
          <Lock className="w-4 h-4" />
          <span>Đổi Mật Khẩu</span>
        </button>

        {/* Nút Đăng Xuất — đặt cạnh công tắc đổi theme */}
        <button
          onClick={onLogout}
          title="Đăng xuất"
          className="flex items-center gap-1.5 px-3 h-10 text-[14px] font-bold text-ink bg-surface-alt hover:bg-danger hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng Xuất</span>
        </button>

        {isChangePasswordOpen && (
          <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
        )}

        <button
          onClick={onOpenHrmModal}
          className="flex items-center gap-1.5 px-3 h-10 text-[14px] font-bold text-ink bg-surface-alt hover:bg-sky transition-all"
        >
          <UserCheck className="w-4 h-4" />
          <span>Upload File HRM</span>
        </button>

        {/* Nút Thêm Danh Mục CCDC */}
        <button
          onClick={onOpenCategoryModal}
          className="flex items-center gap-1.5 px-3 h-10 text-[14px] font-bold text-ink bg-accent transition-all"
        >
          <FolderPlus className="w-4 h-4 text-ink" />
          <span>Thêm Danh Mục CCDC</span>
        </button>

        <div className="h-6 w-[1px] bg-surface-alt mx-1"></div>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-9 h-9 bg-accent flex items-center justify-center font-extrabold text-[14px] text-ink">
            IT
          </div>
          <div className="hidden md:block text-left">
            <div className="text-[14px] font-extrabold text-ink leading-tight">{authUser?.full_name || authUser?.hrm_code || 'Người dùng'}</div>
            <div className="text-[12px] text-muted">{authUser?.role === 'STAFF' ? 'Nhân viên (chỉ xem)' : 'Quản lý'} · BĐTP Huế (Mã 53)</div>
          </div>
        </div>
      </div>
    </header>
  );
}
