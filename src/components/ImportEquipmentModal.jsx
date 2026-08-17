import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw, FileDown } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// 31 cột theo ĐÚNG thứ tự chuẩn + mô tả cho Sheet "Hướng Dẫn" của file mẫu.
// Key PHẢI khớp tuyệt đối với GET /api/equipments/export-data và
// POST /api/equipments/import (xem docs/ai/03_ARCHITECTURE_MAP.md).
const EQUIPMENT_IMPORT_FIELDS = [
  { key: 'maBdtTp', label: 'Mã BĐT/TP', required: false, note: 'Mã Bưu Điện Tỉnh/Thành Phố. Dùng để tự tạo mới chuỗi tổ chức nếu Mã MBC chưa có trong hệ thống.', example: '53' },
  { key: 'tenBdtTp', label: 'Tên BĐT/TP', required: false, note: 'Tên đầy đủ Bưu Điện Tỉnh/Thành Phố.', example: 'Bưu Điện Tỉnh TT-Huế' },
  { key: 'maMbc', label: 'Mã MBC', required: true, note: 'Mã bưu cục. BẮT BUỘC ở MỌI dòng.', example: 'MBC001' },
  { key: 'tenBuuCuc', label: 'Tên Bưu Cục', required: false, note: 'Dùng khi tạo mới bưu cục (nếu Mã MBC chưa có).', example: 'Bưu cục Trung tâm' },
  { key: 'maBdx', label: 'Mã BĐX', required: false, note: 'Mã bưu điện xã. Bắt buộc nếu Mã MBC chưa có trong hệ thống (để tạo mới bưu cục).', example: 'BDX01' },
  { key: 'tenBuuDienXa', label: 'Tên Bưu Điện Xã', required: false, note: 'Dùng khi tạo mới BĐX.', example: 'BĐX Phú Vang' },
  { key: 'loai', label: 'Loại', required: false, note: 'Loại bưu cục (GD1/GD2/GD3...). Bỏ trống -> mặc định GD3 lúc tạo mới.', example: 'GD3' },
  { key: 'ip', label: 'Địa Chỉ IP', required: false, note: '', example: '10.0.1.5' },
  { key: 'ngayCap', label: 'Ngày Cấp', required: false, note: 'Text tự do.', example: '2024-01-15' },
  { key: 'tenMay', label: 'Tên Máy', required: false, note: 'Hostname. BẮT BUỘC nếu dòng này KHÔNG điền Mã CCDC (dùng để tạo thiết bị mới).', example: 'PC-VP-01' },
  { key: 'diaChiMac', label: 'Địa Chỉ MAC', required: false, note: '', example: 'AA:BB:CC:DD:EE:FF' },
  { key: 'loaiMay', label: 'Loại Máy', required: false, note: 'Chỉ là ghi chú phân loại chi tiết, KHÔNG phải Danh Mục CCDC thật (xem cột Danh Mục CCDC).', example: 'PC Desktop' },
  { key: 'hang', label: 'Hãng', required: false, note: 'Tên hãng sản xuất, hệ thống tự tạo mới nếu chưa có.', example: 'Dell' },
  { key: 'model', label: 'Model', required: false, note: '', example: 'OptiPlex 7010' },
  { key: 'serialNumber', label: 'Serial Number/TAG', required: false, note: '', example: 'SN123456' },
  { key: 'heDieuHanh', label: 'Hệ Điều Hành', required: false, note: '', example: 'Windows 11' },
  { key: 'cpu', label: 'CPU', required: false, note: '', example: 'Core i5-12400' },
  { key: 'ram', label: 'RAM', required: false, note: '', example: '8GB' },
  { key: 'oCung', label: 'Ổ Cứng', required: false, note: '', example: 'SSD 256GB' },
  { key: 'nguoiSuDung', label: 'Người Sử Dụng', required: false, note: 'Tên tự do, không cần khớp nhân sự trong hệ thống.', example: 'Nguyễn Văn A' },
  { key: 'maBdkv', label: 'Mã BĐKV', required: false, note: 'Dùng khi tạo mới bưu cục.', example: 'KV1' },
  { key: 'tenBdkv', label: 'Tên BĐKV', required: false, note: 'Dùng khi tạo mới bưu cục.', example: 'Khu vực 1' },
  { key: 'buuDienXaTrungTam', label: 'Bưu Điện Xã Trung Tâm', required: false, note: 'Dùng khi tạo mới BĐX.', example: 'BDX01-TT' },
  { key: 'diaChiChiTiet', label: 'Địa Chỉ Chi Tiết', required: false, note: 'Dùng khi tạo mới bưu cục.', example: '123 Đường Lê Lợi' },
  { key: 'maCcdc', label: 'Mã CCDC', required: false, note: 'Để TRỐNG nếu muốn TẠO MỚI thiết bị. Điền mã đã có nếu muốn CẬP NHẬT thiết bị đó (không thể tự đổi mã này qua import).', example: 'PC-24-001 (hoặc để trống)' },
  { key: 'danhMucCcdc', label: 'Danh Mục CCDC', required: false, note: 'Tên danh mục CCDC THẬT. Nếu chưa có trong hệ thống, hệ thống sẽ TỰ TẠO MỚI, khi đó bắt buộc phải điền thêm cột Tiền Tố Danh Mục Mới (chỉ khi đang tạo thiết bị mới, không có Mã CCDC).', example: 'Máy Tính Để Bàn' },
  { key: 'tienToDanhMucMoi', label: 'Tiền Tố Danh Mục Mới', required: false, note: 'Bắt buộc khi Danh Mục CCDC là danh mục MỚI và đang tạo thiết bị mới. 2-5 ký tự IN HOA/số.', example: 'PC' },
  { key: 'namMua', label: 'Năm Mua', required: false, note: 'Bỏ trống -> mặc định năm hiện tại khi tạo mới.', example: '2024' },
  { key: 'maHrmNguoiSuDung', label: 'Mã HRM Người Sử Dụng', required: false, note: 'Mã HRM của nhân sự đã có trong module Người Sử Dụng. Để trống nếu không gán.', example: 'HRM001' },
  { key: 'trangThai', label: 'Trạng Thái', required: false, note: 'Chỉ nhận đúng 1 trong 5 giá trị: IN_USE, IN_STOCK, MAINTENANCE, BROKEN, LIQUIDATED. Bỏ trống -> mặc định IN_USE khi tạo mới, giữ nguyên khi cập nhật.', example: 'IN_USE' },
  { key: 'ghiChu', label: 'Ghi Chú', required: false, note: '', example: '' }
];

// Đọc giá trị 1 cell ExcelJS về chuỗi text thuần (copy pattern từ
// ImportPersonnelModal.jsx — cell.value có thể là string/number/object).
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

// Map cột theo TÊN header (không theo vị trí cố định) — cho phép Import
// đọc lại cả file export dạng "rút gọn" (ít hơn 31 cột, chỉ có cột đã tick
// + Mã CCDC bắt buộc) mà vẫn map đúng field, không lẫn cột.
function buildHeaderKeyMap(headerRow) {
  const map = {};
  headerRow.eachCell((cell, colNumber) => {
    const label = cellToString(cell).trim().toLowerCase();
    const field = EQUIPMENT_IMPORT_FIELDS.find((f) => f.label.trim().toLowerCase() === label);
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

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet('Dữ Liệu');
  dataSheet.addRow(EQUIPMENT_IMPORT_FIELDS.map((f) => f.label));
  dataSheet.getRow(1).font = { bold: true };
  // 2 dòng ví dụ minh hoạ: 1 dòng TẠO MỚI (không Mã CCDC), 1 dòng CẬP NHẬT (có Mã CCDC).
  const exampleCreate = {
    maBdtTp: '53', tenBdtTp: 'Bưu Điện Tỉnh TT-Huế', maMbc: 'MBC001', tenBuuCuc: 'Bưu cục Trung tâm',
    maBdx: 'BDX01', tenBuuDienXa: 'BĐX Phú Vang', loai: 'GD3', ip: '10.0.1.5', ngayCap: '2024-01-15',
    tenMay: 'PC-VP-01', diaChiMac: 'AA:BB:CC:DD:EE:FF', loaiMay: 'PC Desktop', hang: 'Dell', model: 'OptiPlex 7010',
    serialNumber: 'SN123456', heDieuHanh: 'Windows 11', cpu: 'Core i5-12400', ram: '8GB', oCung: 'SSD 256GB',
    nguoiSuDung: 'Nguyễn Văn A', maBdkv: 'KV1', tenBdkv: 'Khu vực 1', buuDienXaTrungTam: '', diaChiChiTiet: '123 Đường Lê Lợi',
    maCcdc: '', danhMucCcdc: 'Máy Tính Để Bàn', tienToDanhMucMoi: 'PC', namMua: '2024', maHrmNguoiSuDung: '',
    trangThai: 'IN_USE', ghiChu: 'Dòng ví dụ: TẠO MỚI (để trống Mã CCDC)'
  };
  const exampleUpdate = {
    maBdtTp: '', tenBdtTp: '', maMbc: 'MBC001', tenBuuCuc: '', maBdx: '', tenBuuDienXa: '', loai: '', ip: '',
    ngayCap: '', tenMay: '', diaChiMac: '', loaiMay: '', hang: '', model: 'OptiPlex 7020 (đổi model)', serialNumber: '',
    heDieuHanh: '', cpu: '', ram: '', oCung: '', nguoiSuDung: '', maBdkv: '', tenBdkv: '', buuDienXaTrungTam: '',
    diaChiChiTiet: '', maCcdc: 'PC-24-001', danhMucCcdc: '', tienToDanhMucMoi: '', namMua: '', maHrmNguoiSuDung: '',
    trangThai: '', ghiChu: 'Dòng ví dụ: CẬP NHẬT (điền Mã CCDC đã có, chỉ field muốn đổi)'
  };
  dataSheet.addRow(EQUIPMENT_IMPORT_FIELDS.map((f) => exampleCreate[f.key] ?? ''));
  dataSheet.addRow(EQUIPMENT_IMPORT_FIELDS.map((f) => exampleUpdate[f.key] ?? ''));
  dataSheet.columns.forEach((col) => { col.width = 20; });

  const guideSheet = workbook.addWorksheet('Hướng Dẫn');
  guideSheet.addRow(['Tên Cột', 'Bắt Buộc?', 'Ý Nghĩa', 'Ví Dụ / Giá Trị Hợp Lệ']);
  guideSheet.getRow(1).font = { bold: true };
  EQUIPMENT_IMPORT_FIELDS.forEach((f) => {
    guideSheet.addRow([f.label, f.required ? 'Bắt buộc (mọi dòng)' : 'Không bắt buộc', f.note, f.example]);
  });
  guideSheet.addRow([]);
  guideSheet.addRow(['Lưu ý chung', '', 'Mỗi dòng phải có Mã MBC VÀ (Tên Máy HOẶC Mã CCDC). Thiếu 1 trong 2 -> cả file bị chặn import (fail-fast).', '']);
  guideSheet.columns = [{ width: 24 }, { width: 20 }, { width: 60 }, { width: 30 }];
  guideSheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  await downloadWorkbook(workbook, 'template-import-ccdc.xlsx');
}

export default function ImportEquipmentModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('');
  const [headerFields, setHeaderFields] = useState([]); // [{key,label}] theo đúng cột đọc được trong file
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importErrorRows, setImportErrorRows] = useState(null); // [{row,message}]
  const [importResult, setImportResult] = useState(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      await generateTemplate();
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

      // Giữ đúng thứ tự cột chuẩn (EQUIPMENT_IMPORT_FIELDS) cho phần preview,
      // chỉ hiện các field THỰC SỰ đọc được trong file (hỗ trợ file rút gọn).
      const orderedFields = EQUIPMENT_IMPORT_FIELDS.filter((f) => matchedFields.includes(f.key));
      setHeaderFields(orderedFields);

      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header
        const obj = {};
        let hasAnyValue = false;
        Object.entries(keyMap).forEach(([colNumber, key]) => {
          const val = cellToString(row.getCell(Number(colNumber)));
          if (val) hasAnyValue = true;
          obj[key] = val;
        });
        if (!hasAnyValue) return; // bỏ qua dòng trắng hoàn toàn
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

    const result = await apiFetchJson('/api/equipments/import', {
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

  const invalidRowCount = parsedRows.filter((r) => !r.maMbc || (!r.tenMay && !r.maCcdc)).length;
  const previewRows = parsedRows.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Import CCDC Từ Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-slate-400">
              File <code className="text-purple-300">.xlsx</code> sheet "Dữ Liệu", dòng 1 là tiêu đề cột (sẽ bị bỏ qua khi đọc dữ liệu).
              Mỗi dòng phải có <b>Mã MBC</b> VÀ (<b>Tên Máy</b> HOẶC <b>Mã CCDC</b>).
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
                    {invalidRowCount} dòng thiếu Mã MBC hoặc (Tên Máy/Mã CCDC) — sẽ bị chặn khi Import
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
                      const invalid = !r.maMbc || (!r.tenMay && !r.maCcdc);
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
                title={invalidRowCount > 0 ? 'Sửa các dòng thiếu Mã MBC hoặc (Tên Máy/Mã CCDC) trong file rồi tải lại' : ''}
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Đang Import...' : `Import ${parsedRows.length} Thiết Bị`}</span>
              </button>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import thành công!</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Bưu Điện Tỉnh Mới', importResult.provincesCreated],
                  ['BĐX Mới', importResult.communesCreated],
                  ['Bưu Cục Mới', importResult.postOfficesCreated],
                  ['Hãng Mới', importResult.brandsCreated],
                  ['Danh Mục Mới', importResult.deviceTypesCreated],
                  ['Thiết Bị Tạo Mới', importResult.equipmentsCreated],
                  ['Thiết Bị Cập Nhật', importResult.equipmentsUpdated]
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
