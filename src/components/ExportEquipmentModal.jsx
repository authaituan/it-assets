import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { X, Download, RefreshCw, AlertCircle, CheckSquare } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// 31 cột theo ĐÚNG thứ tự chuẩn: 24 cột gốc A-X (key khớp tuyệt đối với
// GET /api/equipments/export-data, xem docs/ai/03_ARCHITECTURE_MAP.md mục
// "Equipment Import/Export — bảng field JSON") + 7 cột mới nối tiếp.
// `required: true` = cột neo (Mã CCDC) — luôn xuất, không cho bỏ tick.
export const EQUIPMENT_EXPORT_FIELDS = [
  { key: 'maBdtTp', label: 'Mã BĐT/TP' },
  { key: 'tenBdtTp', label: 'Tên BĐT/TP' },
  { key: 'maMbc', label: 'Mã MBC' },
  { key: 'tenBuuCuc', label: 'Tên Bưu Cục' },
  { key: 'maBdx', label: 'Mã BĐX' },
  { key: 'tenBuuDienXa', label: 'Tên Bưu Điện Xã' },
  { key: 'loai', label: 'Loại' },
  { key: 'ip', label: 'Địa Chỉ IP' },
  { key: 'ngayCap', label: 'Ngày Cấp' },
  { key: 'tenMay', label: 'Tên Máy' },
  { key: 'diaChiMac', label: 'Địa Chỉ MAC' },
  { key: 'loaiMay', label: 'Loại Máy' },
  { key: 'hang', label: 'Hãng' },
  { key: 'model', label: 'Model' },
  { key: 'serialNumber', label: 'Serial Number/TAG' },
  { key: 'heDieuHanh', label: 'Hệ Điều Hành' },
  { key: 'cpu', label: 'CPU' },
  { key: 'ram', label: 'RAM' },
  { key: 'oCung', label: 'Ổ Cứng' },
  { key: 'nguoiSuDung', label: 'Người Sử Dụng' },
  { key: 'maBdkv', label: 'Mã BĐKV' },
  { key: 'tenBdkv', label: 'Tên BĐKV' },
  { key: 'buuDienXaTrungTam', label: 'Bưu Điện Xã Trung Tâm' },
  { key: 'diaChiChiTiet', label: 'Địa Chỉ Chi Tiết' },
  { key: 'maCcdc', label: 'Mã CCDC', required: true },
  { key: 'danhMucCcdc', label: 'Danh Mục CCDC' },
  { key: 'tienToDanhMucMoi', label: 'Tiền Tố Danh Mục Mới' },
  { key: 'namMua', label: 'Năm Mua' },
  { key: 'maHrmNguoiSuDung', label: 'Mã HRM Người Sử Dụng' },
  { key: 'trangThai', label: 'Trạng Thái' },
  { key: 'ghiChu', label: 'Ghi Chú' }
];

function buildFilterQuery(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.communeId) params.append('communeId', filters.communeId);
  if (filters.postOfficeId) params.append('postOfficeId', filters.postOfficeId);
  if (filters.deviceTypeId) params.append('deviceTypeId', filters.deviceTypeId);
  if (filters.categoryRaw) params.append('categoryRaw', filters.categoryRaw);
  if (filters.status) params.append('status', filters.status);
  return params.toString();
}

export default function ExportEquipmentModal({ onClose, filters, filterSummary }) {
  const [mode, setMode] = useState('full'); // 'full' | 'custom'
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(['maCcdc']));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const toggleKey = (key) => {
    if (key === 'maCcdc') return; // cột neo bắt buộc, không cho bỏ tick
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');

    const query = buildFilterQuery(filters);
    const result = await apiFetchJson(`/api/equipments/export-data${query ? `?${query}` : ''}`);
    if (!result.ok) {
      setExporting(false);
      setError(result.error);
      return;
    }

    const items = result.data.items || [];
    const columns = mode === 'full'
      ? EQUIPMENT_EXPORT_FIELDS
      : EQUIPMENT_EXPORT_FIELDS.filter((f) => f.required || selectedKeys.has(f.key));

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Dữ Liệu');
      sheet.addRow(columns.map((c) => c.label));
      items.forEach((item) => {
        sheet.addRow(columns.map((c) => (item[c.key] === undefined || item[c.key] === null ? '' : item[c.key])));
      });
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((col) => { col.width = 18; });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ccdc-export-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExporting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setExporting(false);
      setError('Không tạo được file Excel: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            <span>Export Danh Sách CCDC Ra Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          <p className="text-slate-400">
            Dùng đúng bộ lọc đang áp dụng trên danh sách: <span className="text-slate-200">{filterSummary}</span>
          </p>

          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-xl glass-input cursor-pointer">
              <input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} className="mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">Phương án 1 — Đầy đủ</div>
                <div className="text-[11px] text-slate-400">Xuất toàn bộ 31 cột theo đúng thứ tự chuẩn (giống dulieu.xlsx gốc + 7 cột mới).</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-xl glass-input cursor-pointer">
              <input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} className="mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">Phương án 2 — Theo từng trường cần thiết</div>
                <div className="text-[11px] text-slate-400">Tự chọn cột muốn xuất. Cột "Mã CCDC" luôn được xuất kèm (dùng để import lại đúng thiết bị).</div>
              </div>
            </label>
          </div>

          {mode === 'custom' && (
            <div className="border border-slate-800 rounded-xl p-3 max-h-[280px] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EQUIPMENT_EXPORT_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${f.required ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-slate-800/60'}`}
                >
                  <input
                    type="checkbox"
                    checked={f.required || selectedKeys.has(f.key)}
                    disabled={f.required}
                    onChange={() => toggleKey(f.key)}
                  />
                  <span className={f.required ? 'text-cyan-300 font-semibold' : 'text-slate-300'}>
                    {f.label}
                    {f.required && <span className="block text-[10px] text-cyan-400 font-normal">(bắt buộc — dùng để cập nhật khi import lại)</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            <span>{exporting ? 'Đang xuất file...' : 'Xuất File Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
