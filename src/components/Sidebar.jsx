import React from 'react';
import { 
  LayoutDashboard, 
  Monitor, 
  Network, 
  Users, 
  FileSpreadsheet, 
  ShieldCheck, 
  Cpu,
  Layers
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Tổng Quan KPI', icon: LayoutDashboard },
    { id: 'inventory', label: 'Quản Lý CCDC', icon: Monitor },
    { id: 'unittree', label: 'Sơ Đồ BĐX & Bưu Cục', icon: Network },
    { id: 'hrm', label: 'Tích Hợp HRM Nhân Sự', icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 backdrop-blur-xl z-20">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight tracking-wide">CCDC POST</h1>
            <p className="text-xs text-cyan-400 font-medium">Bưu Điện Tỉnh Thừa Thiên Huế</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Danh Mục Chính</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System info badge */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="glass-card p-3 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Hệ Thống CCDC Online</div>
            <div className="text-[11px] text-slate-400">Database SQLite / Prisma 3NF</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
