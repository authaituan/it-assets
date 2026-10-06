import React, { useState } from 'react';
import { X, Layers, Plus, Monitor, Printer, QrCode, Wifi, Zap, Camera, Scale, FolderPlus } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

export default function AddCategoryModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('monitor');
  const [description, setDescription] = useState('');
  const [assetPrefix, setAssetPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const icons = [
    { id: 'monitor', label: 'Máy tính', icon: Monitor },
    { id: 'printer', label: 'Máy in', icon: Printer },
    { id: 'qr-code', label: 'Máy quét', icon: QrCode },
    { id: 'wifi', label: 'Mạng', icon: Wifi },
    { id: 'zap', label: 'Nguồn UPS', icon: Zap },
    { id: 'camera', label: 'Camera', icon: Camera },
    { id: 'scale', label: 'Cân', icon: Scale },
    { id: 'layers', label: 'Khác', icon: Layers },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên danh mục lớn');
      return;
    }

    setLoading(true);
    setError('');

    const result = await apiFetchJson('/api/device-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), icon, description, asset_prefix: assetPrefix.trim() })
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
            <FolderPlus className="w-5 h-5 text-orange-400" />
            <span>Thêm Danh Mục CCDC Lớn</span>
          </h3>
          <button onClick={onClose} className="text-[--color-body] hover:text-[--color-title]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-rose-500/30 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Tên Danh Mục CCDC Mới
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ví dụ: Máy chiếu, Máy Scan 3D, Máy tra cứu Kiosk..."
              className="w-full input-soft p-3 rounded-xl text-xs"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Tiền Tố Mã CCDC
            </label>
            <input
              type="text"
              value={assetPrefix}
              onChange={e => setAssetPrefix(e.target.value.toUpperCase())}
              placeholder="Ví dụ: LAP, PC, MNT, PRN..."
              maxLength={5}
              className="w-full input-soft p-3 rounded-xl text-xs font-mono tracking-wider"
            />
            <p className="text-[10px] text-[--color-subtext] mt-1">
              Dùng để sinh mã CCDC tự động, ví dụ <span className="text-orange-400 font-mono">LAP-24-001</span>. 2-5 ký tự IN HOA/số.
              Nếu để trống, phải bổ sung ở Quản Lý Danh Mục trước khi tạo thiết bị thuộc loại này.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Biểu Tượng Độc Quyền (Icon)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {icons.map(ic => {
                const IconComp = ic.icon;
                const isSelected = icon === ic.id;
                return (
                  <button
                    type="button"
                    key={ic.id}
                    onClick={() => setIcon(ic.id)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${ isSelected ?'bg-orange-50 border-orange-500 text-orange-600 font-bold'
                        : 'bg-gray-50 border-gray-200 text-[--color-body] hover:text-[--color-title]'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span className="text-[10px]">{ic.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[--color-title] uppercase mb-1">
              Mô Tả / Ghi Chú
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả mục đích sử dụng danh mục CCDC này..."
              className="w-full input-soft p-3 rounded-xl text-xs resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-orange-500 hover: text-white font-bold text-xs shadow-soft transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{loading ? 'Đang Lưu...' : 'LƯU DANH MỤC CCDC MỚI'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
