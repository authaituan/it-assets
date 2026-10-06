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
  Upload,
  Download,
  Building2,
  User,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { apiFetch, apiFetchJson } from '../utils/api';
import ImportEmailModal from './ImportEmailModal';
import ExportEmailModal from './ExportEmailModal';

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
      if (key === 'commune_id') next.post_office_id = '';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) { setError('Vui lòng nhập Email'); return; }
    if (!form.full_name.trim()) { setError('Vui lòng nhập Họ tên / Tên đơn vị'); return; }
    if (form.kind === 'PERSONAL' && !form.hrm_code.trim()) { setError('Vui lòng nhập Mã HRM cho Cá nhân'); return; }

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
    if (!result.ok) { setError(result.error); return; }
    onSuccess(result.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="card-soft w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-[var(--color-kpi-dark)] flex items-center gap-2">
            <span>{isEdit ? `Sửa Email — ${editing.email}` : 'Thêm Email Mới'}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm overflow-y-auto bg-white">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs flex items-start gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={setField('email')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" required disabled={isEdit} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Loại <span className="text-red-500">*</span></label>
              <select value={form.kind} onChange={setField('kind')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm">
                <option value="PERSONAL">Cá nhân</option>
                <option value="UNIT">Đơn vị</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Họ tên / Tên đơn vị <span className="text-red-500">*</span></label>
              <input type="text" value={form.full_name} onChange={setField('full_name')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" required />
            </div>
            {form.kind === 'PERSONAL' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Mã HRM <span className="text-red-500">*</span></label>
                <input type="text" value={form.hrm_code} onChange={setField('hrm_code')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" required />
              </div>
            )}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Số điện thoại</label>
              <input type="text" value={form.phone} onChange={setField('phone')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Chức danh</label>
              <input type="text" value={form.job_title} onChange={setField('job_title')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Bưu điện xã</label>
              <select value={form.commune_id} onChange={setField('commune_id')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm">
                <option value="">-- Chọn BĐX --</option>
                {communes.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Bưu cục</label>
              <select value={form.post_office_id} onChange={setField('post_office_id')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" disabled={!form.commune_id}>
                <option value="">-- Chọn Bưu cục --</option>
                {postOffices.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Ngày khởi tạo</label>
              <input type="date" value={form.created_date} onChange={setField('created_date')} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn-outline-primary border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800">Hủy</button>
            <button type="submit" disabled={loading} className="btn btn-dark flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEdit ? 'Lưu Thay Đổi' : 'Thêm Email'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    if (!result.ok) { setError(result.error); return; }
    onSuccess(result.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="card-soft w-full max-w-sm overflow-hidden bg-white">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-base text-[var(--color-kpi-dark)] flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-red-500" />
            <span>Thu Hồi Email</span>
          </h3>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <p className="text-gray-600">
            Xác nhận thu hồi email <strong className="text-[var(--color-kpi-dark)]">{emailItem.email}</strong>?
          </p>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs flex items-start gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-kpi-dark)] mb-1">Ngày thu hồi</label>
            <input type="date" value={revokedDate} onChange={(e) => setRevokedDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] transition-colors text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} disabled={loading} className="btn btn-outline-primary border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-800">Hủy</button>
            <button onClick={handleRevoke} disabled={loading} className="btn btn-dark !bg-red-600 hover:!bg-red-700 flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Thu Hồi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailListView({ authUser, search, setSearch }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [communes, setCommunes] = useState([]);
  const [postOffices, setPostOffices] = useState([]);
  const [selectedKind, setSelectedKind] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState('');
  const [selectedPostOfficeId, setSelectedPostOfficeId] = useState('');
  
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
    apiFetch('/api/organization/communes').then(res => res.json()).then(data => setCommunes(data || [])).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedCommuneId) {
      apiFetch(`/api/organization/post-offices?communeId=${selectedCommuneId}`).then(res => res.json()).then(data => setPostOffices(data || [])).catch(err => console.error(err));
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
        if (!result.ok) { setError(result.error); return; }
        setItems(result.data.items || []);
        if (result.data.pagination) setPagination(p => ({ ...p, total: result.data.pagination.total, totalPages: result.data.pagination.totalPages }));
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
      if (resultData.personnelCreated) msgTexts.push('Đã thêm người dùng HRM mới vào danh mục Người sử dụng.');
      if (resultData.warnings && resultData.warnings.length > 0) msgTexts.push(...resultData.warnings);
      if (msgTexts.length > 0) {
        setMessage(msgTexts.join('\n'));
        setTimeout(() => setMessage(null), 8000);
      }
    }
  };

  const handleReactivate = async (emailItem) => {
    if (!window.confirm(`Bạn có chắc muốn kích hoạt lại email "${emailItem.email}"?`)) return;
    const result = await apiFetchJson(`/api/emails/${emailItem.id}/reactivate`, { method: 'PUT' });
    if (!result.ok) { alert(`Lỗi: ${result.error}`); return; }
    handleMutationSuccess(result.data);
  };

  const canEdit = authUser?.role !== 'STAFF';

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : isoString;
  };

  return (
    <div className="p-6 space-y-6">
      {message && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-orange-500" />
          <div className="whitespace-pre-line">{message}</div>
          <button onClick={() => setMessage(null)} className="ml-auto text-orange-400 hover:text-orange-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Card */}
      <div className="card-soft overflow-hidden bg-white">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h6 className="text-base font-bold text-[var(--color-title)]">Quản Lý Email</h6>
              <p className="text-sm text-[var(--color-subtext)] mt-1">Danh sách email công vụ của Đơn vị và Cá nhân</p>
            </div>
            <div className="flex items-center gap-3">
              {canEdit && (
                <>
                  <button onClick={() => setShowImportModal(true)} className="btn btn-outline-primary">
                    Import Excel
                  </button>
                  <button onClick={() => setShowExportModal(true)} className="btn btn-outline-primary border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-800">
                    Export Excel
                  </button>
                  <button onClick={() => { setEditingEmail(null); setIsFormOpen(true); }} className="btn btn-dark flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    Thêm Email
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[var(--color-accent)] text-sm" />
              </div>
            </div>
            <select value={selectedKind} onChange={(e) => { setSelectedKind(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent)]">
              <option value="">-- Loại --</option>
              <option value="PERSONAL">Cá nhân</option>
              <option value="UNIT">Đơn vị</option>
            </select>
            <select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[var(--color-accent)]">
              <option value="">-- Trạng thái --</option>
              <option value="ACTIVE">Đang sử dụng</option>
              <option value="REVOKED">Đã thu hồi</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Người Dùng / Đơn Vị</th>
                <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng Thái</th>
                {canEdit && <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Thao Tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((em) => {
                const isRevoked = !!em.revoked_date;
                return (
                  <tr key={em.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--color-page)] flex items-center justify-center text-[var(--color-kpi-dark)]">
                          {em.kind === 'UNIT' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--color-title)]">{em.email}</p>
                          <p className="text-xs text-[var(--color-subtext)]">{em.kind === 'UNIT' ? 'Đơn vị' : 'Cá nhân'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[var(--color-title)]">{em.full_name}</p>
                      <p className="text-xs text-[var(--color-subtext)]">{em.job_title || (em.kind === 'PERSONAL' ? `HRM: ${em.hrm_code || '—'}` : '—')}</p>
                    </td>
                    <td className="px-6 py-4">
                      {isRevoked ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className="text-xs font-medium text-red-500">Đã thu hồi ({formatDate(em.revoked_date)})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span>
                          <span className="text-xs font-medium text-[var(--color-success)]">Đang sử dụng</span>
                        </div>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setEditingEmail(em); setIsFormOpen(true); }} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[var(--color-title)] hover:bg-gray-50 transition-colors" title="Sửa">
                            <Edit className="w-4 h-4" />
                          </button>
                          {isRevoked ? (
                            <button onClick={() => handleReactivate(em)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[var(--color-success)] hover:bg-gray-50 transition-colors" title="Kích hoạt lại">
                              <Power className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => setRevokingEmail(em)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-gray-50 transition-colors" title="Thu hồi">
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
          {items.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400 text-sm">Không có email nào.</div>
          )}
        </div>

        {pagination.total > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Tổng <span className="font-bold text-[var(--color-kpi-dark)]">{pagination.total}</span> mục</span>
            <div className="flex items-center gap-2">
              <button disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} className="px-3 py-1 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50">Trước</button>
              <span className="text-xs text-gray-500">{pagination.page} / {pagination.totalPages}</span>
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} className="px-3 py-1 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50">Sau</button>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && <AddEditEmailModal editing={editingEmail} communes={communes} onClose={() => { setIsFormOpen(false); setEditingEmail(null); }} onSuccess={handleMutationSuccess} />}
      {revokingEmail && <RevokeEmailModal emailItem={revokingEmail} onClose={() => setRevokingEmail(null)} onSuccess={handleMutationSuccess} />}
      {showImportModal && <ImportEmailModal onClose={() => setShowImportModal(false)} onSuccess={() => setRefreshKey(prev => prev + 1)} />}
      {showExportModal && <ExportEmailModal onClose={() => setShowExportModal(false)} filterParams={{ search: debouncedSearch, kind: selectedKind, status: selectedStatus, communeId: selectedCommuneId, postOfficeId: selectedPostOfficeId }} hasFilters={false} />}
    </div>
  );
}
