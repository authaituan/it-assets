import React, { useEffect, useState } from 'react';
import { 
  Monitor, CheckCircle2, MapPin, AlertTriangle, RefreshCw, AlertCircle, Mail
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  PieChart, Pie, Legend
} from 'recharts';
import { apiFetch } from '../utils/api';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `${diffMins || 1} phút trước`;
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} giờ trước`;
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays === 1) return 'Hôm qua';
  return `${diffDays} ngày trước`;
}

const getActivityColor = (action) => {
  switch (action) {
    case 'TRANSFER': return 'bg-blue-500';
    case 'ASSIGN': return 'bg-green-500';
    case 'MAINTENANCE': return 'bg-yellow-500';
    case 'RECLAIM': return 'bg-red-500';
    case 'CREATE':
    case 'UPDATE': return 'bg-orange-500';
    case 'HRM_SYNC': return 'bg-gray-500';
    default: return 'bg-gray-300';
  }
};

const getActivityLabel = (action) => {
  switch (action) {
    case 'TRANSFER': return 'Điều chuyển';
    case 'ASSIGN': return 'Giao';
    case 'MAINTENANCE': return 'Bảo trì';
    case 'RECLAIM': return 'Thu hồi';
    case 'CREATE': return 'Tạo mới';
    case 'UPDATE': return 'Cập nhật';
    case 'HRM_SYNC': return 'Đồng bộ HRM';
    default: return 'Hoạt động';
  }
};

export default function DashboardView({ onSelectCommune }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = () => {
    setLoading(true);
    setError(false);
    apiFetch('/api/dashboard/stats')
      .then(res => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading stats:", err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] gap-3">
        <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Đang tải số liệu Dashboard...</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <p className="text-sm text-gray-600 font-medium">Không thể tải dữ liệu Dashboard.</p>
        <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity">
          <RefreshCw className="w-4 h-4" /> Thử lại
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { summary = {}, charts = {}, warnings = {}, upgrade = {}, recentActivity = [], emails = {} } = stats;

  const totalAssets = summary.totalAssets || 0;
  const activePercent = totalAssets > 0 ? Math.round(((summary.activeAssets || 0) / totalAssets) * 100) : 0;
  const maxAssetByCommune = charts.assetsByCommune?.length ? Math.max(...charts.assetsByCommune.map(d => d.assetCount || 0)) : 0;

  let donutData = (charts.assetsByType || []).filter(d => d.count > 0);
  if (donutData.length > 5) {
    const top4 = donutData.slice(0, 4);
    const others = donutData.slice(4).reduce((sum, item) => sum + item.count, 0);
    if (others > 0) {
      top4.push({ name: 'Khác', count: others });
    }
    donutData = top4;
  }
  const donutColors = ['#F97316', '#0EA5E9', '#82D616', '#F43F5E', '#8B5CF6', '#64748B'];

  const statusLabels = {
    'IN_USE': 'Đang sử dụng',
    'IN_STOCK': 'Trong kho',
    'MAINTENANCE': 'Bảo trì',
    'BROKEN': 'Hỏng',
    'LIQUIDATED': 'Thanh lý'
  };

  const byAgeBuckets = {
    'BEFORE_2015': { label: 'Trước 2015', color: 'bg-red-500' },
    'Y2015_2018': { label: '2015–2018', color: 'bg-yellow-500' },
    'Y2019_2021': { label: '2019–2021', color: 'bg-blue-500' },
    'Y2022_PLUS': { label: '2022 trở lại', color: 'bg-green-500' }
  };

  const navigateToEmails = () => {
    document.getElementById('nav-emails')?.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans" style={{ fontFamily: 'Inter, sans-serif' }}>
      {loading && (
        <div className="fixed top-24 right-6 bg-white shadow-lg rounded-full p-2 z-50 animate-pulse">
          <RefreshCw className="w-5 h-5 text-[#F97316] animate-spin" />
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#F97316] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[12px] bg-white/20 flex items-center justify-center">
              <Monitor className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold">{totalAssets}</h3>
            <p className="text-sm font-medium opacity-90 mb-1">Tổng thiết bị</p>
            <p className="text-xs opacity-80">Hỏng/bảo trì: {summary.brokenOrMaintenanceCount || 0}</p>
          </div>
        </div>

        <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold opacity-60">{activePercent}%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold">{summary.activeAssets || 0}</h3>
            <p className="text-sm font-medium opacity-90 mb-1">Đang hoạt động</p>
            <p className="text-xs opacity-60">Trong kho: {summary.inStockCount || 0}</p>
          </div>
        </div>

        <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold">
              {summary.totalCommunes || 0} <span className="text-lg opacity-80 font-medium">/ {summary.totalPostOffices || 0}</span>
            </h3>
            <p className="text-sm font-medium opacity-90 mb-1">BĐX / bưu cục</p>
            <p className="text-xs opacity-60">Chưa có máy: {summary.emptyPostOffices || 0}</p>
          </div>
        </div>

        <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#F97316]" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-[28px] font-bold">{summary.lowSpecCount || 0}</h3>
            <p className="text-sm font-medium opacity-90 mb-1 text-[#F97316]">Cảnh báo cấu hình</p>
            <p className="text-xs opacity-60">MAC {warnings.missingMac || 0} &middot; IP {warnings.missingIp || 0} &middot; Win7 {warnings.win7Count || 0}</p>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[360px] flex flex-col">
          <h6 className="font-bold text-gray-800 text-base mb-4">Thiết bị theo BĐX / bưu cục</h6>
          <div className="flex-1 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.assetsByCommune || []} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fill: '#6B7280', fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={false} 
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Bar dataKey="assetCount" name="Số lượng" radius={[6, 6, 0, 0]} maxBarSize={32}>
                  {(charts.assetsByCommune || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.assetCount === maxAssetByCommune && entry.assetCount > 0 ? '#F97316' : '#0EA5E9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[360px] flex flex-col justify-between">
          <div>
            <h6 className="font-bold text-gray-800 text-base mb-6">Cảnh báo & rủi ro IT</h6>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-1.5 gap-2">
                  <span className="font-medium text-gray-700 truncate">Thiếu địa chỉ MAC</span>
                  <span className="font-bold text-[#F97316]">{warnings.missingMac || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#F97316]" style={{ width: `${Math.min(((warnings.missingMac || 0)/Math.max(totalAssets,1))*100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5 gap-2">
                  <span className="font-medium text-gray-700 truncate">Thiếu địa chỉ IP tĩnh</span>
                  <span className="font-bold text-[#0EA5E9]">{warnings.missingIp || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0EA5E9]" style={{ width: `${Math.min(((warnings.missingIp || 0)/Math.max(totalAssets,1))*100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5 gap-2">
                  <span className="font-medium text-gray-700 truncate">Windows 7 lỗi thời</span>
                  <span className="font-bold text-[#27272A]">{warnings.win7Count || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#27272A]" style={{ width: `${Math.min(((warnings.win7Count || 0)/Math.max(totalAssets,1))*100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5 gap-2">
                  <span className="font-medium text-gray-700 truncate">Cấu hình thấp</span>
                  <span className="font-bold text-red-500">{summary.lowSpecCount || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${Math.min(((summary.lowSpecCount || 0)/Math.max(totalAssets,1))*100, 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full mt-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
            XEM CHI TIẾT CẢNH BÁO
          </button>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[300px]">
          <h6 className="font-bold text-gray-800 text-base mb-4">Theo loại thiết bị</h6>
          {donutData.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    stroke="none"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">Không có dữ liệu</div>
          )}
        </div>

        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[300px]">
          <h6 className="font-bold text-gray-800 text-base mb-6">Theo trạng thái</h6>
          <div className="space-y-4">
            {(charts.assetsByStatus || []).map((s, idx) => {
              const p = totalAssets > 0 ? (s.count / totalAssets) * 100 : 0;
              return (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700">{statusLabels[s.status] || s.status}</span>
                    <span className="font-semibold text-gray-900">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${p}%` }}></div>
                  </div>
                </div>
              );
            })}
            {!(charts.assetsByStatus?.length) && <div className="text-sm text-gray-400 text-center py-8">Không có dữ liệu</div>}
          </div>
        </div>

        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[300px]">
          <h6 className="font-bold text-gray-800 text-base mb-4">Theo hãng (Top 6)</h6>
          <div className="space-y-3">
            {(charts.assetsByBrand || []).slice(0, 6).map((b, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-700 truncate mr-2">{b.brand || 'Khác'}</span>
                <span className="text-sm font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{b.count}</span>
              </div>
            ))}
            {!(charts.assetsByBrand?.length) && <div className="text-sm text-gray-400 text-center py-8">Không có dữ liệu</div>}
          </div>
        </div>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[300px]">
          <h6 className="font-bold text-gray-800 text-base mb-6">Thiết bị cần nâng cấp / thay thế</h6>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
              <div className="text-2xl font-bold text-red-600 mb-1">{upgrade.lowRamCount || 0}</div>
              <div className="text-xs font-medium text-red-800">RAM &le; 4GB</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
              <div className="text-2xl font-bold text-orange-600 mb-1">{upgrade.hddOnlyCount || 0}</div>
              <div className="text-xs font-medium text-orange-800">Chỉ có HDD</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
              <div className="text-2xl font-bold text-gray-700 mb-1">{upgrade.missingPurchaseYear || 0}</div>
              <div className="text-xs font-medium text-gray-600">Chưa có năm</div>
            </div>
          </div>

          <h6 className="text-sm font-semibold text-gray-700 mb-3 block">Độ tuổi thiết bị</h6>
          <div className="space-y-4">
            {(upgrade.byAge || []).map((b, idx) => {
              const bucket = byAgeBuckets[b.bucket] || { label: b.bucket, color: 'bg-gray-400' };
              const p = totalAssets > 0 ? (b.count / totalAssets) * 100 : 0;
              return (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-600">{bucket.label}</span>
                    <span className="font-semibold text-gray-800">{b.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${bucket.color}`} style={{ width: `${p}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 min-h-[300px] flex flex-col">
          <h6 className="font-bold text-gray-800 text-base mb-4">Hoạt động gần đây</h6>
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[320px]">
            {recentActivity.length === 0 ? (
              <div className="text-sm text-gray-400 h-full flex items-center justify-center">Chưa có hoạt động</div>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex gap-3">
                  <div className="mt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${getActivityColor(act.action)}`}></div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-800">{getActivityLabel(act.action)}</span>
                      <span className="text-xs text-gray-500">{formatRelativeTime(act.at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {act.assetTag || act.hostname || 'Thiết bị'}
                      {(act.fromPostOffice || act.toPostOffice) && (
                        <span className="text-gray-400 mx-1">
                          từ {act.fromPostOffice || '?'} &rarr; {act.toPostOffice || '?'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 5 */}
      <div 
        className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 cursor-pointer hover:shadow-md transition-shadow"
        onClick={navigateToEmails}
      >
        <div className="flex items-center justify-between mb-4">
          <h6 className="font-bold text-gray-800 text-base flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            Email công vụ
          </h6>
          <span className="text-sm text-blue-600 font-medium hover:underline">Quản lý email &rarr;</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 font-medium mb-1">Tổng số</div>
            <div className="text-xl font-bold text-gray-800">{emails.total || 0}</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-green-700 font-medium mb-1">Đang sử dụng</div>
            <div className="text-xl font-bold text-green-700">{emails.active || 0}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-xs text-red-700 font-medium mb-1">Đã thu hồi</div>
            <div className="text-xl font-bold text-red-700">{emails.revoked || 0}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-700 font-medium mb-1">Của đơn vị</div>
            <div className="text-xl font-bold text-blue-700">{emails.unit || 0}</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-purple-700 font-medium mb-1">Của cá nhân</div>
            <div className="text-xl font-bold text-purple-700">{emails.personal || 0}</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-xs text-orange-700 font-medium mb-1">Mới tạo (tháng)</div>
            <div className="text-xl font-bold text-orange-700">{emails.createdThisMonth || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
