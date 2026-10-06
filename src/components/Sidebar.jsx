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
  Mail,
  Hexagon
} from 'lucide-react';
import { apiFetch } from '../utils/api';

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
      case 'PRINTER': return <Printer className="w-3 h-3" />;
      case 'SCANNER': return <QrCode className="w-3 h-3" />;
      case 'NETWORK': return <Wifi className="w-3 h-3" />;
      case 'UPS': return <Zap className="w-3 h-3" />;
      case 'CAMERA': return <Camera className="w-3 h-3" />;
      case 'SCALE': return <Scale className="w-3 h-3" />;
      default: return <Monitor className="w-3 h-3" />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tổng quan KPI', icon: LayoutDashboard },
    { id: 'inventory', label: 'Quản lý CCDC', icon: Monitor },
    { id: 'unittree', label: 'Quản lý mạng lưới', icon: Network },
    { id: 'emails', label: 'Quản lý email', icon: Mail },
    { id: 'personnel', label: 'Người sử dụng', icon: Users },
  ];

  if (authUser?.role !== 'STAFF') {
    navItems.push({ id: 'categoryadmin', label: 'Quản lý danh mục', icon: Layers });
    navItems.push({ id: 'useradmin', label: 'Quản lý người dùng', icon: UserCog });
  }

  return (
    <aside className="w-[250px] bg-transparent flex flex-col justify-between h-screen sticky top-0 z-20 my-4 ml-4">
      <div>
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-dark)] flex items-center justify-center text-white">
            <Hexagon className="w-5 h-5 fill-white" />
          </div>
          <span className="font-bold text-sm text-[var(--color-title)] tracking-wide">CCDC Huế</span>
        </div>
        
        <hr className="h-px mt-0 bg-transparent bg-gradient-to-r from-transparent via-black/10 to-transparent border-none" />

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            const renderSubmenu = (isExpanded, setExpanded, subItems, currentSubId, onSelectSub) => {
              if (!isExpanded) return null;
              return (
                <div className="mt-1 ml-4 pl-3.5 space-y-1 relative before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200">
                  {subItems.map((sub, idx) => {
                    const isSubActive = currentSubId === sub.id;
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => onSelectSub(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all text-left ${
                          isSubActive 
                            ? 'text-[var(--color-title)] font-bold' 
                            : 'text-[var(--color-body)] hover:text-[var(--color-title)]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? 'bg-[var(--color-primary)]' : 'bg-gray-300'}`}></span>
                        <span className="truncate leading-tight">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            };

            const handleClick = (expandedState, setExpandedState, tabId) => {
              if (isActive) {
                setExpandedState(!expandedState);
              } else {
                setActiveTab(tabId);
                setExpandedState(true);
              }
            };

            let submenu = null;
            if (item.id === 'inventory') {
              submenu = renderSubmenu(isInventoryExpanded, setIsInventoryExpanded, deviceTypes.map(dt => ({ id: dt.id, label: dt.name, icon: () => getDeviceIcon(dt.code) })), activeInventoryDeviceTypeId, onSelectInventoryCategory);
            } else if (item.id === 'unittree') {
              submenu = renderSubmenu(isNetworkExpanded, setIsNetworkExpanded, NETWORK_SUBVIEWS, networkSubView, onSelectNetworkSubView);
            } else if (item.id === 'emails') {
              submenu = renderSubmenu(isEmailExpanded, setIsEmailExpanded, EMAIL_SUBVIEWS, emailSubView, onSelectEmailSubView);
            }

            return (
              <div key={item.id} className="flex flex-col">
                <button
                  onClick={() => {
                    if (item.id === 'inventory') handleClick(isInventoryExpanded, setIsInventoryExpanded, item.id);
                    else if (item.id === 'unittree') handleClick(isNetworkExpanded, setIsNetworkExpanded, item.id);
                    else if (item.id === 'emails') handleClick(isEmailExpanded, setIsEmailExpanded, item.id);
                    else setActiveTab(item.id);
                  }}
                  className={`nav-item w-full flex items-center justify-between ${isActive ? 'active' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="icon-sm">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[14px]">{item.label}</span>
                  </div>
                  {(item.id === 'inventory' || item.id === 'unittree' || item.id === 'emails') && (
                    <div className="text-[var(--color-text-muted)]">
                      { (item.id === 'inventory' ? isInventoryExpanded : item.id === 'unittree' ? isNetworkExpanded : isEmailExpanded) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}
                </button>
                {submenu}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Help Card replacement */}
      <div className="p-4">
        <div className="card-soft p-4 relative overflow-hidden">
          <div className="w-8 h-8 bg-[var(--color-page)] rounded-lg flex items-center justify-center mb-3">
            <Hexagon className="w-4 h-4 text-[var(--color-dark)]" />
          </div>
          <h6 className="text-[14px] font-bold text-[var(--color-title)] mb-1">Hệ thống CCDC online</h6>
          <p className="text-[12px] text-[var(--color-body)] mb-4">Database SQLite / Prisma 3NF</p>
          <a href="#" className="btn btn-dark w-full">TÀI LIỆU HƯỚNG DẪN</a>
        </div>
      </div>
    </aside>
  );
}
