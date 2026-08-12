import React, { useEffect, useState } from 'react';
import { 
  Monitor, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  MapPin, 
  Layers, 
  WifiOff, 
  ShieldAlert, 
  Sparkles,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function DashboardView({ onSelectCommune }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error("Error loading stats:", err));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] gap-3">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Đang tải số liệu KPI CCDC...</p>
      </div>
    );
  }

  const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#34d399', '#fbbf24'];

  return (
    <div className="p-6 space-y-6">
      {/* Page Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Tổng Quan CCDC IT Bưu Điện</h1>
          <p className="text-xs text-slate-400 mt-1">Báo cáo thống kê tình trạng thiết bị theo Bưu điện Xã (BĐX) & Bưu cục (MBC)</p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Dữ liệu thực tế: 359 bản ghi</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tổng Thiết Bị CCDC</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Monitor className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{stats.summary.totalAssets}</span>
            <span className="text-xs font-medium text-cyan-400">thiết bị</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Quản lý tại 43 Bưu điện Xã</p>
        </div>

        {/* Active Equipments */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Đang Hoạt Động</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{stats.summary.activeAssets}</span>
            <span className="text-xs font-medium text-slate-400">/ {stats.summary.totalAssets}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Tỷ lệ sử dụng {Math.round((stats.summary.activeAssets / stats.summary.totalAssets) * 100)}%</p>
        </div>

        {/* Total BĐX Communes */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bưu Điện Xã (BĐX)</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-400 tracking-tight">{stats.summary.totalCommunes}</span>
            <span className="text-xs font-medium text-slate-400">xã/phường</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Quản lý {stats.summary.totalPostOffices} Bưu cục MBC</p>
        </div>

        {/* Low Spec Warning */}
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group border-amber-500/20">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">Cảnh Báo Cấu Hình Thấp</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400 tracking-tight">{stats.summary.lowSpecCount}</span>
            <span className="text-xs font-medium text-slate-400">máy</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">RAM ≤ 4GB hoặc chỉ có HDD</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: CCDC by BĐX Commune (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Top Bưu Điện Xã Cấu Hình Nhiều Thiết Bị Nhất</h3>
              <p className="text-xs text-slate-400">Số lượng máy tính trang bị theo từng BĐX</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.assetsByCommune} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="assetCount" name="Số lượng CCDC" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Assets by Brand */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Tỷ Lệ Hãng Sản Xuất</h3>
            <p className="text-xs text-slate-400 mb-4">Dell, HP, Posbank, ASUS...</p>
            
            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.charts.assetsByBrand}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="count"
                    nameKey="brandName"
                  >
                    {stats.charts.assetsByBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend list */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            {stats.charts.assetsByBrand.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="text-slate-300 truncate max-w-[90px]">{item.brandName}</span>
                <span className="font-bold text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IT Risks & Security Warning Cards */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-rose-400">
          <ShieldAlert className="w-5 h-5" />
          <h3 className="text-base font-bold text-white">Cảnh Báo & Rủi Ro Hạ Tầng IT</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.warnings.missingMac}</div>
              <div className="text-xs text-slate-400">Thiếu địa chỉ MAC / Khái báo thô</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.warnings.missingIp}</div>
              <div className="text-xs text-slate-400">Thiếu địa chỉ IP tĩnh Bưu điện</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.warnings.win7Count}</div>
              <div className="text-xs text-slate-400">Máy dùng Windows 7 lỗi thời</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
