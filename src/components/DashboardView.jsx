import React, { useEffect, useState } from 'react';
import { 
  Monitor, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  WifiOff, 
  ShieldAlert, 
  Cpu
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
import { apiFetch } from '../utils/api';
import { CHART_COLORS, AXIS, GRID, BORDER } from '../utils/chartColors';

export default function DashboardView({ onSelectCommune }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/dashboard/stats')
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
        <div className="w-10 h-10 border-4 border-surface-alt border-t-primary rounded-full animate-spin"></div>
        <p className="text-[14px] text-muted">Đang tải số liệu KPI CCDC...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-surface">
      {/* Page Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink tracking-wide">Tổng Quan CCDC IT Bưu Điện</h1>
          <p className="text-[14px] text-muted mt-1">Báo cáo thống kê tình trạng thiết bị theo Bưu điện Xã (BĐX) & Bưu cục (MBC)</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="p-5 bg-primary relative">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-white uppercase tracking-[0.05em]">Tổng Thiết Bị CCDC</span>
            <div className="w-9 h-9 bg-white flex items-center justify-center">
              <Monitor className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[44px] font-extrabold text-white tracking-tight leading-[1.1]">{stats.summary.totalAssets}</span>
            <span className="text-[13px] font-bold text-white">thiết bị</span>
          </div>
          <p className="text-[13px] font-bold text-white mt-2 opacity-90">Quản lý tại 43 Bưu điện Xã</p>
        </div>

        {/* Active Equipments */}
        <div className="p-5 bg-success relative">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-ink uppercase tracking-[0.05em]">Đang Hoạt Động</span>
            <div className="w-9 h-9 bg-white flex items-center justify-center">
              <CheckCircle2 className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[44px] font-extrabold text-ink tracking-tight leading-[1.1]">{stats.summary.activeAssets}</span>
            <span className="text-[13px] font-bold text-ink">/ {stats.summary.totalAssets}</span>
          </div>
          <p className="text-[13px] font-bold text-ink mt-2 opacity-90">Tỷ lệ sử dụng {Math.round((stats.summary.activeAssets / stats.summary.totalAssets) * 100)}%</p>
        </div>

        {/* Total BĐX Communes */}
        <div className="p-5 bg-accent relative">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-ink uppercase tracking-[0.05em]">Bưu Điện Xã (BĐX)</span>
            <div className="w-9 h-9 bg-white flex items-center justify-center">
              <MapPin className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[44px] font-extrabold text-ink tracking-tight leading-[1.1]">{stats.summary.totalCommunes}</span>
            <span className="text-[13px] font-bold text-ink">xã/phường</span>
          </div>
          <p className="text-[13px] font-bold text-ink mt-2 opacity-90">Quản lý {stats.summary.totalPostOffices} Bưu cục MBC</p>
        </div>

        {/* Low Spec Warning */}
        <div className="p-5 bg-danger relative">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold text-white uppercase tracking-[0.05em]">Cảnh Báo Cấu Hình Thấp</span>
            <div className="w-9 h-9 bg-white flex items-center justify-center">
              <AlertTriangle className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-[44px] font-extrabold text-white tracking-tight leading-[1.1]">{stats.summary.lowSpecCount}</span>
            <span className="text-[13px] font-bold text-white">máy</span>
          </div>
          <p className="text-[13px] font-bold text-white mt-2 opacity-90">RAM ≤ 4GB hoặc chỉ có HDD</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: CCDC by BĐX Commune (2 Cols) */}
        <div className="lg:col-span-2 bg-surface border-2 border-info p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[17px] font-extrabold text-ink">Top Bưu Điện Xã Cấu Hình Nhiều Thiết Bị Nhất</h3>
              <p className="text-[14px] text-muted">Số lượng máy tính trang bị theo từng BĐX</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.assetsByCommune} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis 
                  dataKey="name" 
                  stroke={AXIS} 
                  fontSize={12} 
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke={AXIS} fontSize={12} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: '2px', borderRadius: '0', color: '#2D3436' }}
                  cursor={{ fill: GRID }}
                  itemStyle={{ color: '#2D3436' }}
                />
                <Bar dataKey="assetCount" name="Số lượng CCDC" fill="#4a69bd" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Assets by Brand */}
        <div className="bg-surface border-2 border-info p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-[17px] font-extrabold text-ink">Tỷ Lệ Hãng Sản Xuất</h3>
            <p className="text-[14px] text-muted mb-4">Dell, HP, Posbank, ASUS...</p>
            
            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.charts.assetsByBrand}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={0}
                    dataKey="count"
                    nameKey="brandName"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  >
                    {stats.charts.assetsByBrand.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: '2px', borderRadius: '0', color: '#2D3436' }} 
                    itemStyle={{ color: '#2D3436' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend list */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t-2 border-surface-alt">
            {stats.charts.assetsByBrand.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[13px]">
                <span className="w-3 h-3" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></span>
                <span className="text-ink font-bold truncate max-w-[90px]">{item.brandName}</span>
                <span className="font-extrabold text-ink ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IT Risks & Security Warning Cards */}
      <div className="bg-surface border-2 border-info p-6 space-y-4">
        <div className="flex items-center gap-2 text-ink">
          <ShieldAlert className="w-[18px] h-[18px] text-ink" strokeWidth={2} />
          <h3 className="text-[17px] font-extrabold text-ink">Cảnh Báo & Rủi Ro Hạ Tầng IT</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex bg-white border-2 border-info">
            <div className="w-16 h-16 bg-danger text-white flex items-center justify-center shrink-0">
              <span className="text-[24px] font-extrabold">{stats.warnings.missingMac}</span>
            </div>
            <div className="flex-1 p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1">
                <WifiOff className="w-[14px] h-[14px] text-ink" />
                <div className="text-[14px] font-bold text-ink">Thiếu địa chỉ MAC</div>
              </div>
              <div className="text-[12px] text-muted">Khai báo thô</div>
            </div>
          </div>

          <div className="flex bg-white border-2 border-info">
            <div className="w-16 h-16 bg-accent text-ink flex items-center justify-center shrink-0">
              <span className="text-[24px] font-extrabold">{stats.warnings.missingIp}</span>
            </div>
            <div className="flex-1 p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-[14px] h-[14px] text-ink" />
                <div className="text-[14px] font-bold text-ink">Thiếu IP tĩnh</div>
              </div>
              <div className="text-[12px] text-muted">Chưa quy hoạch IP Bưu điện</div>
            </div>
          </div>

          <div className="flex bg-white border-2 border-info">
            <div className="w-16 h-16 bg-success text-ink flex items-center justify-center shrink-0">
              <span className="text-[24px] font-extrabold">{stats.warnings.win7Count}</span>
            </div>
            <div className="flex-1 p-3 flex flex-col justify-center">
              <div className="flex items-center gap-1">
                <Cpu className="w-[14px] h-[14px] text-ink" />
                <div className="text-[14px] font-bold text-ink">Máy dùng Windows 7</div>
              </div>
              <div className="text-[12px] text-muted">Hệ điều hành lỗi thời</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
