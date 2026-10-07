import React from 'react';
import { 
  Monitor, CheckCircle2, MapPin, AlertTriangle, AlertCircle, Mail
} from 'lucide-react';

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
    case 'TRANSFER': return 'bg-[#0EA5E9]';
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

const byAgeBuckets = {
  'BEFORE_2015': { label: 'Trước 2015', color: 'bg-red-500' },
  'Y2015_2018': { label: '2015–2018', color: 'bg-yellow-500' },
  'Y2019_2021': { label: '2019–2021', color: 'bg-[#0EA5E9]' },
  'Y2022_PLUS': { label: '2022 trở lại', color: 'bg-green-500' }
};

export function KpiSummary({ stats }) {
  const { summary = {}, warnings = {} } = stats;
  const totalAssets = summary.totalAssets || 0;
  const activePercent = totalAssets > 0 ? Math.round(((summary.activeAssets || 0) / totalAssets) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      <div className="bg-[#F97316] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white w-full h-full">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-[12px] bg-white/20 flex items-center justify-center">
            <Monitor className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold opacity-90">100%</span>
        </div>
        <div className="mt-4">
          <h3 className="text-[28px] font-bold">{totalAssets}</h3>
          <p className="text-sm font-medium opacity-90 mb-1">Tổng thiết bị</p>
          <p className="text-[12px] opacity-100 font-medium">Hỏng/bảo trì: {summary.brokenOrMaintenanceCount || 0}</p>
        </div>
      </div>

      <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white w-full h-full">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold opacity-90">{activePercent}%</span>
        </div>
        <div className="mt-4">
          <h3 className="text-[28px] font-bold">{summary.activeAssets || 0}</h3>
          <p className="text-sm font-medium opacity-90 mb-1">Đang hoạt động</p>
          <p className="text-[12px] opacity-100 font-medium">Trong kho: {summary.inStockCount || 0}</p>
        </div>
      </div>

      <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white w-full h-full">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold opacity-90">{summary.totalPostOffices || 0} MBC</span>
        </div>
        <div className="mt-4">
          <h3 className="text-[28px] font-bold">
            {summary.totalCommunes || 0}
          </h3>
          <p className="text-sm font-medium opacity-90 mb-1">BĐX / bưu cục</p>
          <p className="text-[12px] opacity-100 font-medium">Chưa có máy: {summary.emptyPostOffices || 0}</p>
        </div>
      </div>

      <div className="bg-[#27272A] rounded-[12px] p-5 shadow-[0_20px_27px_rgba(0,0,0,.05)] flex flex-col justify-between text-white w-full h-full">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-[12px] bg-white/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#F97316]" />
          </div>
          <span className="text-sm font-semibold text-[#F97316]">+ Rủi ro</span>
        </div>
        <div className="mt-4">
          <h3 className="text-[28px] font-bold">{summary.lowSpecCount || 0}</h3>
          <p className="text-sm font-medium opacity-90 mb-1 text-[#F97316]">Cảnh báo cấu hình</p>
          <p className="text-[12px] opacity-100 font-medium">MAC {warnings.missingMac || 0} &middot; IP {warnings.missingIp || 0} &middot; Win7 {warnings.win7Count || 0}</p>
        </div>
      </div>
    </div>
  );
}

export function ItWarnings({ title, stats }) {
  const { summary = {}, warnings = {} } = stats;
  const totalAssets = summary.totalAssets || 0;

  return (
    <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 h-full flex flex-col justify-between">
      <div>
        <h6 className="font-bold text-gray-800 text-base mb-6">{title || 'Cảnh báo & rủi ro IT'}</h6>
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
  );
}

export function UpgradeRequired({ title, stats }) {
  const { summary = {}, upgrade = {} } = stats;
  const totalAssets = summary.totalAssets || 0;

  return (
    <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 h-full">
      <h6 className="font-bold text-gray-800 text-base mb-6">{title || 'Thiết bị cần nâng cấp / thay thế'}</h6>
      
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
  );
}

export function RecentActivity({ title, stats }) {
  const { recentActivity = [] } = stats;

  return (
    <div className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 h-full flex flex-col">
      <h6 className="font-bold text-gray-800 text-base mb-4">{title || 'Hoạt động gần đây'}</h6>
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
                      {act.fromPostOffice && act.toPostOffice 
                        ? `từ ${act.fromPostOffice} \u2192 ${act.toPostOffice}` 
                        : act.fromPostOffice 
                          ? `từ ${act.fromPostOffice}` 
                          : `\u2192 ${act.toPostOffice}`}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function EmailStats({ title, stats, onNavigateToEmails }) {
  const { emails = {} } = stats;

  return (
    <div 
      className="bg-white rounded-[12px] shadow-[0_20px_27px_rgba(0,0,0,.05)] p-5 cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col justify-center"
      onClick={onNavigateToEmails}
    >
      <div className="flex items-center justify-between mb-4">
        <h6 className="font-bold text-gray-800 text-base flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#0EA5E9]" />
          {title || 'Email công vụ'}
        </h6>
        <span className="text-sm text-[#0284C7] font-medium hover:underline">Quản lý email &rarr;</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
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
        <div className="p-3 bg-[#F0F9FF] rounded-lg">
          <div className="text-xs text-[#0369A1] font-medium mb-1">Của đơn vị</div>
          <div className="text-xl font-bold text-[#0369A1]">{emails.unit || 0}</div>
        </div>
        <div className="p-3 bg-[#F4F4F5] rounded-lg">
          <div className="text-xs text-[#27272A] font-medium mb-1">Của cá nhân</div>
          <div className="text-xl font-bold text-[#27272A]">{emails.personal || 0}</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <div className="text-xs text-orange-700 font-medium mb-1">Mới tạo (tháng)</div>
          <div className="text-xl font-bold text-orange-700">{emails.createdThisMonth || 0}</div>
        </div>
      </div>
    </div>
  );
}
