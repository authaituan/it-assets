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
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-info w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b-2 border-surface-alt flex items-center justify-between shrink-0">
          <h3 className="font-extrabold text-[18px] text-ink">
            Import Email Từ Excel
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {!importResult && (
            <>
          {hasExampleWarnings && (
            <div className="p-3 bg-accent text-ink flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[13px] font-bold">Cảnh báo: Phát hiện các dòng ví dụ nền vàng trong template (chứa vidu.*@example.com). Các dòng này phải xoá trước khi import để tránh lỗi hoặc dữ liệu rác.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-sky p-3 text-ink">
            <p className="text-[13px] font-bold">
              File .xlsx sheet "Dữ liệu", dòng 1 là tiêu đề cột. Mỗi dòng phải có Email. Email đã có → cập nhật; email chưa có → tạo mới.
            </p>
            <button
              onClick={handleDownloadTemplate}
              disabled={generatingTemplate}
              className="shrink-0 flex items-center gap-2 px-4 h-10 font-bold bg-surface-alt text-ink hover:bg-sky disabled:opacity-50 disabled:cursor-not-allowed border-2 border-info"
            >
              {generatingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              <span>Tải template</span>
            </button>
          </div>

          <div className="border-2 border-dashed border-info bg-surface-alt hover:bg-sky/30 transition-colors p-6 flex flex-col items-center justify-center relative cursor-pointer">
            <label className="absolute inset-0 w-full h-full cursor-pointer opacity-0">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="w-full h-full cursor-pointer"
              />
            </label>
            <Upload className="w-8 h-8 text-primary mb-2" />
            <span className="text-[14px] font-bold text-ink">Bấm hoặc Kéo thả File Excel (.xlsx) vào đây</span>
            <span className="text-[12px] text-muted mt-1">{fileName ? `Đã chọn: ${fileName}` : 'Chưa chọn file'}</span>
          </div>

          {parsing && (
            <div className="flex items-center gap-2 text-primary font-bold text-[13px]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang đọc file Excel...</span>
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-danger text-white flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[13px] font-bold">{parseError}</span>
            </div>
          )}

          {parsedRows.length > 0 && !importResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-[16px] text-ink flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span>
                    Xem trước ({parsedRows.length} dòng từ "{fileName}"
                    {parsedRows.length > 20 ? ` — hiện 20 dòng đầu` : ''})
                  </span>
                </h4>
              </div>

              <div className="overflow-auto max-h-[320px] border-2 border-info">
                <table className="w-full text-left">
                  <thead className="bg-surface-alt text-muted sticky top-0">
                    <tr>
                      {EMAIL_FIELDS.map((f) => (
                        <th key={f.key} className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] whitespace-nowrap border-b-2 border-info">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-sidebar border-t-2 border-surface-alt">
                        {EMAIL_FIELDS.map((f) => (
                          <td key={f.key} className="py-3.5 px-5 text-[14px] text-ink whitespace-nowrap">
                            {r[f.key] || <span className="text-muted">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importError && (
                <div className="p-3 bg-white border-l-4 border-danger space-y-2">
                  <div className="flex items-start gap-2 text-danger">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-[13px] font-bold">Lỗi: {importError} — Chưa có dữ liệu nào được ghi.</span>
                  </div>
                  {importErrorRows && (
                    <div className="space-y-1">
                      {importErrorRows.map((e, idx) => (
                        <div key={idx} className="p-2 bg-danger text-white text-[13px] font-bold">
                          Dòng {e.row}: {e.message}
                        </div>
                      ))}
                      {isTruncated && <div className="p-2 bg-danger text-white text-[13px] font-bold">…và còn nhiều lỗi khác (chỉ hiện 100 lỗi đầu).</div>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t-2 border-surface-alt">
                <button
                  onClick={onClose}
                  disabled={importing}
                  className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !!parseError}
                  className="bg-accent text-ink font-bold h-10 px-4 hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{importing ? 'Đang Import...' : `Import ${parsedRows.length} Email`}</span>
                </button>
              </div>
            </div>
          )}
          </>
          )}

          {importResult && (
            <div className="p-6 border-2 border-info bg-surface space-y-4">
              <div className="p-3 bg-success text-ink flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-[14px] font-extrabold">Import thành công!</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Tạo mới', importResult.created],
                  ['Cập nhật', importResult.updated],
                  ['Người sử dụng', importResult.personnelCreated]
                ].map(([label, value]) => (
                  <div key={label} className="p-4 bg-surface-alt text-center border-2 border-info">
                    <div className="text-[12px] font-bold text-muted uppercase">{label}</div>
                    <div className="text-[24px] font-extrabold text-ink mt-1">{value ?? 0}</div>
                  </div>
                ))}
              </div>
              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="p-3 bg-accent text-ink mt-4">
                  <div className="font-bold mb-1 text-[13px] flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Cảnh báo:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {importResult.warnings.map((w, idx) => (
                      <li key={idx} className="text-[12px] font-bold">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button
                  onClick={onClose}
                  className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
