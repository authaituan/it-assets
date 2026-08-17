import React, { useEffect, useState } from 'react';
import ExcelJS from 'exceljs';
import {
  Network,
  Search,
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Building2,
  Phone,
  Compass,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileDown,
  FileSpreadsheet,
  Save,
  Eye
} from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// ==========================================
// "Quản Lý Mạng Lưới" (đổi tên từ "Sơ Đồ BĐX & Bưu Cục", feat/network-management-frontend).
// Backend: GET/POST(import)/PUT/DELETE /api/network* (feat/network-management-backend,
// đã merge main). File GỘP toàn bộ (list + 3 modal nội bộ: Thêm/Sửa, Export, Import)
// để giữ đúng phạm vi giao (chỉ Sidebar.jsx + file này).
// ==========================================

// 20 cột theo ĐÚNG file Excel mạng lưới PO cung cấp — key khớp tuyệt đối với
// GET /api/network/export-data / POST /api/network/import (xem
// docs/ai/03_ARCHITECTURE_MAP.md mục "Quản Lý Mạng Lưới — bảng 20 field JSON").
// `required: true` = Mã MBC, bắt buộc mọi dòng khi import.
const NETWORK_FIELDS = [
  { key: 'maBdtTp', label: 'Mã BĐT/TP', required: false, note: 'Mã Bưu Điện Tỉnh/Thành Phố. Dùng để tự tạo mới chuỗi tổ chức nếu Mã MBC chưa có.', example: '53' },
  { key: 'tenBdtTp', label: 'Tên BĐT/TP', required: false, note: 'Tên đầy đủ Bưu Điện Tỉnh/Thành Phố.', example: 'Bưu Điện Tỉnh TT-Huế' },
  { key: 'maBdx', label: 'Mã BĐX', required: false, note: 'Mã bưu điện xã. Bắt buộc nếu Mã MBC chưa có trong hệ thống (để tạo mới bưu cục).', example: 'BDX01' },
  { key: 'tenBuuDienXa', label: 'Tên Bưu Điện Xã', required: false, note: 'Dùng khi tạo mới BĐX.', example: 'BĐX Phú Vang' },
  { key: 'buuDienXaTrungTam', label: 'Bưu Điện Xã Trung Tâm', required: false, note: 'Dùng khi tạo mới BĐX.', example: 'BDX01-TT' },
  { key: 'maMbc', label: 'Mã MBC', required: true, note: 'Mã bưu cục. BẮT BUỘC ở MỌI dòng — đây là khoá để tạo mới hoặc cập nhật.', example: 'MBC001' },
  { key: 'tenBuuCuc', label: 'Tên Bưu Cục', required: false, note: 'Dùng khi tạo mới bưu cục (nếu Mã MBC chưa có).', example: 'Bưu cục Trung tâm' },
  { key: 'loai', label: 'Loại', required: false, note: 'Loại bưu cục (GD1/GD2/GD3/VHX/PH1/PH2/VP/TD...). Bỏ trống -> mặc định GD3 lúc tạo mới.', example: 'GD3' },
  { key: 'diaChiChiTiet', label: 'Địa Chỉ Chi Tiết', required: false, note: '', example: '123 Đường Lê Lợi' },
  { key: 'maBdkv', label: 'Mã BĐKV', required: false, note: '', example: 'KV1' },
  { key: 'tenBdkv', label: 'Tên BĐKV', required: false, note: '', example: 'Khu vực 1' },
  { key: 'maPhuongXaCu', label: 'Mã Phường/Xã Cũ', required: false, note: 'Mã Phường/Xã trước sáp nhập.', example: 'PXC01' },
  { key: 'tenPhuongXaCu', label: 'Tên Phường/Xã Cũ', required: false, note: '', example: 'Phường An Cựu' },
  { key: 'tenQuanHuyen', label: 'Tên Quận/Huyện', required: false, note: '', example: 'Quận Thuận Hoá' },
  { key: 'maPhuongXaMoi', label: 'Mã Phường/Xã Mới', required: false, note: 'Mã Phường/Xã sau sáp nhập.', example: 'PXM01' },
  { key: 'tenPhuongXaMoi', label: 'Tên Phường/Xã Mới', required: false, note: '', example: 'Phường Thuận Hoá' },
  { key: 'soDienThoai', label: 'Số Điện Thoại', required: false, note: '', example: '0234123456' },
  { key: 'tinhTrangHoatDong', label: 'Tình Trạng Hoạt Động', required: false, note: 'Chỉ nhận ACTIVE hoặc INACTIVE. Bỏ trống -> mặc định ACTIVE khi tạo mới, giữ nguyên khi cập nhật.', example: 'ACTIVE' },
  { key: 'viDo', label: 'Vĩ Độ', required: false, note: 'Số thực (vd 16.4637).', example: '16.4637' },
  { key: 'kinhDo', label: 'Kinh Độ', required: false, note: 'Số thực (vd 107.5909).', example: '107.5909' }
];

// ==========================================
// Helper Excel (copy pattern từ ImportEquipmentModal.jsx / ExportEquipmentModal.jsx)
// ==========================================
function cellToString(cell) {
  const v = cell ? cell.value : null;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((rt) => rt.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return '';
  }
  return String(v).trim();
}

function buildHeaderKeyMap(headerRow) {
  const map = {};
  headerRow.eachCell((cell, colNumber) => {
    const label = cellToString(cell).trim().toLowerCase();
    const field = NETWORK_FIELDS.find((f) => f.label.trim().toLowerCase() === label);
    if (field) map[colNumber] = field.key;
  });
  return map;
}

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

async function generateNetworkTemplate() {
  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet('Dữ Liệu');
  dataSheet.addRow(NETWORK_FIELDS.map((f) => f.label));
  dataSheet.getRow(1).font = { bold: true };
  const exampleCreate = {
    maBdtTp: '53', tenBdtTp: 'Bưu Điện Tỉnh TT-Huế', maBdx: 'BDX01', tenBuuDienXa: 'BĐX Phú Vang',
    buuDienXaTrungTam: '', maMbc: 'MBC001', tenBuuCuc: 'Bưu cục Trung tâm', loai: 'GD3',
    diaChiChiTiet: '123 Đường Lê Lợi', maBdkv: 'KV1', tenBdkv: 'Khu vực 1',
    maPhuongXaCu: 'PXC01', tenPhuongXaCu: 'Phường An Cựu', tenQuanHuyen: 'Quận Thuận Hoá',
    maPhuongXaMoi: 'PXM01', tenPhuongXaMoi: 'Phường Thuận Hoá', soDienThoai: '0234123456',
    tinhTrangHoatDong: 'ACTIVE', viDo: '16.4637', kinhDo: '107.5909'
  };
  const exampleUpdate = {
    maBdtTp: '', tenBdtTp: '', maBdx: '', tenBuuDienXa: '', buuDienXaTrungTam: '',
    maMbc: 'MBC001', tenBuuCuc: '', loai: '', diaChiChiTiet: '', maBdkv: '', tenBdkv: '',
    maPhuongXaCu: '', tenPhuongXaCu: '', tenQuanHuyen: '', maPhuongXaMoi: '', tenPhuongXaMoi: '',
    soDienThoai: '0234999888', tinhTrangHoatDong: 'INACTIVE', viDo: '', kinhDo: ''
  };
  dataSheet.addRow(NETWORK_FIELDS.map((f) => exampleCreate[f.key] ?? ''));
  dataSheet.addRow(NETWORK_FIELDS.map((f) => exampleUpdate[f.key] ?? ''));
  dataSheet.columns.forEach((col) => { col.width = 20; });

  const guideSheet = workbook.addWorksheet('Hướng Dẫn');
  guideSheet.addRow(['Tên Cột', 'Bắt Buộc?', 'Ý Nghĩa', 'Ví Dụ / Giá Trị Hợp Lệ']);
  guideSheet.getRow(1).font = { bold: true };
  NETWORK_FIELDS.forEach((f) => {
    guideSheet.addRow([f.label, f.required ? 'Bắt buộc (mọi dòng)' : 'Không bắt buộc', f.note, f.example]);
  });
  guideSheet.addRow([]);
  guideSheet.addRow(['Lưu ý chung', '', 'Mỗi dòng phải có Mã MBC. Nếu Mã MBC CHƯA có trong hệ thống -> tạo mới (cần Mã BĐX/Mã BĐT-TP để dựng chuỗi tổ chức). Nếu Mã MBC ĐÃ có -> chỉ CẬP NHẬT các cột có giá trị trong dòng, cột để trống giữ nguyên dữ liệu cũ.', '']);
  guideSheet.columns = [{ width: 24 }, { width: 20 }, { width: 60 }, { width: 30 }];
  guideSheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  await downloadWorkbook(workbook, 'template-import-mang-luoi.xlsx');
}

// ==========================================
// Modal: Export Mạng Lưới
// ==========================================
function ExportNetworkModal({ onClose, search, communeId }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    setError('');

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (communeId) params.append('communeId', communeId);
    const query = params.toString();

    const result = await apiFetchJson(`/api/network/export-data${query ? `?${query}` : ''}`);
    if (!result.ok) {
      setExporting(false);
      setError(result.error);
      return;
    }

    try {
      const items = result.data.items || [];
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Dữ Liệu');
      sheet.addRow(NETWORK_FIELDS.map((f) => f.label));
      items.forEach((item) => {
        sheet.addRow(NETWORK_FIELDS.map((f) => (item[f.key] === undefined || item[f.key] === null ? '' : item[f.key])));
      });
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((col) => { col.width = 18; });

      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      await downloadWorkbook(workbook, `mang-luoi-export-${stamp}.xlsx`);
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
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            <span>Export Mạng Lưới Ra Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-400">
            Xuất toàn bộ 20 cột theo đúng thứ tự chuẩn, dùng đúng bộ lọc đang áp dụng trên danh sách
            {search || communeId ? ' (đang lọc)' : ' (không lọc — toàn bộ bưu cục)'}.
          </p>

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
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{exporting ? 'Đang xuất file...' : 'Xuất File Excel'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Modal: Import Mạng Lưới
// ==========================================
function ImportNetworkModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('');
  const [headerFields, setHeaderFields] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importErrorRows, setImportErrorRows] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      await generateNetworkTemplate();
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setImportResult(null);
    setImportError('');
    setImportErrorRows(null);
    setParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet('Dữ Liệu') || workbook.worksheets[0];
      if (!worksheet) {
        setParseError('File Excel không có sheet nào');
        setParsing(false);
        return;
      }

      const keyMap = buildHeaderKeyMap(worksheet.getRow(1));
      const matchedFields = Object.values(keyMap);
      if (matchedFields.length === 0) {
        setParseError('Không nhận diện được cột nào ở dòng tiêu đề (dòng 1) — vui lòng dùng đúng file mẫu từ nút "Tải Template Mẫu"');
        setParsing(false);
        return;
      }
      if (!matchedFields.includes('maMbc')) {
        setParseError('File thiếu cột "Mã MBC" (bắt buộc để import)');
        setParsing(false);
        return;
      }

      const orderedFields = NETWORK_FIELDS.filter((f) => matchedFields.includes(f.key));
      setHeaderFields(orderedFields);

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        let hasAnyValue = false;
        Object.entries(keyMap).forEach(([colNumber, key]) => {
          const val = cellToString(row.getCell(Number(colNumber)));
          if (val) hasAnyValue = true;
          obj[key] = val;
        });
        if (!hasAnyValue) return;
        rows.push(obj);
      });

      if (rows.length === 0) {
        setParseError('Không đọc được dòng dữ liệu nào (kiểm tra file có dữ liệu từ dòng 2 trở đi)');
      }
      setParsedRows(rows);
    } catch (err) {
      console.error(err);
      setParseError('Không đọc được file Excel: ' + err.message);
      setParsedRows([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    setImportErrorRows(null);

    const result = await apiFetchJson('/api/network/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsedRows })
    });

    setImporting(false);
    if (!result.ok) {
      setImportError(result.error);
      if (Array.isArray(result.data && result.data.errors) && result.data.errors.length > 0) {
        setImportErrorRows(result.data.errors);
      }
      return;
    }
    setImportResult(result.data);
    onSuccess();
  };

  const invalidRowCount = parsedRows.filter((r) => !r.maMbc).length;
  const previewRows = parsedRows.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Import Mạng Lưới Từ Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-slate-400">
              File <code className="text-purple-300">.xlsx</code> sheet "Dữ Liệu", dòng 1 là tiêu đề cột.
              Mỗi dòng phải có <b>Mã MBC</b>. Mã đã có → cập nhật; mã chưa có → tạo mới (kèm Tỉnh/BĐX nếu cần).
            </p>
            <button
              onClick={handleDownloadTemplate}
              disabled={generatingTemplate}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 glass-input hover:border-purple-500/40 transition-all disabled:opacity-50"
            >
              {generatingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>Tải Template Mẫu</span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
              Chọn File Excel (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="w-full glass-input p-3 rounded-xl text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-purple-500/20 file:text-purple-300 file:text-xs file:font-semibold"
            />
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang đọc file Excel...</span>
            </div>
          )}

          {parseError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedRows.length > 0 && !importResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <span>
                    Xem Trước ({parsedRows.length} dòng từ "{fileName}"
                    {parsedRows.length > 20 ? ` — hiện 20 dòng đầu` : ''})
                  </span>
                </h4>
                {invalidRowCount > 0 && (
                  <span className="text-rose-400 text-[11px] font-semibold">
                    {invalidRowCount} dòng thiếu Mã MBC — sẽ bị chặn khi Import
                  </span>
                )}
              </div>

              <div className="border border-slate-800 rounded-xl overflow-auto max-h-[320px]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      {headerFields.map((f) => (
                        <th key={f.key} className="py-2 px-3 whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {previewRows.map((r, idx) => {
                      const invalid = !r.maMbc;
                      return (
                        <tr key={idx} className={invalid ? 'bg-rose-500/5' : 'hover:bg-slate-800/40'}>
                          {headerFields.map((f) => (
                            <td key={f.key} className="py-1.5 px-3 text-slate-300 whitespace-nowrap">
                              {r[f.key] || <span className="text-slate-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{importError}</span>
                  </div>
                  {importErrorRows && (
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      {importErrorRows.map((e, idx) => (
                        <li key={idx}>Dòng {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || invalidRowCount > 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                title={invalidRowCount > 0 ? 'Sửa các dòng thiếu Mã MBC trong file rồi tải lại' : ''}
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Đang Import...' : `Import ${parsedRows.length} Bưu Cục`}</span>
              </button>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import thành công!</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Bưu Điện Tỉnh Mới', importResult.provincesCreated],
                  ['BĐX Mới', importResult.communesCreated],
                  ['Bưu Cục Mới', importResult.postOfficesCreated],
                  ['Bưu Cục Cập Nhật', importResult.postOfficesUpdated]
                ].map(([label, value]) => (
                  <div key={label} className="p-2.5 rounded-lg bg-slate-900/60 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="text-lg font-bold text-emerald-400">{value ?? 0}</div>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Modal: Thêm / Sửa Bưu Cục
// ------------------------------------------------------------------
// THÊM MỚI: không có route POST /api/network/post-offices riêng — dùng lại
// POST /api/network/import với rows: [1 dòng] (đúng 20 key Excel), route này
// tự resolve/tạo Tỉnh->BĐX->Bưu cục qua resolveOrCreateOrgChain().
// SỬA: PUT /api/network/post-offices/:id dùng bộ key KHÁC (tên cột DB thật:
// name/type/address/communeId/bdkv_code/bdkv_name/old_ward_code/.../latitude/
// longitude) — KHÔNG đổi được code (Mã MBC) và KHÔNG tự tạo/đổi tên Tỉnh/BĐX,
// chỉ được gán lại BĐX đã có sẵn qua communeId.
// ==========================================
function PostOfficeFormModal({ editing, communes, onClose, onSuccess }) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    maBdtTp: '', tenBdtTp: '',
    maBdx: '', tenBuuDienXa: '', buuDienXaTrungTam: '',
    communeId: editing ? editing.commune_id : '',
    maMbc: editing ? editing.code : '',
    tenBuuCuc: editing ? editing.name : '',
    loai: editing ? (editing.type || '') : '',
    diaChiChiTiet: editing ? (editing.address || '') : '',
    maBdkv: editing ? (editing.bdkv_code || '') : '',
    tenBdkv: editing ? (editing.bdkv_name || '') : '',
    maPhuongXaCu: editing ? (editing.old_ward_code || '') : '',
    tenPhuongXaCu: editing ? (editing.old_ward_name || '') : '',
    tenQuanHuyen: editing ? (editing.district_name || '') : '',
    maPhuongXaMoi: editing ? (editing.new_ward_code || '') : '',
    tenPhuongXaMoi: editing ? (editing.new_ward_name || '') : '',
    soDienThoai: editing ? (editing.phone || '') : '',
    tinhTrangHoatDong: editing ? (editing.operational_status || 'ACTIVE') : 'ACTIVE',
    viDo: editing && editing.latitude !== null && editing.latitude !== undefined ? String(editing.latitude) : '',
    kinhDo: editing && editing.longitude !== null && editing.longitude !== undefined ? String(editing.longitude) : ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.maMbc.trim()) {
      setError('Vui lòng nhập Mã MBC (mã bưu cục)');
      return;
    }
    if (!form.tenBuuCuc.trim()) {
      setError('Vui lòng nhập Tên Bưu Cục');
      return;
    }

    setLoading(true);
    setError('');

    let result;
    if (isEdit) {
      result = await apiFetchJson(`/api/network/post-offices/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.tenBuuCuc.trim(),
          type: form.loai.trim() || null,
          address: form.diaChiChiTiet.trim() || null,
          communeId: form.communeId || undefined,
          bdkv_code: form.maBdkv.trim() || null,
          bdkv_name: form.tenBdkv.trim() || null,
          old_ward_code: form.maPhuongXaCu.trim() || null,
          old_ward_name: form.tenPhuongXaCu.trim() || null,
          district_name: form.tenQuanHuyen.trim() || null,
          new_ward_code: form.maPhuongXaMoi.trim() || null,
          new_ward_name: form.tenPhuongXaMoi.trim() || null,
          phone: form.soDienThoai.trim() || null,
          operational_status: form.tinhTrangHoatDong.trim() || null,
          latitude: form.viDo.trim() || null,
          longitude: form.kinhDo.trim() || null
        })
      });
    } else {
      result = await apiFetchJson('/api/network/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: [{
            maBdtTp: form.maBdtTp.trim(),
            tenBdtTp: form.tenBdtTp.trim(),
            maBdx: form.maBdx.trim(),
            tenBuuDienXa: form.tenBuuDienXa.trim(),
            buuDienXaTrungTam: form.buuDienXaTrungTam.trim(),
            maMbc: form.maMbc.trim(),
            tenBuuCuc: form.tenBuuCuc.trim(),
            loai: form.loai.trim(),
            diaChiChiTiet: form.diaChiChiTiet.trim(),
            maBdkv: form.maBdkv.trim(),
            tenBdkv: form.tenBdkv.trim(),
            maPhuongXaCu: form.maPhuongXaCu.trim(),
            tenPhuongXaCu: form.tenPhuongXaCu.trim(),
            tenQuanHuyen: form.tenQuanHuyen.trim(),
            maPhuongXaMoi: form.maPhuongXaMoi.trim(),
            tenPhuongXaMoi: form.tenPhuongXaMoi.trim(),
            soDienThoai: form.soDienThoai.trim(),
            tinhTrangHoatDong: form.tinhTrangHoatDong.trim(),
            viDo: form.viDo.trim(),
            kinhDo: form.kinhDo.trim()
          }]
        })
      });
    }

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // POST /api/network/import trả report { postOfficesCreated, errors... } chứ
    // không phải { message } — nếu có errors bên trong report (theo dòng), báo rõ.
    if (!isEdit && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
      setError(result.data.errors.map((er) => `Dòng ${er.row}: ${er.message}`).join('; '));
      return;
    }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            {isEdit ? <Edit className="w-5 h-5 text-cyan-400" /> : <Plus className="w-5 h-5 text-cyan-400" />}
            <span>{isEdit ? `Sửa Bưu Cục — ${editing.code}` : 'Thêm Bưu Cục Mới'}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isEdit && (
            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 space-y-3">
              <div className="text-[11px] font-semibold text-cyan-300 uppercase">Tổ chức (chỉ cần nếu Mã BĐX/Tỉnh chưa có sẵn)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã BĐT/TP</label>
                  <input type="text" value={form.maBdtTp} onChange={setField('maBdtTp')} placeholder="53" className="w-full glass-input p-2.5 rounded-xl text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên BĐT/TP</label>
                  <input type="text" value={form.tenBdtTp} onChange={setField('tenBdtTp')} placeholder="Bưu Điện Tỉnh TT-Huế" className="w-full glass-input p-2.5 rounded-xl text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã BĐX</label>
                  <input type="text" value={form.maBdx} onChange={setField('maBdx')} placeholder="BDX01" className="w-full glass-input p-2.5 rounded-xl text-xs" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên BĐX</label>
                  <input type="text" value={form.tenBuuDienXa} onChange={setField('tenBuuDienXa')} placeholder="BĐX Phú Vang" className="w-full glass-input p-2.5 rounded-xl text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Bưu Điện Xã Trung Tâm</label>
                  <input type="text" value={form.buuDienXaTrungTam} onChange={setField('buuDienXaTrungTam')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
                </div>
              </div>
            </div>
          )}

          {isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">BĐX gán cho bưu cục</label>
              <select value={form.communeId} onChange={setField('communeId')} className="w-full glass-input p-2.5 rounded-xl text-xs">
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã MBC {!isEdit && <span className="text-rose-400">*</span>}</label>
              <input
                type="text"
                value={form.maMbc}
                onChange={setField('maMbc')}
                disabled={isEdit}
                placeholder="MBC001"
                className="w-full glass-input p-2.5 rounded-xl text-xs disabled:opacity-60"
                required={!isEdit}
              />
              {isEdit && <p className="text-[10px] text-slate-500 mt-1">Mã bưu cục không thể đổi sau khi tạo.</p>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên Bưu Cục <span className="text-rose-400">*</span></label>
              <input type="text" value={form.tenBuuCuc} onChange={setField('tenBuuCuc')} placeholder="Bưu cục Trung tâm" className="w-full glass-input p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Loại</label>
              <input type="text" value={form.loai} onChange={setField('loai')} placeholder="GD3" className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tình Trạng Hoạt Động</label>
              <select value={form.tinhTrangHoatDong} onChange={setField('tinhTrangHoatDong')} className="w-full glass-input p-2.5 rounded-xl text-xs">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Địa Chỉ Chi Tiết</label>
              <input type="text" value={form.diaChiChiTiet} onChange={setField('diaChiChiTiet')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã BĐKV</label>
              <input type="text" value={form.maBdkv} onChange={setField('maBdkv')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên BĐKV</label>
              <input type="text" value={form.tenBdkv} onChange={setField('tenBdkv')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Số Điện Thoại</label>
              <input type="text" value={form.soDienThoai} onChange={setField('soDienThoai')} placeholder="0234123456" className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã Phường/Xã Cũ</label>
              <input type="text" value={form.maPhuongXaCu} onChange={setField('maPhuongXaCu')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên Phường/Xã Cũ</label>
              <input type="text" value={form.tenPhuongXaCu} onChange={setField('tenPhuongXaCu')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên Quận/Huyện</label>
              <input type="text" value={form.tenQuanHuyen} onChange={setField('tenQuanHuyen')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã Phường/Xã Mới</label>
              <input type="text" value={form.maPhuongXaMoi} onChange={setField('maPhuongXaMoi')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Tên Phường/Xã Mới</label>
              <input type="text" value={form.tenPhuongXaMoi} onChange={setField('tenPhuongXaMoi')} className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Vĩ Độ</label>
              <input type="text" value={form.viDo} onChange={setField('viDo')} placeholder="16.4637" className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Kinh Độ</label>
              <input type="text" value={form.kinhDo} onChange={setField('kinhDo')} placeholder="107.5909" className="w-full glass-input p-2.5 rounded-xl text-xs" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{loading ? 'Đang Xử Lý...' : (isEdit ? 'LƯU THAY ĐỔI' : 'THÊM BƯU CỤC')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Main View
// ==========================================
export default function UnitTreeView({ onSelectUnitFilter }) {
  const [items, setItems] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingPostOffice, setEditingPostOffice] = useState(null);

  useEffect(() => {
    fetch('/api/organization/communes')
      .then((res) => res.json())
      .then((data) => setCommunes(data || []))
      .catch((err) => console.error(err));
  }, []);

  const fetchNetwork = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: pagination.page, limit: pagination.limit });
    if (search) params.append('search', search);
    if (selectedCommuneId) params.append('communeId', selectedCommuneId);

    apiFetchJson(`/api/network?${params.toString()}`).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.data.items || []);
      setPagination(result.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    });
  };

  useEffect(() => {
    fetchNetwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCommuneId, pagination.page]);

  // Sau Sửa/Xoá/Import thành công: refresh danh sách + refetch communes (Import
  // có thể tạo mới BĐX cần cập nhật dropdown lọc).
  const handleMutationSuccess = () => {
    fetchNetwork();
    fetch('/api/organization/communes')
      .then((res) => res.json())
      .then((data) => setCommunes(data || []))
      .catch((err) => console.error(err));
  };

  const handleEdit = (po) => {
    setEditingPostOffice(po);
    setIsFormOpen(true);
  };

  const handleDelete = async (po) => {
    if (!window.confirm(`Bạn có chắc muốn xoá bưu cục "${po.name}" (${po.code}) không?`)) return;

    const result = await apiFetchJson(`/api/network/post-offices/${po.id}`, { method: 'DELETE' });
    if (!result.ok) {
      // 400 khi còn thiết bị/nhân sự liên kết -> hiện đúng message backend trả,
      // không phải lỗi JSON thô.
      alert(`Không thể xoá: ${result.error}`);
      return;
    }
    handleMutationSuccess();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header & Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              <span>Quản Lý Mạng Lưới</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Danh mục chuẩn Tỉnh/BĐX/Bưu cục — nguồn tổ chức duy nhất cho toàn hệ thống (BĐT/TP ➔ BĐX ➔ Bưu Cục)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 glass-input hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 glass-input hover:border-purple-500/40 hover:text-purple-300 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={() => {
                setEditingPostOffice(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Bưu Cục</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              placeholder="Tìm theo Mã MBC hoặc Tên Bưu Cục..."
              className="w-full glass-input pl-9 pr-3 py-2 rounded-xl text-xs"
            />
          </div>
          <select
            value={selectedCommuneId}
            onChange={(e) => {
              setSelectedCommuneId(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full glass-input px-3 py-2 rounded-xl text-xs"
          >
            <option value="">-- Tất cả BĐX ({communes.length}) --</option>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang nạp danh sách mạng lưới...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Network className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-sm text-slate-300">Không tìm thấy bưu cục phù hợp</p>
            <p className="text-xs text-slate-500 mt-1">Thử thay đổi bộ lọc, hoặc thêm mới / import Excel</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Mã MBC / Tên Bưu Cục</th>
                  <th className="py-3.5 px-4">BĐX / Tỉnh</th>
                  <th className="py-3.5 px-4">Liên Hệ</th>
                  <th className="py-3.5 px-4">Toạ Độ</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4">CCDC</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-cyan-400">{po.code}</div>
                      <div className="text-slate-200 font-medium">{po.name}</div>
                      {po.type && <div className="text-[10px] text-slate-500 mt-0.5">{po.type}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[160px]">{po.commune_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[10px] mt-0.5">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{po.province_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {po.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-mono">{po.phone}</span>
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {(po.latitude !== null && po.latitude !== undefined) ? (
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[10px]">
                          <Compass className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{po.latitude}, {po.longitude}</span>
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {po.operational_status === 'INACTIVE' ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-semibold">Ngừng hoạt động</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">Đang hoạt động</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700">
                        {po.equipment_count} thiết bị
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex justify-end gap-2">
                        {onSelectUnitFilter && (
                          <button
                            onClick={() => onSelectUnitFilter(po.commune_id, po.id)}
                            title="Xem CCDC"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(po)}
                          title="Sửa"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(po)}
                          title="Xoá"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Hiển thị <span className="font-bold text-white">{items.length}</span> / <span className="font-bold text-white">{pagination.total}</span> bưu cục
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="px-3 py-1.5 rounded-lg glass-input text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-cyan-500/40 transition-all flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trang trước</span>
            </button>
            <span className="text-xs text-slate-400 px-2 font-medium">
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="px-3 py-1.5 rounded-lg glass-input text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-cyan-500/40 transition-all flex items-center gap-1"
            >
              <span>Trang sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <PostOfficeFormModal
          editing={editingPostOffice}
          communes={communes}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPostOffice(null);
          }}
          onSuccess={handleMutationSuccess}
        />
      )}

      {isExportOpen && (
        <ExportNetworkModal
          onClose={() => setIsExportOpen(false)}
          search={search}
          communeId={selectedCommuneId}
        />
      )}

      {isImportOpen && (
        <ImportNetworkModal
          onClose={() => setIsImportOpen(false)}
          onSuccess={handleMutationSuccess}
        />
      )}
    </div>
  );
}
