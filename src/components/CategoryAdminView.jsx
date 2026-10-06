import React, { useEffect, useState } from 'react';
import { Layers, Pencil, Check, X, AlertCircle, ShieldAlert, Tag } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// Quản Lý Danh Mục CCDC — liệt kê danh mục thiết bị + sửa tiền tố mã CCDC
// (asset_prefix) inline. Dùng route PUT /api/device-types/:id.
export default function CategoryAdminView() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline edit state (sửa asset_prefix + name)
  const [editingId, setEditingId] = useState(null);
  const [editPrefix, setEditPrefix] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const fetchTypes = () => {
    setLoading(true);
    setError('');
    // GET /api/device-types là route đọc mở (không cần token), nhưng dùng
    // apiFetchJson vẫn ổn (nó chỉ tự gắn token nếu có, không bắt buộc).
    apiFetchJson('/api/device-types').then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTypes(Array.isArray(result.data) ? result.data : []);
    });
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const startEdit = (dt) => {
    setEditingId(dt.id);
    setEditPrefix(dt.asset_prefix || '');
    setEditName(dt.name || '');
    setSaveError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError('');
  };

  const saveEdit = async (id) => {
    const prefix = (editPrefix || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,5}$/.test(prefix)) {
      setSaveError('Tiền tố phải gồm 2-5 ký tự IN HOA hoặc số (A-Z, 0-9)');
      return;
    }
    setSaving(true);
    setSaveError('');

    const result = await apiFetchJson(`/api/device-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_prefix: prefix, name: editName.trim() })
    });

    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setEditingId(null);
    fetchTypes();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="card-soft p-5 rounded-2xl">
        <h2 className="text-xl font-bold text-[--color-title] flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-400" />
          <span>Quản Lý Danh Mục CCDC</span>
        </h2>
        <p className="text-xs text-[--color-body] mt-1">
          Cấu hình <span className="text-orange-400 font-semibold">tiền tố mã CCDC</span> cho từng loại thiết bị.
          Mã được sinh tự động dạng <span className="font-mono text-orange-400">TIỀN_TỐ-YY-001</span> (vd LAP-24-001) khi tạo thiết bị mới.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-rose-500/30 text-red-600 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="card-soft rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
            <p className="text-xs text-[--color-body]">Đang nạp danh mục thiết bị...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="p-12 text-center text-[--color-body]">
            <Layers className="w-12 h-12 mx-auto text-[--color-body] mb-3" />
            <p className="font-semibold text-sm text-[--color-title]">Chưa có danh mục thiết bị nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[--color-body] font-semibold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Tên Danh Mục</th>
                  <th className="py-3.5 px-4">Mã (code)</th>
                  <th className="py-3.5 px-4">Tiền Tố Mã CCDC</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {types.map((dt) => {
                  const isEditing = editingId === dt.id;
                  const hasPrefix = !!(dt.asset_prefix && dt.asset_prefix.trim());
                  return (
                    <tr key={dt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="input-soft px-2 py-1.5 rounded-lg text-xs w-full min-w-[160px]"
                          />
                        ) : (
                          <span className="font-semibold text-[--color-title]">{dt.name}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[--color-body]">{dt.code}</td>
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <div>
                            <input
                              type="text"
                              value={editPrefix}
                              onChange={(e) => setEditPrefix(e.target.value.toUpperCase())}
                              maxLength={5}
                              placeholder="VD: LAP"
                              className="input-soft px-2 py-1.5 rounded-lg text-xs font-mono tracking-wider w-28"
                              autoFocus
                            />
                            {saveError && (
                              <div className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 shrink-0" />
                                <span>{saveError}</span>
                              </div>
                            )}
                          </div>
                        ) : hasPrefix ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-orange-500/10 text-orange-600 border-orange-200 font-mono inline-flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {dt.asset_prefix}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-amber-500/10 text-yellow-600 border-amber-500/30">
                            Chưa cấu hình
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveEdit(dt.id)}
                                disabled={saving}
                                title="Lưu"
                                className="w-7 h-7 rounded-lg bg-green-50 text-green-600 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center justify-center disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                title="Hủy"
                                className="w-7 h-7 rounded-lg bg-white text-[--color-title] border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(dt)}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-orange-50 hover:text-orange-600 text-[--color-title] transition-all text-xs font-semibold flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Sửa Tiền Tố</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-[--color-body]">
          Tổng cộng <span className="font-bold text-[--color-title]">{types.length}</span> danh mục thiết bị.
        </div>
      </div>
    </div>
  );
}
