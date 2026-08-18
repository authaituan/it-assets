import React from 'react';
import { Map } from 'lucide-react';

// ==========================================
// "Bản Đồ Điểm Phục Vụ" — submenu con của "Quản Lý Mạng Lưới" (feat/network-submenu-restructure).
// PLACEHOLDER: hạng mục Bản Đồ CHƯA làm ở đợt này, sẽ có hạng mục riêng sau. Hạng mục
// sau CHỈ cần THAY THẾ nội dung file này, không cần đụng lại Sidebar.jsx/App.jsx.
// ==========================================
export default function NetworkMapView() {
  return (
    <div className="p-6">
      <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-3 min-h-[400px]">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
          <Map className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Bản Đồ Điểm Phục Vụ</h2>
        <p className="text-sm text-slate-400 max-w-md">
          Tính năng Bản Đồ đang được phát triển, sẽ sớm ra mắt.
        </p>
      </div>
    </div>
  );
}
