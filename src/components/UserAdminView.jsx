import React, { useEffect, useState } from 'react';
import { UserCog, Plus, KeyRound, Pencil, Check, X, AlertCircle, ShieldAlert, UserX, UserCheck2, Lock } from 'lucide-react';
import { apiFetchJson } from '../utils/api';
import AddUserModal from './AddUserModal';
import ResetUserPasswordModal from './ResetUserPasswordModal';

const ROLE_OPTIONS = ['STAFF', 'ADMIN', 'MANAGER'];

export default function UserAdminView({ authUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);

  // Sửa Thông Tin inline (họ tên + role cùng lúc, khớp với body mà
  // PUT /api/users/:id đã hỗ trợ sẵn) — thay cho ô "Sửa Role" cũ.
  const [editingId, setEditingId] = useState(null);
  const [editingFullName, setEditingFullName] = useState('');
  const [editingRole, setEditingRole] = useState('STAFF');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveError, setEditSaveError] = useState('');

  // Vô hiệu hoá / Kích hoạt lại
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    setError('');
    // GET /api/users cũng yêu cầu token + role quản lý (khác các route đọc khác) -> phải qua apiFetchJson.
    apiFetchJson('/api/users').then((result) => {
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsers(Array.isArray(result.data) ? result.data : []);
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditingFullName(user.full_name || '');
    setEditingRole(user.role || 'STAFF');
    setEditSaveError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSaveError('');
  };

  const saveEdit = async (userId) => {
    if (!editingFullName.trim()) {
      setEditSaveError('Họ và Tên không được để trống');
      return;
    }
    setEditSaving(true);
    setEditSaveError('');

    const result = await apiFetchJson(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editingFullName.trim(), role: editingRole })
    });

    setEditSaving(false);
    if (!result.ok) {
      setEditSaveError(result.error);
      return;
    }
    setEditingId(null);
    fetchUsers();
  };

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Xác nhận vô hiệu hoá tài khoản "${user.full_name}" (${user.hrm_code})? Tài khoản này sẽ không đăng nhập được nữa cho tới khi được kích hoạt lại.`)) {
      return;
    }
    setActionLoadingId(user.id);
    setActionError('');

    const result = await apiFetchJson(`/api/users/${user.id}/deactivate`, { method: 'PUT' });

    setActionLoadingId(null);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    fetchUsers();
  };

  const handleReactivate = async (user) => {
    setActionLoadingId(user.id);
    setActionError('');

    const result = await apiFetchJson(`/api/users/${user.id}/reactivate`, { method: 'PUT' });

    setActionLoadingId(null);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    fetchUsers();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCog className="w-5 h-5 text-cyan-400" />
            <span>Quản Lý Người Dùng</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tạo tài khoản, sửa thông tin/phân quyền, reset mật khẩu, vô hiệu hoá/kích hoạt lại tài khoản.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm User</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Đang nạp danh sách người dùng...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <UserCog className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-sm text-slate-300">Chưa có tài khoản người dùng nào</p>
            <p className="text-xs text-slate-500 mt-1">Bấm "Thêm User" để tạo tài khoản đầu tiên</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Mã HRM</th>
                  <th className="py-3.5 px-4">Họ Và Tên</th>
                  <th className="py-3.5 px-4">Vai Trò (Role)</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4">Ngày Tạo</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isSelf = authUser && u.id === authUser.id;
                  const isEditing = editingId === u.id;
                  const isDeactivated = !!u.deactivated_at;
                  const isActionLoading = actionLoadingId === u.id;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-800/40 transition-colors ${isDeactivated ? 'opacity-60' : ''}`}>
                      <td className="py-3.5 px-4 font-mono text-cyan-400 font-medium">{u.hrm_code}</td>

                      {/* Họ Và Tên — sửa inline cùng với Role */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingFullName}
                            onChange={(e) => setEditingFullName(e.target.value)}
                            className="glass-input px-2 py-1.5 rounded-lg text-xs w-full min-w-[140px]"
                            autoFocus
                          />
                        ) : (
                          <>
                            <div className="font-semibold text-slate-200">{u.full_name}</div>
                            {isSelf && (
                              <div className="text-[10px] text-purple-300 font-medium mt-0.5">(Tài khoản của bạn)</div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Vai Trò (Role) */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <>
                            <select
                              value={editingRole}
                              onChange={(e) => setEditingRole(e.target.value)}
                              disabled={isSelf}
                              title={isSelf ? 'Không thể tự đổi quyền của chính mình' : ''}
                              className="glass-input px-2 py-1.5 rounded-lg text-xs disabled:opacity-50"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            {isSelf && (
                              <div className="text-[10px] text-slate-500 mt-1">Không thể tự đổi quyền của chính mình</div>
                            )}
                          </>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            u.role === 'STAFF'
                              ? 'bg-slate-800 text-slate-300 border-slate-700'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          }`}>
                            {u.role}
                          </span>
                        )}
                        {isEditing && editSaveError && (
                          <div className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>{editSaveError}</span>
                          </div>
                        )}
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-3.5 px-4">
                        {isDeactivated ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-fit">
                            <Lock className="w-3 h-3" />
                            <span>Đã khoá</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 w-fit inline-block">
                            Đang hoạt động
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-400">{u.created_at}</td>

                      {/* Thao Tác */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEdit(u.id)}
                              disabled={editSaving}
                              title="Lưu"
                              className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center justify-center disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              title="Hủy"
                              className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 flex items-center justify-center"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(u)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 transition-all text-xs font-semibold flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetPasswordTarget(u)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 transition-all text-xs font-semibold flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Mật Khẩu</span>
                            </button>
                            {isDeactivated ? (
                              <button
                                type="button"
                                onClick={() => handleReactivate(u)}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                              >
                                <UserCheck2 className="w-3.5 h-3.5" />
                                <span>{isActionLoading ? 'Đang Xử Lý...' : 'Kích Hoạt Lại'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(u)}
                                disabled={isSelf || isActionLoading}
                                title={isSelf ? 'Không thể tự vô hiệu hoá chính tài khoản đang đăng nhập' : ''}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-500/10"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{isActionLoading ? 'Đang Xử Lý...' : 'Vô Hiệu Hoá'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
          Tổng cộng <span className="font-bold text-white">{users.length}</span> tài khoản người dùng.
        </div>
      </div>

      {isAddModalOpen && (
        <AddUserModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchUsers}
        />
      )}

      {resetPasswordTarget && (
        <ResetUserPasswordModal
          user={resetPasswordTarget}
          onClose={() => setResetPasswordTarget(null)}
          onSuccess={() => setResetPasswordTarget(null)}
        />
      )}
    </div>
  );
}
