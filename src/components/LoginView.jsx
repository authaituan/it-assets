import React, { useState } from 'react';
import { Cpu, LogIn, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

// Màn hình đăng nhập — hiện thay cho Sidebar/Header/main content khi chưa
// có token hợp lệ. Gọi POST /api/auth/login (route công khai, không cần
// token) — không dùng qua src/utils/api.js vì helper đó dành cho route ghi
// đã đăng nhập.
export default function LoginView({ onLoginSuccess }) {
  const [hrmCode, setHrmCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hrmCode.trim() || !password) {
      setError('Vui lòng nhập đầy đủ Mã HRM và Mật khẩu');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hrm_code: hrmCode.trim(), password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại, vui lòng thử lại');
        setLoading(false);
        return;
      }

      onLoginSuccess(data.token);
    } catch (err) {
      setError('Không thể kết nối tới máy chủ, vui lòng thử lại');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="p-8 space-y-6">
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">CCDC POST</h1>
              <p className="text-xs text-cyan-400 font-medium">Bưu Điện Tỉnh Thừa Thiên Huế</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                Mã HRM
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={hrmCode}
                  onChange={(e) => setHrmCode(e.target.value)}
                  placeholder="Ví dụ: HRM-53001"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs glass-input"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs glass-input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Đang Đăng Nhập...' : 'ĐĂNG NHẬP'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
