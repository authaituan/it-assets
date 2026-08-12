import React, { useState } from 'react';
import { 
  UserCheck, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Users, 
  FileSpreadsheet,
  RefreshCw,
  Cpu
} from 'lucide-react';

export default function HrmMappingView() {
  const [hrmText, setHrmText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load sample HRM data extracted from Excel for demonstration
  const handleLoadSampleHrm = () => {
    const sampleHrm = [
      { hrmCode: 'HRM-53001', fullName: 'THANH THÌN', postOfficeCode: '536750', communeCode: '5300' },
      { hrmCode: 'HRM-53002', fullName: 'HOÀI PHƯƠNG', postOfficeCode: '536801', communeCode: '5302' },
      { hrmCode: 'HRM-53003', fullName: 'NGUYỄN THU THỦY', postOfficeCode: '534811', communeCode: '5301' },
      { hrmCode: 'HRM-53004', fullName: 'VÕ KHẮC QUÝ', postOfficeCode: '536190', communeCode: '5303' },
      { hrmCode: 'HRM-53005', fullName: 'VŨ THIÊN HƯƠNG', postOfficeCode: '535041', communeCode: '5305' },
      { hrmCode: 'HRM-53006', fullName: 'TRẦN NHẬT TÂN', postOfficeCode: '537100', communeCode: '5307' },
      { hrmCode: 'HRM-53007', fullName: 'TRẦN PHÚ THÀNH', postOfficeCode: '537101', communeCode: '5307' },
      { hrmCode: 'HRM-53008', fullName: 'LÊ THỊ HỒNG NHUNG', postOfficeCode: '535570', communeCode: '5306' }
    ];

    setHrmText(JSON.stringify(sampleHrm, null, 2));
  };

  const handleRunAutoMapping = () => {
    let parsedEmployees = [];
    try {
      if (hrmText) {
        parsedEmployees = JSON.parse(hrmText);
      } else {
        // Default sample if empty
        parsedEmployees = [
          { hrmCode: 'HRM-53001', fullName: 'THANH THÌN', postOfficeCode: '536750', communeCode: '5300' },
          { hrmCode: 'HRM-53002', fullName: 'HOÀI PHƯƠNG', postOfficeCode: '536801', communeCode: '5302' },
          { hrmCode: 'HRM-53003', fullName: 'NGUYỄN THU THỦY', postOfficeCode: '534811', communeCode: '5301' },
          { hrmCode: 'HRM-53004', fullName: 'VÕ KHẮC QUÝ', postOfficeCode: '536190', communeCode: '5303' },
          { hrmCode: 'HRM-53005', fullName: 'VŨ THIÊN HƯƠNG', postOfficeCode: '535041', communeCode: '5305' },
          { hrmCode: 'HRM-53006', fullName: 'TRẦN NHẬT TÂN', postOfficeCode: '537100', communeCode: '5307' },
          { hrmCode: 'HRM-53007', fullName: 'TRẦN PHÚ THÀNH', postOfficeCode: '537101', communeCode: '5307' },
          { hrmCode: 'HRM-53008', fullName: 'LÊ THỊ HỒNG NHUNG', postOfficeCode: '535570', communeCode: '5306' }
        ];
      }
    } catch (e) {
      alert("Dữ liệu JSON HRM chưa hợp lệ!");
      return;
    }

    setLoading(true);
    fetch('/api/hrm/upload-and-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hrmEmployees: parsedEmployees })
    })
      .then(res => res.json())
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title Header */}
      <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-400" />
            <span>Tích Hợp & Auto-Mapping Dữ Liệu File HRM Nhân Sự</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Nhập file HRM (Mã HRM, Họ và Tên, Mã bưu cục, Mã BĐX) ➔ Tự động đối soát & gán người sử dụng vào CCDC
          </p>
        </div>

        <button
          onClick={handleLoadSampleHrm}
          className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Tải Dữ Liệu Mẫu HRM</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Card */}
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-purple-400" />
            <span>Dữ Liệu File Excel HRM Nhân Sự</span>
          </h3>

          <p className="text-xs text-slate-400">
            Dữ liệu định dạng JSON gồm các trường: <code className="text-purple-300">hrmCode</code>, <code className="text-purple-300">fullName</code>, <code className="text-purple-300">postOfficeCode</code>, <code className="text-purple-300">communeCode</code>
          </p>

          <textarea
            rows={12}
            value={hrmText}
            onChange={(e) => setHrmText(e.target.value)}
            placeholder="Dán nội dung JSON HRM hoặc bấm nút [Tải Dữ Liệu Mẫu HRM] phía trên..."
            className="w-full font-mono text-xs glass-input p-4 rounded-xl resize-none"
          />

          <button
            onClick={handleRunAutoMapping}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>{loading ? 'Đang Auto-Mapping...' : 'KÍCH HOẠT AUTO-MAPPING HRM VÀO CCDC'}</span>
          </button>
        </div>

        {/* Results Card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Kết Quả Auto-Mapping Tự Động</span>
            </h3>

            {!result ? (
              <div className="p-8 text-center text-slate-500 my-auto">
                <Users className="w-12 h-12 mx-auto text-slate-700 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Chưa thực hiện Auto-Mapping</p>
                <p className="text-xs text-slate-600 mt-1">Bấm kích hoạt phía bên trái để tự động nối thông tin nhân sự với CCDC</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                    <div className="text-xs text-slate-400">Số Nhân Sự HRM</div>
                    <div className="text-xl font-bold text-white mt-1">{result.stats.totalHrmInput}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                    <div className="text-xs text-purple-300">Tạo Mới Nhân Viên</div>
                    <div className="text-xl font-bold text-purple-400 mt-1">{result.stats.usersCreated}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <div className="text-xs text-emerald-300">CCDC Khớp Thành Công</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{result.stats.assetsAutoMapped}</div>
                  </div>
                </div>

                {/* Details list */}
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Tên Thô (dulieu.xlsx)</th>
                        <th className="py-2.5 px-3">Nhân Viên HRM Khớp</th>
                        <th className="py-2.5 px-3">Mã HRM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {result.mappingDetails && result.mappingDetails.map((detail, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-slate-300">{detail.rawName}</td>
                          <td className="py-2 px-3 text-emerald-400 font-bold">{detail.matchedUser}</td>
                          <td className="py-2 px-3 text-purple-300">{detail.hrmCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 mt-4 text-[11px] text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Thuật toán Smart Normalization loại bỏ dấu tiếng Việt & tự động map theo Mã Bưu cục (MBC) + Mã BĐX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
