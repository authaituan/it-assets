import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Monitor,
  Network,
  Users,
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
  Map,
  Mail
} from 'lucide-react';
import { apiFetch } from '../utils/api';

// Submenu TĨNH 3 mục cố định của "Quản Lý Mạng Lưới" (feat/network-submenu-restructure)
// — KHÁC hẳn submenu động của "Quản Lý CCDC" (deviceTypes fetch từ API): đây là 3 VIEW
// khác nhau (Danh Sách/Cây Thư Mục/Bản Đồ), không phải filter theo danh mục.
const NETWORK_SUBVIEWS = [
  { id: 'list', label: 'Danh Sách', icon: List },
  { id: 'tree', label: 'Cây Thư Mục', icon: FolderTree },
  { id: 'map', label: 'Bản Đồ Điểm Phục Vụ', icon: Map }
];

const EMAIL_SUBVIEWS = [
  { id: 'list', label: 'Danh sách', icon: List }
];

export default function Sidebar({ activeTab, setActiveTab, authUser, activeInventoryDeviceTypeId, onSelectInventoryCategory, networkSubView, onSelectNetworkSubView, emailSubView, onSelectEmailSubView }) {
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [isNetworkExpanded, setIsNetworkExpanded] = useState(false);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);

  useEffect(() => {
    apiFetch('/api/device-types')
      .then(res => res.json())
      .then(data => setDeviceTypes(data))
      .catch(err => console.error(err));
  }, []);

  const getDeviceIcon = (code) => {
    switch (code) {
      case 'PRINTER': return <Printer className="w-4 h-4 text-ink" />;
      case 'SCANNER': return <QrCode className="w-4 h-4 text-ink" />;
      case 'NETWORK': return <Wifi className="w-4 h-4 text-ink" />;
      case 'UPS': return <Zap className="w-4 h-4 text-ink" />;
      case 'CAMERA': return <Camera className="w-4 h-4 text-ink" />;
      case 'SCALE': return <Scale className="w-4 h-4 text-ink" />;
      default: return <Monitor className="w-4 h-4 text-ink" />;
    }
  };
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan KPI', icon: LayoutDashboard, bgColor: 'bg-success' },
    { id: 'inventory', label: 'Quản lý CCDC', icon: Monitor, bgColor: 'bg-accent' },
    { id: 'unittree', label: 'Quản lý mạng lưới', icon: Network, bgColor: 'bg-sky' },
    { id: 'emails', label: 'Quản lý email', icon: Mail, bgColor: 'bg-success' },
    { id: 'personnel', label: 'Người sử dụng', icon: Users, bgColor: 'bg-accent' },
  ];

  // Chỉ role quản lý (khác STAFF) mới thấy mục Quản Lý Danh Mục + Quản Lý Người Dùng.
  if (authUser?.role !== 'STAFF') {
    navItems.push({ id: 'categoryadmin', label: 'Quản lý danh mục', icon: Layers, bgColor: 'bg-sky' });
    navItems.push({ id: 'useradmin', label: 'Quản lý người dùng', icon: UserCog, bgColor: 'bg-success' });
  }

  return (
    <aside className="w-64 bg-sidebar flex flex-col justify-between h-screen sticky top-0 z-20 text-ink">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b-2 border-surface-alt">
          <div className="w-[36px] h-[36px] bg-success flex items-center justify-center text-ink font-extrabold text-[18px]">
            H
          </div>
          <div>
            <h1 className="font-extrabold text-[15px] text-ink leading-tight tracking-wide">CCDC Huế</h1>
            <p className="text-[12px] text-muted">Bưu điện Thành phố</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[12px] font-extrabold text-muted tracking-wider uppercase">Danh Mục Chính</div>
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
                  <div className={`w-full flex items-center justify-between px-2.5 py-2 font-bold text-[14px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-success text-ink font-extrabold'
                      : 'text-ink hover:bg-surface-alt'
                  }`}>
                    <button
                      onClick={handleInventoryClick}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className={`w-8 h-8 flex items-center justify-center ${isActive ? 'bg-white' : item.bgColor}`}>
                        <Icon className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
                      </div>
                      <span>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInventoryExpanded(!isInventoryExpanded);
                      }}
                      className="p-1 hover:bg-surface-alt transition-colors ml-2"
                    >
                      {isInventoryExpanded ? (
                        <ChevronDown className="w-4 h-4 text-ink" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink" />
                      )}
                    </button>
                  </div>

                  {isInventoryExpanded && (
                    <div className="mt-1 ml-5 pl-3 border-l-2 border-info flex flex-col">
                      {deviceTypes.map((dt) => {
                        const isSubActive = isActive && activeInventoryDeviceTypeId === dt.id;
                        return (
                          <button
                            key={dt.id}
                            onClick={() => onSelectInventoryCategory(dt.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold transition-all text-left ${
                              isSubActive 
                                ? 'bg-white font-bold border-l-4 border-primary text-ink' 
                                : 'text-ink hover:bg-surface-alt border-l-4 border-transparent'
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
                  <div className={`w-full flex items-center justify-between px-2.5 py-2 font-bold text-[14px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-success text-ink font-extrabold'
                      : 'text-ink hover:bg-surface-alt'
                  }`}>
                    <button
                      onClick={handleNetworkClick}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className={`w-8 h-8 flex items-center justify-center ${isActive ? 'bg-white' : item.bgColor}`}>
                        <Icon className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
                      </div>
                      <span>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsNetworkExpanded(!isNetworkExpanded);
                      }}
                      className="p-1 hover:bg-surface-alt transition-colors ml-2"
                    >
                      {isNetworkExpanded ? (
                        <ChevronDown className="w-4 h-4 text-ink" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink" />
                      )}
                    </button>
                  </div>

                  {isNetworkExpanded && (
                    <div className="mt-1 ml-5 pl-3 border-l-2 border-info flex flex-col">
                      {NETWORK_SUBVIEWS.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && networkSubView === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => onSelectNetworkSubView(sub.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold transition-all text-left ${
                              isSubActive
                                ? 'bg-white font-bold border-l-4 border-primary text-ink'
                                : 'text-ink hover:bg-surface-alt border-l-4 border-transparent'
                            }`}
                          >
                            <SubIcon className="w-4 h-4 text-ink" />
                            <span className="truncate leading-tight">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.id === 'emails') {
              const handleEmailClick = () => {
                if (isActive) {
                  setIsEmailExpanded(!isEmailExpanded);
                } else {
                  setActiveTab('emails');
                  setIsEmailExpanded(true);
                }
              };

              return (
                <div key={item.id} className="flex flex-col">
                  <div className={`w-full flex items-center justify-between px-2.5 py-2 font-bold text-[14px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-success text-ink font-extrabold'
                      : 'text-ink hover:bg-surface-alt'
                  }`}>
                    <button
                      onClick={handleEmailClick}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className={`w-8 h-8 flex items-center justify-center ${isActive ? 'bg-white' : item.bgColor}`}>
                        <Icon className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
                      </div>
                      <span>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEmailExpanded(!isEmailExpanded);
                      }}
                      className="p-1 hover:bg-surface-alt transition-colors ml-2"
                    >
                      {isEmailExpanded ? (
                        <ChevronDown className="w-4 h-4 text-ink" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink" />
                      )}
                    </button>
                  </div>

                  {isEmailExpanded && (
                    <div className="mt-1 ml-5 pl-3 border-l-2 border-info flex flex-col">
                      {EMAIL_SUBVIEWS.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = isActive && emailSubView === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => onSelectEmailSubView(sub.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold transition-all text-left ${
                              isSubActive
                                ? 'bg-white font-bold border-l-4 border-primary text-ink'
                                : 'text-ink hover:bg-surface-alt border-l-4 border-transparent'
                            }`}
                          >
                            <SubIcon className="w-4 h-4 text-ink" />
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
                className={`w-full flex items-center gap-3 px-2.5 py-2 font-bold text-[14px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-success text-ink font-extrabold'
                    : 'text-ink hover:bg-surface-alt'
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center ${isActive ? 'bg-white' : item.bgColor}`}>
                  <Icon className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System info badge */}
      <div className="p-4 border-t-2 border-surface-alt">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-success"></div>
          <div>
            <div className="text-[12px] font-bold text-ink">Hệ thống CCDC online</div>
            <div className="text-[11px] text-muted">Bưu điện TP Huế</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
