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
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-info w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-5 border-b-2 border-surface-alt flex items-center justify-between shrink-0">
          <h3 className="font-extrabold text-[18px] text-ink">
            Export Email Ra Excel
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-colors ${
                exportMode === 'all'
                  ? 'border-primary bg-sky/20'
                  : 'border-surface-alt hover:bg-sidebar'
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
                <div className={`font-bold text-[14px] ${exportMode === 'all' ? 'text-primary' : 'text-ink'}`}>
                  Toàn bộ danh sách email
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  Xuất tất cả email trong hệ thống (bỏ qua mọi bộ lọc hiện tại).
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 border-2 transition-colors ${
                !hasFilters ? 'opacity-50 cursor-not-allowed border-surface-alt' : 
                exportMode === 'filtered'
                  ? 'border-primary bg-sky/20 cursor-pointer'
                  : 'border-surface-alt hover:bg-sidebar cursor-pointer'
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
                <div className={`font-bold text-[14px] flex items-center gap-1.5 ${exportMode === 'filtered' ? 'text-primary' : 'text-ink'}`}>
                  <Filter className="w-4 h-4" />
                  Theo bộ lọc hiện tại
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  {!hasFilters ? (
                    'Bạn chưa bật bộ lọc nào.'
                  ) : (
                    getFilterDescription()
                  )}
                </div>
              </div>
            </label>
          </div>

          <div className="p-3 bg-sky text-ink flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[13px] font-bold">Lưu ý: Quá trình export có thể mất vài giây tuỳ thuộc vào lượng dữ liệu.</div>
          </div>

          {error && (
            <div className="p-3 bg-danger text-white flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[13px] font-bold">{error}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3 border-t-2 border-surface-alt mt-6 pt-4">
            <button
              onClick={onClose}
              disabled={exporting}
              className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-accent text-ink font-bold h-10 px-4 hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exporting ? 'Đang xuất file...' : 'Xuất File Excel'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
