import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Network,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  Cpu,
  Layers,
  UserCog,
  Printer,
  QrCode,
  Wifi,
  Zap,
  Camera,
  Scale,
  ChevronDown,
  ChevronRight,
  List,
  FolderTree,
  Map
} from 'lucide-react';

// Submenu TĨNH 3 mục cố định của "Quản Lý Mạng Lưới" (feat/network-submenu-restructure)
// — KHÁC hẳn submenu động của "Quản Lý CCDC" (deviceTypes fetch từ API): đây là 3 VIEW
// khác nhau (Danh Sách/Cây Thư Mục/Bản Đồ), không phải filter theo danh mục.
const NETWORK_SUBVIEWS = [
  { id: 'list', label: 'Danh Sách', icon: List },
  { id: 'tree', label: 'Cây Thư Mục', icon: FolderTree },
  { id: 'map', label: 'Bản Đồ Điểm Phục Vụ', icon: Map }
];

export default function Sidebar({ activeTab, setActiveTab, authUser, activeInventoryDeviceTypeId, onSelectInventoryCategory, networkSubView, onSelectNetworkSubView }) {
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [isNetworkExpanded, setIsNetworkExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/device-types')
      .then(res => res.json())
      .then(data => setDeviceTypes(data))
      .catch(err => console.error(err));
  }, []);

  const getDeviceIcon = (code) => {
    switch (code) {
      case 'PRINTER': return <Printer className="w-4 h-4 text-purple-400" />;
      case 'SCANNER': return <QrCode className="w-4 h-4 text-emerald-400" />;
      case 'NETWORK': return <Wifi className="w-4 h-4 text-amber-400" />;
      case 'UPS': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'CAMERA': return <Camera className="w-4 h-4 text-rose-400" />;
      case 'SCALE': return <Scale className="w-4 h-4 text-blue-400" />;
      default: return <Monitor className="w-4 h-4 text-cyan-400" />;
    }
  };
  const navItems = [
    { id: 'dashboard', label: 'Tổng Quan KPI', icon: LayoutDashboard },
    { id: 'inventory', label: 'Quản Lý CCDC', icon: Monitor },
    { id: 'unittree', label: 'Quản Lý Mạng Lưới', icon: Network },
    { id: 'personnel', label: 'Người Sử Dụng', icon: Users },
  ];

  // Chỉ role quản lý (khác STAFF) mới thấy mục Quản Lý Danh Mục + Quản Lý Người Dùng.
  if (authUser?.role !== 'STAFF') {
    navItems.push({ id: 'categoryadmin', label: 'Quản Lý Danh Mục', icon: Layers });
    navItems.push({ id: 'useradmin', label: 'Quản Lý Người Dùng', icon: UserCog });
  }

  return (
    <aside className="w-64 bg-slate-900/80 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 backdrop-blur-xl z-20">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight tracking-wide">Hệ Thống Quản Lý CCDC</h1>
            <p className="text-xs text-cyan-400 font-medium">Bưu Điện Thành Phố Huế</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Danh Mục Chính</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.id === 'inventory') {
              const handleInventoryClick = () => {
                if (isActive && !activeInventoryDeviceTypeId) {
                  setIsInventoryExpanded(!isInventoryExpanded);
                } else {
                  setActiveTab('inventory');
                  setIsInventoryExpanded(true);
                }
              };

              return (
                <div key={item.id} className="flex flex-col">
                  <div className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}>
                    <button
                      onClick={handleInventoryClick}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInventoryExpanded(!isInventoryExpanded);
                      }}
                      className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors ml-2"
                    >
                      {isInventoryExpanded ? (
                        <ChevronDown className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      ) : (
                        <ChevronRight className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      )}
                    </button>
                  </div>

                  {isInventoryExpanded && (
                    <div className="mt-1.5 ml-4 pl-3.5 border-l border-slate-700/50 space-y-1">
                      {deviceTypes.map((dt) => {
                        const isSubActive = isActive && activeInventoryDeviceTypeId === dt.id;
                        return (
                          <button
                            key={dt.id}
                            onClick={() => onSelectInventoryCategory(dt.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                              isSubActive 
                                ? 'bg-cyan-500/10 text-cyan-300' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            {getDeviceIcon(dt.code)}
                            <span className="truncate leading-tight">{dt.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.id === 'unittree') {
              const handleNetworkClick = () => {
                if (isActive) {
                  setIsNetworkExpanded(!isNetworkExpanded);
                } else {
                  setActiveTab('unittree');
                  setIsNetworkExpanded(true);
                }
              };

              return (
                <div key={item.id} className="flex flex-col">
                  <div className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}>
                    <button
                      onClick={handleNetworkClick}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsNetworkExpanded(!isNetworkExpanded);
                      }}
                      className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors ml-2"
                    >
                      {isNetworkExpanded ? (
                        <ChevronDown className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      ) : (
                        <ChevronRight className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      )}
                    </button>
                  </div>

                  {isNetworkExpanded && (
                    <div className="mt-1.5 ml-4 pl-3.5 border-l border-slate-700/50 space-y-1">
                      {NETWORK_SUBVIEWS.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && networkSubView === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => onSelectNetworkSubView(sub.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                              isSubActive
                                ? 'bg-cyan-500/10 text-cyan-300'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                          >
                            <SubIcon className="w-4 h-4" />
                            <span className="truncate leading-tight">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

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
