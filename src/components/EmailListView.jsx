import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Mail,
  Search,
  Plus,
  Edit,
  PowerOff,
  Power,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Save,
  RefreshCw,
  Building2,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Download
} from 'lucide-react';
import { apiFetch, apiFetchJson } from '../utils/api';
import ImportEmailModal from './ImportEmailModal';
import ExportEmailModal from './ExportEmailModal';

// ==========================================
// Modal: Thêm / Sửa Email
// ==========================================
const todayLocalIso = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function AddEditEmailModal({ editing, communes, onClose, onSuccess }) {
  const isEdit = !!editing;

  const [form, setForm] = useState({
    email: editing?.email || '',
    kind: editing?.kind || 'PERSONAL',
    hrm_code: editing?.hrm_code || '',
    full_name: editing?.full_name || '',
    phone: editing?.phone || '',
    job_title: editing?.job_title || '',
    commune_id: editing?.commune_id || '',
    post_office_id: editing?.post_office_id || '',
    created_date: editing?.created_date ? editing.created_date.substring(0, 10) : todayLocalIso()
  });

  const [postOffices, setPostOffices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch post offices when commune changes
  useEffect(() => {
    if (form.commune_id) {
      apiFetch(`/api/organization/post-offices?communeId=${form.commune_id}`)
        .then(res => res.json())
        .then(data => setPostOffices(data || []))
        .catch(err => console.error(err));
    } else {
      setPostOffices([]);
    }
  }, [form.commune_id]);

  const setField = (key) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'commune_id') {
        next.post_office_id = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      setError('Vui lòng nhập Email');
      return;
    }
    if (!form.full_name.trim()) {
      setError('Vui lòng nhập Họ tên / Tên đơn vị');
      return;
    }
    if (form.kind === 'PERSONAL' && !form.hrm_code.trim()) {
      setError('Vui lòng nhập Mã HRM cho Cá nhân');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      email: form.email.trim(),
      kind: form.kind,
      hrm_code: form.kind === 'PERSONAL' ? form.hrm_code.trim() : '',
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      job_title: form.job_title.trim(),
      commune_id: form.commune_id || null,
      post_office_id: form.post_office_id || null,
      created_date: form.created_date || null
    };

    let result;
    if (isEdit) {
      result = await apiFetchJson(`/api/emails/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      result = await apiFetchJson('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Pass result to show warnings/personnelCreated message
    onSuccess(result.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            {isEdit ? <Edit className="w-5 h-5 text-cyan-400" /> : <Plus className="w-5 h-5 text-cyan-400" />}
            <span>{isEdit ? `Sửa Email — ${editing.email}` : 'Thêm Email Mới'}</span>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Email <span className="text-rose-400">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="example@hue.vnpost.vn"
                className="w-full glass-input p-2.5 rounded-xl text-xs"
                required
                disabled={isEdit} // Thường không cho đổi email gốc
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Loại <span className="text-rose-400">*</span></label>
              <select value={form.kind} onChange={setField('kind')} className="w-full glass-input p-2.5 rounded-xl text-xs">
                <option value="PERSONAL">Cá nhân</option>
                <option value="UNIT">Đơn vị</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Họ tên / Tên đơn vị <span className="text-rose-400">*</span></label>
              <input
                type="text"
                value={form.full_name}
                onChange={setField('full_name')}
                placeholder="Nguyễn Văn A"
                className="w-full glass-input p-2.5 rounded-xl text-xs"
                required
              />
            </div>

            {form.kind === 'PERSONAL' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Mã HRM <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  value={form.hrm_code}
                  onChange={setField('hrm_code')}
                  placeholder="Mã HRM"
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                  required
                />
              </div>
            )}

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Số điện thoại</label>
              <input
                type="text"
                value={form.phone}
                onChange={setField('phone')}
                placeholder="0912345678"
                className="w-full glass-input p-2.5 rounded-xl text-xs"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Chức danh</label>
              <input
                type="text"
                value={form.job_title}
                onChange={setField('job_title')}
                placeholder="Chuyên viên"
                className="w-full glass-input p-2.5 rounded-xl text-xs"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Bưu điện xã</label>
              <select value={form.commune_id} onChange={setField('commune_id')} className="w-full glass-input p-2.5 rounded-xl text-xs">
                <option value="">-- Chọn BĐX --</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Bưu cục</label>
              <select value={form.post_office_id} onChange={setField('post_office_id')} className="w-full glass-input p-2.5 rounded-xl text-xs" disabled={!form.commune_id}>
                <option value="">-- Chọn Bưu cục --</option>
                {postOffices.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Ngày khởi tạo</label>
              <input
                type="date"
                value={form.created_date}
                onChange={setField('created_date')}
                className="w-full glass-input p-2.5 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{loading ? 'Đang Xử Lý...' : (isEdit ? 'LƯU THAY ĐỔI' : 'THÊM EMAIL')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Modal: Thu Hồi Email
// ==========================================
function RevokeEmailModal({ emailItem, onClose, onSuccess }) {
  const [revokedDate, setRevokedDate] = useState(() => todayLocalIso());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRevoke = async () => {
    setLoading(true);
    setError('');

    const result = await apiFetchJson(`/api/emails/${emailItem.id}/revoke`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revoked_date: revokedDate })
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess(result.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 bg-slate-900/60">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-rose-400" />
            <span>Thu Hồi Email</span>
          </h3>
        </div>
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 text-sm">
            Xác nhận thu hồi email <strong className="text-white">{emailItem.email}</strong>?
          </p>
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Ngày thu hồi</label>
            <input
              type="date"
              value={revokedDate}
              onChange={(e) => setRevokedDate(e.target.value)}
              className="w-full glass-input p-2.5 rounded-xl"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Xác nhận thu hồi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Main View — Quản Lý Email
// ==========================================
export default function EmailListView({ authUser, search, setSearch }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [communes, setCommunes] = useState([]);
  const [postOffices, setPostOffices] = useState([]);

  // Lọc
  const [selectedKind, setSelectedKind] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState('');
  const [selectedPostOfficeId, setSelectedPostOfficeId] = useState('');
  
  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [revokingEmail, setRevokingEmail] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [message, setMessage] = useState(null);

  const debounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination(p => ({ ...p, page: 1 }));
    }, 300);
  }, [search]);

  useEffect(() => {
    apiFetch('/api/organization/communes')
      .then(res => res.json())
      .then(data => setCommunes(data || []))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedCommuneId) {
      apiFetch(`/api/organization/post-offices?communeId=${selectedCommuneId}`)
        .then(res => res.json())
        .then(data => setPostOffices(data || []))
        .catch(err => console.error(err));
    } else {
      setPostOffices([]);
      setSelectedPostOfficeId('');
    }
  }, [selectedCommuneId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (selectedKind) params.append('kind', selectedKind);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedCommuneId) params.append('communeId', selectedCommuneId);
    if (selectedPostOfficeId) params.append('postOfficeId', selectedPostOfficeId);
    params.append('page', pagination.page);
    params.append('limit', pagination.limit);

    apiFetchJson(`/api/emails?${params.toString()}`)
      .then(result => {
        if (cancelled) return;
        setLoading(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setItems(result.data.items || []);
        if (result.data.pagination) {
          setPagination(p => ({ ...p, total: result.data.pagination.total, totalPages: result.data.pagination.totalPages }));
        }
      })
      .catch(err => {
        if (cancelled) return;
        setLoading(false);
        setError(err.message);
      });

    return () => { cancelled = true; };
  }, [debouncedSearch, selectedKind, selectedStatus, selectedCommuneId, selectedPostOfficeId, pagination.page, pagination.limit, refreshKey]);

  const handleMutationSuccess = (resultData) => {
    setRefreshKey(prev => prev + 1);
    if (resultData) {
      let msgTexts = [];
      if (resultData.personnelCreated) {
        msgTexts.push('Đã thêm người dùng HRM mới vào danh mục Người sử dụng.');
      }
      if (resultData.warnings && resultData.warnings.length > 0) {
        msgTexts.push(...resultData.warnings);
      }
      if (msgTexts.length > 0) {
        setMessage(msgTexts.join('\n'));
        setTimeout(() => setMessage(null), 8000);
      }
    }
  };

  const handleReactivate = async (emailItem) => {
    if (!window.confirm(`Bạn có chắc muốn kích hoạt lại email "${emailItem.email}"?`)) return;
    const result = await apiFetchJson(`/api/emails/${emailItem.id}/reactivate`, { method: 'PUT' });
    if (!result.ok) {
      alert(`Lỗi: ${result.error}`);
      return;
    }
    handleMutationSuccess(result.data);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedKind('');
    setSelectedStatus('');
    setSelectedCommuneId('');
    setSelectedPostOfficeId('');
    setPagination(p => ({ ...p, page: 1 }));
  };

  const hasFilters = search || selectedKind || selectedStatus || selectedCommuneId || selectedPostOfficeId;
  const canEdit = authUser?.role !== 'STAFF';

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return isoString;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Messages */}
      {message && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm flex items-start gap-3 shadow-lg shadow-yellow-500/5 transition-all">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-400" />
          <div className="whitespace-pre-line">{message}</div>
          <button onClick={() => setMessage(null)} className="ml-auto text-yellow-400 hover:text-yellow-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Filters */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              <span>Quản Lý Email</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Danh sách email công vụ của Đơn vị và Cá nhân
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={() => {
                  setEditingEmail(null);
                  setIsFormOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Email</span>
              </button>
            )}
            
            {canEdit && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md shadow-purple-500/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-400 glass-input hover:border-cyan-500/40 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo email, họ tên, mã HRM, số điện thoại..."
              className="w-full glass-input pl-9 pr-3 py-2 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Loại</label>
              <select
                value={selectedKind}
                onChange={handleFilterChange(setSelectedKind)}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs"
              >
                <option value="">-- Tất cả --</option>
                <option value="PERSONAL">Cá nhân</option>
                <option value="UNIT">Đơn vị</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Trạng thái</label>
              <select
                value={selectedStatus}
                onChange={handleFilterChange(setSelectedStatus)}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs"
              >
                <option value="">-- Tất cả --</option>
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="REVOKED">Đã thu hồi</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Bưu điện xã</label>
              <select
                value={selectedCommuneId}
                onChange={(e) => {
                  setSelectedCommuneId(e.target.value);
                  setSelectedPostOfficeId('');
                  setPagination(p => ({ ...p, page: 1 }));
                }}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs"
              >
                <option value="">-- Tất cả BĐX --</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Bưu cục</label>
              <select
                value={selectedPostOfficeId}
                onChange={handleFilterChange(setSelectedPostOfficeId)}
                disabled={!selectedCommuneId}
                className="w-full glass-input px-3 py-2 rounded-xl text-xs disabled:opacity-50"
              >
                <option value="">-- Tất cả bưu cục --</option>
                {postOffices.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white glass-input hover:border-slate-500 transition-all"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang nạp danh sách email...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Mail className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-sm text-slate-300">Không có email phù hợp</p>
            <p className="text-xs text-slate-500 mt-1">Chưa có email nào trong hệ thống hoặc không khớp bộ lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Email & Loại</th>
                  <th className="py-3.5 px-4">Họ Tên & HRM</th>
                  <th className="py-3.5 px-4">Liên Hệ & Chức Danh</th>
                  <th className="py-3.5 px-4">BĐ Xã & Bưu Cục</th>
                  <th className="py-3.5 px-4">Trạng Thái & Ngày</th>
                  {canEdit && <th className="py-3.5 px-4 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((em) => {
                  const isRevoked = !!em.revoked_date;
                  return (
                    <tr key={em.id} className="hover:bg-slate-800/40 transition-colors align-top">
                      {/* Cột 1: Email & Loại */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100">{em.email}</div>
                        <div className="mt-1">
                          {em.kind === 'UNIT' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-semibold">
                              <Building2 className="w-3 h-3" /> Đơn vị
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-semibold">
                              <User className="w-3 h-3" /> Cá nhân
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 2: Họ tên & HRM */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-semibold">{em.full_name}</div>
                        {em.kind === 'PERSONAL' && (
                          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            HRM: {em.hrm_code || '—'}
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Liên hệ & Chức danh */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300 font-mono">{em.phone || '—'}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{em.job_title || '—'}</div>
                      </td>

                      {/* Cột 4: BĐ xã & Bưu cục */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300">
                          {em.commune_code ? `${em.commune_code} — ${em.commune_name}` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {em.post_office_code ? `${em.post_office_code} — ${em.post_office_name}` : '—'}
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái & Ngày */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {isRevoked ? (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-400/80" />
                              <span className="text-rose-400/80 font-semibold text-[11px]">Đã thu hồi</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold text-[11px]">Đang sử dụng</span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5">
                          {em.created_date && <span>Khởi tạo: {formatDate(em.created_date)}</span>}
                          {isRevoked && <span className="text-rose-400/70">Thu hồi: {formatDate(em.revoked_date)}</span>}
                        </div>
                      </td>

                      {/* Cột 6: Thao tác */}
                      {canEdit && (
                        <td className="py-3.5 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingEmail(em);
                                setIsFormOpen(true);
                              }}
                              title="Sửa"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {isRevoked ? (
                              <button
                                onClick={() => handleReactivate(em)}
                                title="Kích hoạt lại"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setRevokingEmail(em)}
                                title="Thu hồi"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <PowerOff className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Tổng số <span className="font-bold text-white">{pagination.total}</span> email
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
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
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 rounded-lg glass-input text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-cyan-500/40 transition-all flex items-center gap-1"
              >
                <span>Trang sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isFormOpen && (
        <AddEditEmailModal
          editing={editingEmail}
          communes={communes}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEmail(null);
          }}
          onSuccess={handleMutationSuccess}
        />
      )}

      {revokingEmail && (
        <RevokeEmailModal
          emailItem={revokingEmail}
          onClose={() => setRevokingEmail(null)}
          onSuccess={handleMutationSuccess}
        />
      )}

      {showImportModal && (
        <ImportEmailModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(resData) => {
            setShowImportModal(false);
            handleMutationSuccess(resData);
          }}
        />
      )}

      {showExportModal && (
        <ExportEmailModal
          onClose={() => setShowExportModal(false)}
          filterParams={{ search: debouncedSearch, kind: selectedKind, status: selectedStatus, communeId: selectedCommuneId, postOfficeId: selectedPostOfficeId }}
          hasFilters={hasFilters}
        />
      )}
    </div>
  );
}
