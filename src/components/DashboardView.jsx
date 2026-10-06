import React, { useEffect, useState } from 'react';
import { 
  Monitor, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
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
import { apiFetch } from '../utils/api';

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
        <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-[var(--color-text-muted)]">Đang tải số liệu KPI CCDC...</p>
      </div>
    );
  }

  const COLORS = ['#F97316', '#17C1E8', '#82D616', '#FB9752', '#344767', '#9FA0A5'];

  return (
    <div className="p-6 space-y-6">

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Assets (Orange) */}
        <div className="card-soft p-4 flex flex-col justify-between" style={{ backgroundColor: 'var(--color-accent)' }}>
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white">
              <Monitor className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white/80">Tỷ lệ 100%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold text-white leading-none">{stats.summary.totalAssets}</h3>
            <p className="text-sm text-white/80 mt-1 font-medium">Tổng Thiết Bị CCDC</p>
          </div>
        </div>

        {/* Active Equipments (Dark) */}
        <div className="card-soft p-4 flex flex-col justify-between" style={{ backgroundColor: 'var(--color-kpi-dark)' }}>
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white/60">{Math.round((stats.summary.activeAssets / stats.summary.totalAssets) * 100)}%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold text-white leading-none">{stats.summary.activeAssets}</h3>
            <p className="text-sm text-white/60 mt-1 font-medium">Đang Hoạt Động</p>
          </div>
        </div>

        {/* Total Communes (Dark) */}
        <div className="card-soft p-4 flex flex-col justify-between" style={{ backgroundColor: 'var(--color-kpi-dark)' }}>
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-white/60">{stats.summary.totalPostOffices} MBC</span>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold text-white leading-none">{stats.summary.totalCommunes}</h3>
            <p className="text-sm text-white/60 mt-1 font-medium">Bưu Điện Xã (BĐX)</p>
          </div>
        </div>

        {/* Low Spec Warning (Dark) */}
        <div className="card-soft p-4 flex flex-col justify-between" style={{ backgroundColor: 'var(--color-kpi-dark)' }}>
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-[var(--color-accent)]">+ Rủi ro</span>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold text-white leading-none">{stats.summary.lowSpecCount}</h3>
            <p className="text-sm text-white/60 mt-1 font-medium">Cảnh Báo Cấu Hình</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 card-soft p-5">
          <div className="mb-4">
            <h6 className="text-base font-bold text-[var(--color-kpi-dark)]">Thiết Bị Theo Bưu Điện Xã</h6>
            <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />
              <span className="font-semibold text-[var(--color-kpi-dark)]">Đã cập nhật</span> hôm nay
            </p>
          </div>
          <div className="h-72 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.charts.assetsByCommune} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="var(--color-text-muted)" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 20px 27px 0 rgba(0,0,0,0.05)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                />
                <Bar dataKey="assetCount" name="Số lượng" fill="var(--color-kpi-dark)" radius={[4, 4, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cảnh Báo IT (như khối Reviews của Soft UI) */}
        <div className="card-soft p-5 flex flex-col justify-between">
          <div>
            <h6 className="text-base font-bold text-[var(--color-kpi-dark)]">Cảnh Báo & Rủi Ro IT</h6>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">Thống kê điểm yếu hệ thống</p>
            
            <div className="space-y-6">
              {/* Review item 1 */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-[var(--color-kpi-dark)]">Thiếu địa chỉ MAC / Khai báo thô</span>
                  <span className="font-bold text-[var(--color-accent)]">{stats.warnings.missingMac} máy</span>
                </div>
                <div className="w-full bg-[var(--color-progress)] rounded-full h-1.5">
                  <div className="bg-[var(--color-accent)] h-1.5 rounded-full" style={{ width: `${Math.min((stats.warnings.missingMac/stats.summary.totalAssets)*100, 100)}%` }}></div>
                </div>
              </div>

              {/* Review item 2 */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-[var(--color-kpi-dark)]">Thiếu địa chỉ IP tĩnh</span>
                  <span className="font-bold text-[var(--color-blue)]">{stats.warnings.missingIp} máy</span>
                </div>
                <div className="w-full bg-[var(--color-progress)] rounded-full h-1.5">
                  <div className="bg-[var(--color-blue)] h-1.5 rounded-full" style={{ width: `${Math.min((stats.warnings.missingIp/stats.summary.totalAssets)*100, 100)}%` }}></div>
                </div>
              </div>

              {/* Review item 3 */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-[var(--color-kpi-dark)]">Máy dùng Windows 7</span>
                  <span className="font-bold text-[var(--color-kpi-dark)]">{stats.warnings.win7Count} máy</span>
                </div>
                <div className="w-full bg-[var(--color-progress)] rounded-full h-1.5">
                  <div className="bg-[var(--color-kpi-dark)] h-1.5 rounded-full" style={{ width: `${Math.min((stats.warnings.win7Count/stats.summary.totalAssets)*100, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          <button className="btn-outline-accent w-full mt-6">XEM CHI TIẾT CẢNH BÁO</button>
        </div>
      </div>
    </div>
  );
}
