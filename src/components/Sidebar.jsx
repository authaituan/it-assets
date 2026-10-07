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
  Lock,
  LogOut
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import ChangePasswordModal from './ChangePasswordModal';

const NETWORK_SUBVIEWS = [
  { id: 'list', label: 'Danh Sách', icon: List },
  { id: 'tree', label: 'Cây Thư Mục', icon: FolderTree },
  { id: 'map', label: 'Bản Đồ Điểm Phục Vụ', icon: Map }
];

const EMAIL_SUBVIEWS = [
  { id: 'list', label: 'Danh sách', icon: List }
];

export default function Sidebar({ activeTab, setActiveTab, authUser, onLogout, activeInventoryDeviceTypeId, onSelectInventoryCategory, networkSubView, onSelectNetworkSubView, emailSubView, onSelectEmailSubView }) {
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [isNetworkExpanded, setIsNetworkExpanded] = useState(false);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Quản lý CCDC', icon: Monitor },
    { id: 'unittree', label: 'Quản lý mạng lưới', icon: Network },
    { id: 'emails', label: 'Quản lý email', icon: Mail },
  ];

  if (authUser?.role !== 'STAFF') {
    navItems.push({ id: 'personnel', label: 'Người sử dụng', icon: Users });
    navItems.push({ id: 'categoryadmin', label: 'Quản lý danh mục', icon: Layers });
    navItems.push({ id: 'useradmin', label: 'Quản lý người dùng', icon: UserCog });
  }

  return (
    <aside className="w-[250px] bg-transparent flex flex-col h-[calc(100vh-2rem)] sticky top-0 z-20 my-4 ml-4">
      {/* Brand Header */}
      <div className="shrink-0 h-16 px-6 flex items-center gap-3">
        <div className="w-[42px] h-[32px] rounded-[8px] bg-[#27272A] flex items-center justify-center shrink-0">
          <img src="/logo-vnpost.png" alt="Vietnam Post" className="w-[27px] object-contain" />
        </div>
        <span className="login-montserrat font-[800] text-[15px] tracking-[0.06em] text-[var(--color-title)] leading-none uppercase">IT-DRMS</span>
      </div>
        
      <hr className="shrink-0 h-px mt-0 bg-transparent bg-gradient-to-r from-transparent via-black/10 to-transparent border-none" />

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto min-h-0 nav-scrollbar pr-1">
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
              submenu = renderSubmenu(isNetworkExpanded, setIsNetworkExpanded, authUser?.role === 'STAFF' ? NETWORK_SUBVIEWS.filter((v) => v.id === 'tree') : NETWORK_SUBVIEWS, networkSubView, onSelectNetworkSubView);
            } else if (item.id === 'emails') {
              submenu = renderSubmenu(isEmailExpanded, setIsEmailExpanded, EMAIL_SUBVIEWS, emailSubView, onSelectEmailSubView);
            }

            return (
              <div key={item.id} className="flex flex-col">
                <button
                  id={`nav-${item.id}`}
                  onClick={() => {
                    if (item.id === 'inventory') handleClick(isInventoryExpanded, setIsInventoryExpanded, item.id);
                    else if (item.id === 'unittree') handleClick(isNetworkExpanded, setIsNetworkExpanded, item.id);
                    else if (item.id === 'emails') handleClick(isEmailExpanded, setIsEmailExpanded, item.id);
                    else setActiveTab(item.id);
                  }}
                  className={`nav-item w-full flex items-center justify-between ${isActive ? 'active' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="icon-sm shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[14px] whitespace-nowrap text-left truncate">{item.label}</span>
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

      {/* User Card */}
      <div className="shrink-0 p-4">
        <div className="card-soft p-4">
          {/* Row 1 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 shrink-0 rounded-full bg-[#CC4A0A] flex items-center justify-center font-bold text-white text-[14px]">
              {authUser?.full_name?.charAt(0) || authUser?.hrm_code?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[var(--color-title)] truncate">
                {authUser?.full_name || authUser?.hrm_code || 'Người dùng'}
              </div>
              <div className="text-[11px] text-[var(--color-subtext)] font-medium mt-0.5 truncate">
                {authUser?.role === 'STAFF' ? 'Nhân viên (chỉ xem)' : 'Quản lý'}
              </div>
            </div>
          </div>
          {/* Row 2 */}
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-gray-200 text-[12px] font-medium text-[var(--color-body)] transition-colors hover:bg-orange-50 hover:text-[#CC4A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4A0A]/50"
              title="Đổi mật khẩu"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="truncate">Đổi mật khẩu</span>
            </button>
            <button 
              type="button"
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-gray-200 text-[12px] font-medium text-[var(--color-body)] transition-colors hover:bg-orange-50 hover:text-[#CC4A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4A0A]/50"
              title="Đăng xuất"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="truncate">Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </aside>
  );
}
