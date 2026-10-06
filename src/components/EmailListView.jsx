import React, { useEffect, useState, useRef } from 'react';
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
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-info w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b-2 border-surface-alt flex items-center justify-between shrink-0">
          <h3 className="font-extrabold text-[18px] text-ink flex items-center gap-2">
            <span>{isEdit ? `Sửa Email — ${editing.email}` : 'Thêm Email Mới'}</span>
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-danger text-white flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[13px] font-bold">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Email <span className="text-danger">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="example@hue.vnpost.vn"
                className={`bg-surface-alt text-ink text-[14px] h-10 px-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary ${error && !form.email.trim() ? 'outline-2 outline-danger' : ''}`}
                required
                disabled={isEdit}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Loại <span className="text-danger">*</span></label>
              <select value={form.kind} onChange={setField('kind')} className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary">
                <option value="PERSONAL">Cá nhân</option>
                <option value="UNIT">Đơn vị</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Họ tên / Tên đơn vị <span className="text-danger">*</span></label>
              <input
                type="text"
                value={form.full_name}
                onChange={setField('full_name')}
                placeholder="Nguyễn Văn A"
                className={`bg-surface-alt text-ink text-[14px] h-10 px-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary ${error && !form.full_name.trim() ? 'outline-2 outline-danger' : ''}`}
                required
              />
            </div>

            {form.kind === 'PERSONAL' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Mã HRM <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={form.hrm_code}
                  onChange={setField('hrm_code')}
                  placeholder="Mã HRM"
                  className={`bg-surface-alt text-ink text-[14px] h-10 px-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary ${error && !form.hrm_code.trim() ? 'outline-2 outline-danger' : ''}`}
                  required
                />
              </div>
            )}

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Số điện thoại</label>
              <input
                type="text"
                value={form.phone}
                onChange={setField('phone')}
                placeholder="0912345678"
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Chức danh</label>
              <input
                type="text"
                value={form.job_title}
                onChange={setField('job_title')}
                placeholder="Chuyên viên"
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Bưu điện xã</label>
              <select value={form.commune_id} onChange={setField('commune_id')} className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary">
                <option value="">-- Chọn BĐX --</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Bưu cục</label>
              <select value={form.post_office_id} onChange={setField('post_office_id')} className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary disabled:opacity-50" disabled={!form.commune_id}>
                <option value="">-- Chọn Bưu cục --</option>
                {postOffices.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Ngày khởi tạo</label>
              <input
                type="date"
                value={form.created_date}
                onChange={setField('created_date')}
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary"
              />
            </div>
          </div>

          <div className="pt-4 border-t-2 border-surface-alt flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-accent text-ink font-bold h-10 px-4 hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-info w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b-2 border-surface-alt flex items-center justify-between">
          <h3 className="font-extrabold text-[18px] text-ink flex items-center gap-2">
            <span>Thu Hồi Email</span>
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-[14px] text-ink">
            Xác nhận thu hồi email <strong className="font-extrabold">{emailItem.email}</strong>?
          </p>
          {error && (
            <div className="p-3 bg-danger text-white flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-[13px] font-bold">{error}</span>
            </div>
          )}
          <div>
            <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Ngày thu hồi</label>
            <input
              type="date"
              value={revokedDate}
              onChange={(e) => setRevokedDate(e.target.value)}
              className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-surface-alt mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              onClick={handleRevoke}
              disabled={loading}
              className="bg-danger text-white font-bold h-10 px-4 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="p-3 bg-accent text-ink flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="whitespace-pre-line text-[13px] font-bold">{message}</div>
          <button onClick={() => setMessage(null)} className="ml-auto hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header & Filters */}
      <div className="bg-surface border-2 border-info p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold text-ink tracking-wide">Quản Lý Email</h1>
            <p className="text-[14px] text-muted mt-1">
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
                className="bg-accent text-ink font-bold h-10 px-4 hover:bg-accent-hover transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Email</span>
              </button>
            )}
            
            {canEdit && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pt-6 border-t-2 border-surface-alt space-y-4">
          <div className="relative">
            <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Tìm kiếm</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo email, họ tên, mã HRM, số điện thoại..."
                className="bg-surface-alt text-ink text-[14px] h-10 pl-9 pr-3 w-full placeholder:text-muted focus:outline-2 focus:outline-primary"
              />
            </div>
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Loại</label>
              <select
                value={selectedKind}
                onChange={handleFilterChange(setSelectedKind)}
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary"
              >
                <option value="">-- Tất cả --</option>
                <option value="PERSONAL">Cá nhân</option>
                <option value="UNIT">Đơn vị</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Trạng thái</label>
              <select
                value={selectedStatus}
                onChange={handleFilterChange(setSelectedStatus)}
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary"
              >
                <option value="">-- Tất cả --</option>
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="REVOKED">Đã thu hồi</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Bưu điện xã</label>
              <select
                value={selectedCommuneId}
                onChange={(e) => {
                  setSelectedCommuneId(e.target.value);
                  setSelectedPostOfficeId('');
                  setPagination(p => ({ ...p, page: 1 }));
                }}
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary"
              >
                <option value="">-- Tất cả BĐX --</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[12px] font-extrabold text-muted uppercase tracking-[0.05em] mb-1.5">Bưu cục</label>
              <select
                value={selectedPostOfficeId}
                onChange={handleFilterChange(setSelectedPostOfficeId)}
                disabled={!selectedCommuneId}
                className="bg-surface-alt text-ink text-[14px] h-10 px-3 w-full focus:outline-2 focus:outline-primary disabled:opacity-50"
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
                className="bg-surface-alt text-ink font-bold h-10 px-4 hover:bg-sky transition-colors shrink-0"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger text-white flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="text-[13px] font-bold">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border-2 border-info">
        {loading && items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-surface-alt border-t-primary rounded-full animate-spin"></div>
            <p className="text-[14px] text-muted">Đang nạp danh sách email...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <Mail className="w-12 h-12 mx-auto mb-3" />
            <p className="font-extrabold text-[16px] text-ink">Không có email phù hợp</p>
            <p className="text-[14px] mt-1">Chưa có email nào trong hệ thống hoặc không khớp bộ lọc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-alt">
                <tr>
                  <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap">Email & Loại</th>
                  <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap">Họ Tên & HRM</th>
                  <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap">Liên Hệ & Chức Danh</th>
                  <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap">BĐ Xã & Bưu Cục</th>
                  <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap">Trạng Thái & Ngày</th>
                  {canEdit && <th className="py-3 px-5 text-[12px] font-extrabold uppercase tracking-[0.05em] text-muted whitespace-nowrap text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((em) => {
                  const isRevoked = !!em.revoked_date;
                  return (
                    <tr key={em.id} className="hover:bg-sidebar transition-colors align-top border-t-2 border-surface-alt">
                      {/* Cột 1: Email & Loại */}
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[14px] text-ink">{em.email}</div>
                        <div className="mt-1.5">
                          {em.kind === 'UNIT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky text-ink text-[12px] font-extrabold">
                              Đơn vị
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-accent text-ink text-[12px] font-extrabold">
                              Cá nhân
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 2: Họ tên & HRM */}
                      <td className="py-3.5 px-5 text-[14px]">
                        <div className="text-ink font-bold">{em.full_name}</div>
                        {em.kind === 'PERSONAL' && (
                          <div className="text-[12px] text-muted mt-0.5 font-mono">
                            HRM: {em.hrm_code || '—'}
                          </div>
                        )}
                      </td>

                      {/* Cột 3: Liên hệ & Chức danh */}
                      <td className="py-3.5 px-5 text-[14px]">
                        <div className="text-ink font-mono font-bold">{em.phone || '—'}</div>
                        <div className="text-[12px] text-muted mt-0.5">{em.job_title || '—'}</div>
                      </td>

                      {/* Cột 4: BĐ xã & Bưu cục */}
                      <td className="py-3.5 px-5 text-[14px]">
                        <div className="text-ink font-bold">
                          {em.commune_code ? `${em.commune_code} — ${em.commune_name}` : '—'}
                        </div>
                        <div className="text-[12px] text-muted mt-0.5">
                          {em.post_office_code ? `${em.post_office_code} — ${em.post_office_name}` : '—'}
                        </div>
                      </td>

                      {/* Cột 5: Trạng thái & Ngày */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5">
                          {isRevoked ? (
                            <span className="inline-block px-2.5 py-0.5 bg-danger text-white font-extrabold text-[12px]">Đã thu hồi</span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 bg-success text-ink font-extrabold text-[12px]">Đang sử dụng</span>
                          )}
                        </div>
                        <div className="text-[12px] text-muted mt-1.5 flex flex-col gap-0.5">
                          {em.created_date && <span>Khởi tạo: {formatDate(em.created_date)}</span>}
                          {isRevoked && <span className="text-danger font-bold">Thu hồi: {formatDate(em.revoked_date)}</span>}
                        </div>
                      </td>

                      {/* Cột 6: Thao tác */}
                      {canEdit && (
                        <td className="py-3.5 px-5">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingEmail(em);
                                setIsFormOpen(true);
                              }}
                              title="Sửa"
                              className="w-8 h-8 flex items-center justify-center bg-success hover:bg-sky transition-colors"
                            >
                              <Edit className="w-4 h-4 text-ink" strokeWidth={2} />
                            </button>
                            {isRevoked ? (
                              <button
                                onClick={() => handleReactivate(em)}
                                title="Kích hoạt lại"
                                className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky transition-colors"
                              >
                                <Power className="w-4 h-4 text-ink" strokeWidth={2} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setRevokingEmail(em)}
                                title="Thu hồi"
                                className="w-8 h-8 flex items-center justify-center bg-surface-alt hover:bg-sky transition-colors"
                              >
                                <PowerOff className="w-4 h-4 text-ink" strokeWidth={2} />
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
          <div className="p-4 border-t-2 border-surface-alt flex items-center justify-between bg-surface">
            <div className="text-[13px] font-bold text-muted">
              Tổng số <span className="font-extrabold text-ink">{pagination.total}</span> bản ghi
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="w-8 h-8 flex items-center justify-center bg-surface-alt text-ink hover:bg-sky disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-8 h-8 flex items-center justify-center bg-primary text-white font-bold text-[13px]">
                {pagination.page}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="w-8 h-8 flex items-center justify-center bg-surface-alt text-ink hover:bg-sky disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
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
          onSuccess={() => {
            setRefreshKey(prev => prev + 1);
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
