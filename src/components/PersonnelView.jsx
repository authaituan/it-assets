import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2
} from 'lucide-react';
import { apiFetchJson } from '../utils/api';
import AddPersonnelModal from './AddPersonnelModal';
import ImportPersonnelModal from './ImportPersonnelModal';

export default function PersonnelView() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Lookup mã -> tên thật, tra qua GET /api/organization/post-offices &
  // GET /api/organization/communes (route đọc công khai, không cần token).
  // Bảng `users` (Personnel) chỉ lưu THẲNG mã (post_office_code/commune_code),
  // không có FK trực tiếp tới tên -> phải tự tra bằng code ở tầng frontend.
  const [postOfficeNameByCode, setPostOfficeNameByCode] = useState({});
  const [communeNameByCode, setCommuneNameByCode] = useState({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/organization/post-offices')
      .then((res) => res.json())
      .then((data) => {
        const map = {};
        (data || []).forEach((po) => { map[po.code] = po.name; });
        setPostOfficeNameByCode(map);
      })
      .catch((err) => console.error(err));

    fetch('/api/organization/communes')
      .then((res) => res.json())
      .then((data) => {
        const map = {};
        (data || []).forEach((c) => { map[c.code] = c.name; });
        setCommuneNameByCode(map);
      })
      .catch((err) => console.error(err));
  }, []);

  const fetchPersonnel = () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: pagination.page,
      limit: pagination.limit
    });
    if (search) params.append('search', search);

    // GET /api/personnel yêu cầu token + role quản lý -> phải qua apiFetchJson
    // (khác GET /api/equipments vốn để mở).
    apiFetchJson(`/api/personnel?${params.toString()}`).then((result) => {
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
    fetchPersonnel();
  }, [search, pagination.page]);

  const displayPostOffice = (code) => (code ? (postOfficeNameByCode[code] || code) : '—');
  const displayCommune = (code) => (code ? (communeNameByCode[code] || code) : '—');

  return (
    <div className="p-6 space-y-6">
      {/* Header & Search Bar */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span>Người Sử Dụng</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Quản lý danh sách nhân sự (Mã HRM, Họ Tên, Bưu cục, BĐX) — nguồn gán "Người Sử Dụng" cho thiết bị CCDC
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Import Excel</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Người Sử Dụng</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="pt-2 border-t border-slate-800">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              placeholder="Tìm theo Mã HRM hoặc Họ Tên..."
              className="w-full glass-input pl-9 pr-3 py-2 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Personnel Table Section */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang nạp danh sách nhân sự...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-sm text-slate-300">Không tìm thấy nhân sự phù hợp</p>
            <p className="text-xs text-slate-500 mt-1">Thử thay đổi từ khoá tìm kiếm, hoặc thêm mới / import Excel</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Mã HRM</th>
                  <th className="py-3.5 px-4">Tên Nhân Viên</th>
                  <th className="py-3.5 px-4">Mã BC</th>
                  <th className="py-3.5 px-4">Mã BĐX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-cyan-400 font-medium">{p.hrm_code || '—'}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">{p.full_name}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{displayPostOffice(p.post_office_code)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{displayCommune(p.commune_code)}</span>
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
            Hiển thị <span className="font-bold text-white">{items.length}</span> / <span className="font-bold text-white">{pagination.total}</span> nhân sự
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

      {isAddModalOpen && (
        <AddPersonnelModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchPersonnel}
        />
      )}

      {isImportModalOpen && (
        <ImportPersonnelModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={fetchPersonnel}
        />
      )}
    </div>
  );
}
