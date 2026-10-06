import React, { useState } from 'react';
import { Download, X, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { apiFetchJson } from '../utils/api';
import { buildExportWorkbook } from '../utils/emailExcel';

async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportEmailModal({ onClose, filterParams, hasFilters }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportMode, setExportMode] = useState(hasFilters ? 'filtered' : 'all');

  const getFilterDescription = () => {
    if (!hasFilters) return 'Không có bộ lọc nào đang bật.';
    const parts = [];
    if (filterParams.search) parts.push(`Từ khoá "${filterParams.search}"`);
    if (filterParams.kind) parts.push(`Loại: ${filterParams.kind === 'UNIT' ? 'Đơn vị' : 'Cá nhân'}`);
    if (filterParams.status) parts.push(`Trạng thái: ${filterParams.status === 'ACTIVE' ? 'Đang sử dụng' : 'Đã thu hồi'}`);
    if (filterParams.communeId) parts.push('Có lọc Bưu điện xã');
    if (filterParams.postOfficeId) parts.push('Có lọc Bưu cục');
    return parts.join('; ');
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');

    const params = new URLSearchParams();
    if (exportMode === 'filtered') {
      if (filterParams.search) params.append('search', filterParams.search);
      if (filterParams.kind) params.append('kind', filterParams.kind);
      if (filterParams.status) params.append('status', filterParams.status);
      if (filterParams.communeId) params.append('communeId', filterParams.communeId);
      if (filterParams.postOfficeId) params.append('postOfficeId', filterParams.postOfficeId);
    }
    const query = params.toString();

    const result = await apiFetchJson(`/api/emails/export-data${query ? `?${query}` : ''}`);
    if (!result.ok) {
      setExporting(false);
      setError(result.error || 'Lỗi khi tải dữ liệu');
      return;
    }

    try {
      const items = result.data.items || [];
      if (items.length === 0) {
        setExporting(false);
        setError('Không có dữ liệu để xuất.');
        return;
      }

      const workbook = buildExportWorkbook(ExcelJS, items);
      
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const stamp = `${yyyy}${mm}${dd}-${hh}${min}`;
      
      await downloadWorkbook(workbook, `email-export-${stamp}.xlsx`);
      setExporting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setExporting(false);
      setError('Không tạo được file Excel: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="card-soft w-full max-w-lg overflow-hidden bg-white flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-[var(--color-title)] flex items-center gap-2">
            <Download className="w-5 h-5 text-[var(--color-primary)]" />
            <span>Export Email Ra Excel</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                exportMode === 'all'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="all"
                checked={exportMode === 'all'}
                onChange={() => setExportMode('all')}
                className="mt-0.5"
              />
              <div>
                <div className={`font-bold ${exportMode === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-title)]'}`}>
                  Toàn bộ danh sách email
                </div>
                <div className="text-[11px] text-[var(--color-subtext)] mt-0.5">
                  Xuất tất cả email trong hệ thống (bỏ qua mọi bộ lọc hiện tại).
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                !hasFilters ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : 
                exportMode === 'filtered'
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 cursor-pointer'
                  : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value="filtered"
                checked={exportMode === 'filtered'}
                onChange={() => setExportMode('filtered')}
                disabled={!hasFilters}
                className="mt-0.5"
              />
              <div>
                <div className={`font-bold flex items-center gap-1.5 ${exportMode === 'filtered' ? 'text-[var(--color-primary)]' : 'text-[var(--color-title)]'}`}>
                  <Filter className="w-3.5 h-3.5" />
                  Theo bộ lọc hiện tại
                </div>
                <div className="text-[11px] text-[var(--color-subtext)] mt-0.5">
                  {!hasFilters ? (
                    'Bạn chưa bật bộ lọc nào.'
                  ) : (
                    getFilterDescription()
                  )}
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-primary w-full py-3 text-[14px]"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{exporting ? 'Đang xuất file...' : 'Xuất File Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
