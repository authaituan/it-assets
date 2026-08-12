import React, { useState } from 'react';
import { Search, UserCheck, FolderPlus, Palette, Check, LogOut } from 'lucide-react';

export default function Header({
  search,
  setSearch,
  onOpenCategoryModal,
  onOpenHrmModal,
  theme,
  setTheme,
  authUser,
  onLogout
}) {
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const themes = [
    { id: 'cyberpunk', name: 'Cyberpunk Neon', desc: 'Thủy tinh Kính Dark Cyan', badgeBg: 'bg-cyan-500' },
    { id: 'postal-gold', name: 'Bưu Điện Hoàng Gia', desc: 'Xanh Mực Bưu Điện & Vàng Kim', badgeBg: 'bg-amber-400' },
    { id: 'obsidian-emerald', name: 'Obsidian Emerald', desc: 'Đen Tuyền & Ngọc Lục Bảo', badgeBg: 'bg-emerald-400' },
    { id: 'nordic-light', name: 'Nordic Light Crisp', desc: 'Giao Diện Sáng Sang Trọng', badgeBg: 'bg-blue-500' },
  ];

  const activeThemeObj = themes.find(t => t.id === theme) || themes[0];

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Global Search Bar */}
      <div className="relative w-80">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm máy tính, IP, MAC, Serial, Bưu cục, Nhân viên..."
          className="w-full pl-10 pr-4 py-2 rounded-xl text-xs glass-input transition-all placeholder:text-slate-500"
        />
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-2.5">
        {/* Live Theme Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 transition-all shadow-sm"
          >
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>Giao Diện: {activeThemeObj.name}</span>
          </button>

          {isThemeOpen && (
            <div className="absolute right-0 mt-2 w-64 glass-panel rounded-2xl shadow-2xl border border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Chọn Template / Chủ Đề Giao Diện
              </div>
              <div className="space-y-1">
                {themes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTheme(t.id);
                      setIsThemeOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                      theme === t.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3 h-3 rounded-full ${t.badgeBg}`}></span>
                      <div>
                        <div>{t.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{t.desc}</div>
                      </div>
                    </div>
                    {theme === t.id && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nút Đăng Xuất — đặt cạnh công tắc đổi theme */}
        <button
          onClick={onLogout}
          title="Đăng xuất"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-700 hover:border-rose-500/50 hover:text-rose-300 transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng Xuất</span>
        </button>

        <button
          onClick={onOpenHrmModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all shadow-sm"
        >
          <UserCheck className="w-4 h-4 text-purple-400" />
          <span>Upload File HRM</span>
        </button>

        {/* Nút Thêm Danh Mục CCDC */}
        <button
          onClick={onOpenCategoryModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all shadow-sm"
        >
          <FolderPlus className="w-4 h-4 text-cyan-400" />
          <span>Thêm Danh Mục CCDC</span>
        </button>

        <div className="h-6 w-[1px] bg-slate-800 mx-1"></div>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-xs text-white border border-slate-500/30">
            IT
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-slate-200 leading-tight">{authUser?.full_name || authUser?.hrm_code || 'Người dùng'}</div>
            <div className="text-[10px] text-cyan-400 font-medium">{authUser?.role === 'STAFF' ? 'Nhân viên (chỉ xem)' : 'Quản lý'} · BĐTP Huế (Mã 53)</div>
          </div>
        </div>
      </div>
    </header>
  );
}
