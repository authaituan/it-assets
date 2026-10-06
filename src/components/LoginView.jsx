import React, { useState } from 'react';
import { LogIn, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

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
    <div className="flex-1 min-h-screen flex flex-col md:flex-row font-sans">
      {/* Left side: branding/presentation */}
      <div className="md:flex-1 bg-primary p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-[44px] h-[44px] bg-accent flex items-center justify-center font-bold text-ink text-2xl mb-8">
            H
          </div>
          <h1 className="font-[800] text-white text-[32px] md:text-[44px] leading-tight max-w-md">
            Hệ thống quản lý công cụ dụng cụ
          </h1>
          <p className="text-white/80 mt-4 max-w-md hidden md:block">
            Quản lý tài sản công nghệ thông tin, thiết bị mạng lưới, email, và nhân sự hiệu quả và tập trung.
          </p>
        </div>

        {/* Decorative squares */}
        <div className="hidden md:block absolute top-1/2 right-12 -translate-y-1/2">
          <div className="grid grid-cols-2 gap-4">
            <div className="w-[72px] h-[72px] bg-accent"></div>
            <div className="w-[72px] h-[72px] bg-success"></div>
            <div className="w-[72px] h-[72px] bg-danger"></div>
            <div className="w-[72px] h-[72px] bg-info"></div>
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-sm mt-12 md:mt-0 font-medium">
          Trung tâm Vận hành · Bưu điện Thành phố Huế
        </div>
      </div>

      {/* Right side: Login form */}
      <div className="md:flex-1 bg-surface flex flex-col justify-center items-center p-8 md:p-12">
        <div className="w-full max-w-[380px]">
          <h2 className="font-[800] text-ink text-[24px] mb-8">Đăng nhập</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-danger text-white text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-[800] tracking-[0.05em] text-muted uppercase mb-2">
                Mã HRM
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={hrmCode}
                  onChange={(e) => setHrmCode(e.target.value)}
                  placeholder="Ví dụ: HRM-53001"
                  className="w-full pl-12 pr-4 h-[48px] bg-surface-alt text-ink border-0 focus:outline-2 focus:outline-primary placeholder:text-muted/60 transition-all"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-[800] tracking-[0.05em] text-muted uppercase mb-2">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 h-[48px] bg-surface-alt text-ink border-0 focus:outline-2 focus:outline-primary placeholder:text-muted/60 transition-all"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[50px] mt-4 bg-accent text-ink font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <LogIn className="w-5 h-5 animate-pulse" /> : <LogIn className="w-5 h-5" />}
              <span>{loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
