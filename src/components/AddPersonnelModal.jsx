import React, { useState, useEffect } from 'react';
import { X, UserPlus, Edit, AlertCircle } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

export default function AddPersonnelModal({ onClose, onSuccess, editingPersonnel }) {
  const [hrmCode, setHrmCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [postOfficeCode, setPostOfficeCode] = useState('');
  const [communeCode, setCommuneCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingPersonnel) {
      setHrmCode(editingPersonnel.hrm_code || '');
      setFullName(editingPersonnel.full_name || '');
      setPostOfficeCode(editingPersonnel.post_office_code || '');
      setCommuneCode(editingPersonnel.commune_code || '');
    }
  }, [editingPersonnel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hrmCode.trim() || !fullName.trim()) {
      setError('Vui lòng nhập đầy đủ Mã HRM và Tên Nhân Viên');
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = editingPersonnel ? `/api/personnel/${editingPersonnel.id}` : '/api/personnel';
    const method = editingPersonnel ? 'PUT' : 'POST';

    const result = await apiFetchJson(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hrm_code: hrmCode.trim(),
        full_name: fullName.trim(),
        post_office_code: postOfficeCode.trim() || null,
        commune_code: communeCode.trim() || null
      })
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center p-4">
      <div className="card-soft w-full max-w-md rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white">
          <h3 className="font-bold text-base text-[--color-title] flex items-center gap-2">
            {editingPersonnel ? <Edit className="w-5 h-5 text-orange-400" /> : <UserPlus className="w-5 h-5 text-orange-400" />}
            <span>{editingPersonnel ? 'Chỉnh Sửa Người Sử Dụng' : 'Thêm Người Sử Dụng'}</span>
          </h3>
          <button onClick={onClose} className="text-[--color-body] hover:text-[--color-title]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Mã HRM
            </label>
            <input
              type="text"
              value={hrmCode}
              onChange={(e) => setHrmCode(e.target.value)}
              placeholder="Ví dụ: HRM-53010"
              className="w-full input-soft p-3 rounded-xl text-xs"
              autoFocus
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Tên Nhân Viên
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full input-soft p-3 rounded-xl text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Mã BC (Bưu Cục)
            </label>
            <input
              type="text"
              value={postOfficeCode}
              onChange={(e) => setPostOfficeCode(e.target.value)}
              placeholder="Ví dụ: 536750 (không bắt buộc)"
              className="w-full input-soft p-3 rounded-xl text-xs"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Mã BĐX
            </label>
            <input
              type="text"
              value={communeCode}
              onChange={(e) => setCommuneCode(e.target.value)}
              placeholder="Ví dụ: 5300 (không bắt buộc)"
              className="w-full input-soft p-3 rounded-xl text-xs"
              autoComplete="off"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {editingPersonnel ? <Edit className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{loading ? 'Đang Xử Lý...' : (editingPersonnel ? 'LƯU THAY ĐỔI' : 'THÊM NGƯỜI SỬ DỤNG')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
