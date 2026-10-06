import React, { useState } from 'react';
import { Upload, X, AlertCircle, FileSpreadsheet, RefreshCw, FileDown, CheckCircle2 } from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { apiFetchJson } from '../utils/api';
import { buildTemplateWorkbook, extractRowsFromWorksheet, EMAIL_FIELDS } from '../utils/emailExcel';

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

export default function ImportEmailModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [excelRowsMap, setExcelRowsMap] = useState([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importErrorRows, setImportErrorRows] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [hasExampleWarnings, setHasExampleWarnings] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const handleDownloadTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      const workbook = buildTemplateWorkbook(ExcelJS);
      await downloadWorkbook(workbook, 'template-import-email.xlsx');
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
    setHasExampleWarnings(false);
    setIsTruncated(false);
    setParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.getWorksheet('Dữ liệu') || workbook.worksheets[0];
      if (!worksheet) {
        setParseError('File Excel không có sheet nào');
        setParsing(false);
        return;
      }

      const { rows, excelRows, missingRequiredColumns } = extractRowsFromWorksheet(worksheet);

      if (missingRequiredColumns && missingRequiredColumns.length > 0) {
        setParseError(`File thiếu các cột bắt buộc: ${missingRequiredColumns.join(', ')}`);
        setParsing(false);
        return;
      }

      if (rows.length === 0) {
        setParseError('Không đọc được dòng dữ liệu nào (kiểm tra file có dữ liệu từ dòng 2 trở đi)');
      }

      const hasExamples = rows.some(r => r.email && r.email.toLowerCase().startsWith('vidu.') && r.email.toLowerCase().endsWith('@example.com'));
      setHasExampleWarnings(hasExamples);

      setParsedRows(rows);
      setExcelRowsMap(excelRows);
    } catch (err) {
      console.error(err);
      setParseError('Không đọc được file Excel: ' + err.message);
      setParsedRows([]);
      setExcelRowsMap([]);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    setImportErrorRows(null);
    setIsTruncated(false);

    const result = await apiFetchJson('/api/emails/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: parsedRows })
    });

    setImporting(false);
    if (!result.ok) {
      setImportError(result.error || 'Import thất bại');
      if (result.data && Array.isArray(result.data.errors) && result.data.errors.length > 0) {
        // Map row from backend (0-indexed or 1-indexed based on rows array) to actual excel row
        const mappedErrors = result.data.errors.map(err => {
          // backend trả row là index 1-based của mảng `rows` gửi lên
          const actualExcelRow = excelRowsMap[err.row - 1] || err.row;
          return { row: actualExcelRow, message: err.message };
        });
        setImportErrorRows(mappedErrors);
        setIsTruncated(result.data.truncated || false);
      }
      return;
    }
    setImportResult(result.data);
    onSuccess(result.data);
  };

  const previewRows = parsedRows.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-5xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Import Email Từ Excel</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {!importResult && (
            <>
          {hasExampleWarnings && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Cảnh báo: Phát hiện các dòng ví dụ nền vàng trong template (chứa vidu.*@example.com). Các dòng này phải xoá trước khi import để tránh lỗi hoặc dữ liệu rác.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-slate-400">
              File <code className="text-purple-300">.xlsx</code> sheet "Dữ liệu", dòng 1 là tiêu đề cột.
              Mỗi dòng phải có <b>Email</b>. Email đã có → cập nhật; email chưa có → tạo mới.
            </p>
            <button
              onClick={handleDownloadTemplate}
              disabled={generatingTemplate}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 glass-input hover:border-purple-500/40 transition-all disabled:opacity-50"
            >
              {generatingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>Tải template</span>
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
                    Xem trước ({parsedRows.length} dòng từ "{fileName}"
                    {parsedRows.length > 20 ? ` — hiện 20 dòng đầu` : ''})
                  </span>
                </h4>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-auto max-h-[320px]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      {EMAIL_FIELDS.map((f) => (
                        <th key={f.key} className="py-2 px-3 whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        {EMAIL_FIELDS.map((f) => (
                          <td key={f.key} className="py-1.5 px-3 text-slate-300 whitespace-nowrap">
                            {r[f.key] || <span className="text-slate-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Lỗi: {importError} — Chưa có dữ liệu nào được ghi.</span>
                  </div>
                  {importErrorRows && (
                    <ul className="list-disc list-inside space-y-0.5 pl-5">
                      {importErrorRows.map((e, idx) => (
                        <li key={idx}>Dòng {e.row}: {e.message}</li>
                      ))}
                      {isTruncated && <li>…và còn nhiều lỗi khác (chỉ hiện 100 lỗi đầu).</li>}
                    </ul>
                  )}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || !!parseError}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Đang Import...' : `Import ${parsedRows.length} Email`}</span>
              </button>
            </div>
          )}
          </>
          )}

          {importResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Import thành công!</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Tạo mới', importResult.created],
                  ['Cập nhật', importResult.updated],
                  ['Người sử dụng', importResult.personnelCreated]
                ].map(([label, value]) => (
                  <div key={label} className="p-2.5 rounded-lg bg-slate-900/60 text-center">
                    <div className="text-[10px] text-slate-400">{label}</div>
                    <div className="text-lg font-bold text-emerald-400">{value ?? 0}</div>
                  </div>
                ))}
              </div>
              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="mt-2 text-yellow-400">
                  <div className="font-semibold mb-1 text-[11px]">Cảnh báo:</div>
                  <ul className="list-disc list-inside">
                    {importResult.warnings.map((w, idx) => (
                      <li key={idx} className="text-[10px]">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all"
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
