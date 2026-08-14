import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// Đọc giá trị 1 cell ExcelJS về chuỗi text thuần — cell.value có thể là
// string, number, null, hoặc object (rich text/formula/hyperlink...) tuỳ
// định dạng cell trong file .xlsx gốc.
function cellToString(cell) {
  const v = cell ? cell.value : null;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((rt) => rt.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result); // formula cell
    return '';
  }
  return String(v).trim();
}

export default function ImportPersonnelModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]); // preview, đã parse
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setImportResult(null);
    setImportError('');
    setParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        setParseError('File Excel không có sheet nào');
        setParsing(false);
        return;
      }

      // Đọc đúng 4 cột theo thứ tự: Mã HRM (A), Tên Nhân Viên (B), Mã BC (C),
      // Mã BĐX (D) — bỏ qua dòng tiêu đề (dòng 1).
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header
        const hrmCode = cellToString(row.getCell(1));
        const fullName = cellToString(row.getCell(2));
        const postOfficeCode = cellToString(row.getCell(3));
        const communeCode = cellToString(row.getCell(4));

        // Bỏ qua dòng hoàn toàn trống (Excel đôi khi có dòng trắng thừa cuối file).
        if (!hrmCode && !fullName && !postOfficeCode && !communeCode) return;

        rows.push({ hrmCode, fullName, postOfficeCode, communeCode });
      });

      if (rows.length === 0) {
        setParseError('Không đọc được dòng dữ liệu nào (kiểm tra lại file có đúng 4 cột A-D và có dữ liệu từ dòng 2)');
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

    const result = await apiFetchJson('/api/personnel/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personnel: parsedRows })
    });

    setImporting(false);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    setImportResult(result.data);
    onSuccess();
  };

  const invalidRowCount = parsedRows.filter((r) => !r.hrmCode || !r.fullName).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Import Nhân Sự Từ Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          <p className="text-slate-400">
            File <code className="text-purple-300">.xlsx</code> đúng 4 cột theo thứ tự: <b>A</b> Mã HRM, <b>B</b> Tên Nhân Viên,{' '}
            <b>C</b> Mã BC, <b>D</b> Mã BĐX. Dòng 1 là tiêu đề (sẽ bị bỏ qua).
          </p>

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
                  <span>Xem Trước ({parsedRows.length} dòng từ "{fileName}")</span>
                </h4>
                {invalidRowCount > 0 && (
                  <span className="text-rose-400 text-[11px] font-semibold">
                    {invalidRowCount} dòng thiếu Mã HRM/Tên — sẽ bị chặn khi Import
                  </span>
                )}
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Mã HRM</th>
                      <th className="py-2 px-3">Tên Nhân Viên</th>
                      <th className="py-2 px-3">Mã BC</th>
                      <th className="py-2 px-3">Mã BĐX</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {parsedRows.map((r, idx) => {
                      const invalid = !r.hrmCode || !r.fullName;
                      return (
                        <tr key={idx} className={invalid ? 'bg-rose-500/5' : 'hover:bg-slate-800/40'}>
                          <td className="py-1.5 px-3 text-cyan-400">{r.hrmCode || <span className="text-rose-400">(thiếu)</span>}</td>
                          <td className="py-1.5 px-3 text-slate-200">{r.fullName || <span className="text-rose-400">(thiếu)</span>}</td>
                          <td className="py-1.5 px-3 text-slate-400">{r.postOfficeCode || '—'}</td>
                          <td className="py-1.5 px-3 text-slate-400">{r.communeCode || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || invalidRowCount > 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                title={invalidRowCount > 0 ? 'Sửa các dòng thiếu Mã HRM/Tên trong file rồi tải lại' : ''}
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Đang Import...' : `Import ${parsedRows.length} Nhân Sự`}</span>
              </button>
            </div>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import thành công!</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-900/60 text-center">
                  <div className="text-[11px] text-slate-400">Tạo Mới</div>
                  <div className="text-lg font-bold text-emerald-400">{importResult.created}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/60 text-center">
                  <div className="text-[11px] text-slate-400">Cập Nhật</div>
                  <div className="text-lg font-bold text-cyan-400">{importResult.updated}</div>
                </div>
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
