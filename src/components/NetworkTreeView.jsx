import React, { useEffect, useState } from 'react';
import {
  Building2,
  MapPin,
  Monitor,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  CheckCircle,
  AlertCircle,
  Cpu
} from 'lucide-react';

// ==========================================
// "Cây Thư Mục" — submenu con của "Quản Lý Mạng Lưới" (feat/network-submenu-restructure).
// Đây là code cây tổ chức READ-ONLY GỐC (BĐT/TP -> BĐX -> Bưu cục), khôi phục nguyên
// vẹn từ lịch sử Git commit 93cc342 (trước khi bị UnitTreeView.jsx cũ ghi đè thành bảng
// CRUD ở feat/network-management-frontend). CHỈ đổi tên component cho khớp cấu trúc file
// mới (UnitTreeView -> NetworkTreeView), không đổi logic/JSX bên trong.
// ==========================================
export default function NetworkTreeView({ onSelectUnitFilter }) {
  const [treeData, setTreeData] = useState(null);
  const [expandedCommunes, setExpandedCommunes] = useState({});
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/organization/tree')
      .then(res => res.json())
      .then(data => {
        setTreeData(data);
        // Expand first 5 communes by default
        const initialExpanded = {};
        if (data.communes) {
          data.communes.slice(0, 5).forEach(c => {
            initialExpanded[c.id] = true;
          });
        }
        setExpandedCommunes(initialExpanded);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  const toggleCommune = (id) => {
    setExpandedCommunes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[500px] gap-3">
        <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Đang nạp sơ đồ cây đơn vị Bưu điện Xã...</p>
      </div>
    );
  }

  const filteredCommunes = treeData.communes.filter(c => {
    if (!filterText) return true;
    const matchCommune = c.name.toLowerCase().includes(filterText.toLowerCase()) || c.code.includes(filterText);
    const matchUnits = c.units.some(u => u.name.toLowerCase().includes(filterText.toLowerCase()) || u.code.includes(filterText));
    return matchCommune || matchUnits;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Title Header */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <span>Sơ Đồ Cây Đơn Vị Tổ Chức (BĐT/TP ➔ BĐX ➔ Bưu Cục)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Phân cấp Bưu điện Tỉnh Huế ➔ 43 Bưu điện Xã (BĐX) ➔ 206 Bưu cục (MBC)</p>
        </div>

        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tìm tên BĐX hoặc tên Bưu cục..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs glass-input"
          />
        </div>
      </div>

      {/* Tree Explorer Container */}
      <div className="glass-panel p-6 rounded-2xl space-y-3">
        {/* Root Node: BĐTP Huế */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-cyan-950/40 border border-cyan-500/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-base text-white flex items-center gap-2">
                <span>{treeData.name}</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[11px] font-mono border border-cyan-500/30">
                  Mã {treeData.code}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Cấp quản lý cao nhất • {treeData.communes.length} Bưu điện Xã • {treeData.communes.reduce((s, c) => s + c.total_assets, 0)} thiết bị CCDC
              </div>
            </div>
          </div>
        </div>

        {/* Level 2 Nodes: BĐX Communes */}
        <div className="pl-6 space-y-3 border-l-2 border-slate-800 ml-5 mt-4">
          {filteredCommunes.map((commune) => {
            const isExpanded = expandedCommunes[commune.id];

            return (
              <div key={commune.id} className="space-y-2">
                {/* Commune Card Header */}
                <div
                  onClick={() => toggleCommune(commune.id)}
                  className="p-3.5 rounded-xl glass-card flex items-center justify-between cursor-pointer hover:border-cyan-500/40 group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 group-hover:text-cyan-400 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <MapPin className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <span>{commune.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                          {commune.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Quản lý {commune.units.length} Bưu cục MBC
                      </div>
                    </div>
                  </div>

                  {/* Asset Counter Badge */}
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{commune.total_assets} máy</span>
                    </span>
                  </div>
                </div>

                {/* Level 3 Nodes: Bưu cục MBC under Commune */}
                {isExpanded && (
                  <div className="pl-8 space-y-2 border-l-2 border-cyan-900/40 ml-4 py-1">
                    {commune.units.map((unit) => (
                      <div
                        key={unit.id}
                        onClick={() => onSelectUnitFilter(commune.id, unit.id)}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 flex items-center justify-between cursor-pointer transition-all group hover:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-700">
                            {unit.type || 'GD'}
                          </div>

                          <div>
                            <div className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                              <span>{unit.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">({unit.code})</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[280px]">
                              {unit.address || 'Địa chỉ chi tiết bưu cục'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {unit.has_computer === 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Điểm chưa có máy</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>{unit.asset_count} CCDC</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
