import React, { useEffect, useState } from 'react';
import {
  X,
  Monitor,
  MapPin,
  User,
  Cpu,
  History,
  Edit3,
  Save,
  Eye,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Building2,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { apiFetchJson } from '../utils/api';

export default function EquipmentDetailModal({ equipment, onClose, onUpdated, onDeleted }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form edit states
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [rawUserName, setRawUserName] = useState('');
  const [status, setStatus] = useState('IN_USE');
  const [notes, setNotes] = useState('');
  const [cpu, setCpu] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [os, setOs] = useState('');

  const eqId = equipment?.id;

  useEffect(() => {
    if (!eqId) return;
    let isMounted = true;
    setLoading(true);

    fetch(`/api/equipments/${eqId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        setDetail(data);
        
        // Populate edit form states
        setHostname(data.hostname || '');
        setIpAddress(data.ip_address || '');
        setMacAddress(data.mac_address || '');
        setSerialNumber(data.serial_number || '');
        setRawUserName(data.assigned_user_name || data.raw_user_name || '');
        setStatus(data.status || 'IN_USE');
        setNotes(data.notes || '');

        const specs = data.specs || {};
        setCpu(specs.cpu || '');
        setRam(specs.ram || '');
        setStorage(specs.storage || '');
        setOs(specs.os || '');

        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [eqId]);

  if (!equipment) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setActionError('');

    const updatedSpecs = {
      ...(detail?.specs || {}),
      cpu,
      ram,
      storage,
      os
    };

    const result = await apiFetchJson(`/api/equipments/${eqId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostname,
        ip_address: ipAddress,
        mac_address: macAddress,
        serial_number: serialNumber,
        raw_user_name: rawUserName,
        status,
        notes,
        specs: updatedSpecs
      })
    });

    setSaveLoading(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    setSaveSuccess(true);
    setIsEditing(false);

    // Update local detail view
    setDetail(prev => ({
      ...prev,
      hostname,
      ip_address: ipAddress,
      mac_address: macAddress,
      serial_number: serialNumber,
      raw_user_name: rawUserName,
      status,
      notes,
      specs: updatedSpecs
    }));

    if (onUpdated) onUpdated();
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Xác nhận xoá thiết bị "${detail?.hostname || equipment.hostname || equipment.asset_tag}"? Thao tác này có thể khôi phục lại từ lịch sử nếu cần.`)) {
      return;
    }

    setDeleteLoading(true);
    setActionError('');

    const result = await apiFetchJson(`/api/equipments/${eqId}`, { method: 'DELETE' });

    setDeleteLoading(false);

    if (!result.ok) {
      setActionError(result.error);
      return;
    }

    if (onDeleted) onDeleted();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{detail?.hostname || equipment.hostname || equipment.asset_tag}</h3>
              <p className="text-xs text-slate-400">{equipment.brand_name || 'Hãng khác'} {equipment.model || ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã lưu!</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isEditing
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5 text-cyan-400" />}
              <span>{isEditing ? 'Xem Chi Tiết' : 'Chỉnh Sửa'}</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deleteLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{deleteLoading ? 'Đang Xoá...' : 'Xoá Thiết Bị'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action error banner (401/403/lỗi khác từ save hoặc xoá) */}
        {actionError && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Modal Body */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-xs">Đang nạp thông tin chi tiết CCDC...</span>
          </div>
        ) : isEditing ? (
          /* EDIT FORM MODE */
          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Tên Máy / Hostname</label>
                <input
                  type="text"
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Trạng Thái Cấp Phát</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                >
                  <option value="IN_USE">Đang sử dụng</option>
                  <option value="IN_STOCK">Tồn kho / Dự phòng</option>
                  <option value="MAINTENANCE">Bảo trì / Sửa chữa</option>
                  <option value="BROKEN">Hỏng / Chờ thanh lý</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Địa Chỉ IP Tĩnh</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Địa Chỉ MAC</label>
                <input
                  type="text"
                  value={macAddress}
                  onChange={e => setMacAddress(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Số Serial / Service TAG</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Người Sử Dụng Bàn Giao</label>
                <input
                  type="text"
                  value={rawUserName}
                  onChange={e => setRawUserName(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Hardware Specs Edit */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-cyan-400 uppercase">Cấu Hình Phần Cứng (Specs)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">CPU</label>
                  <input type="text" value={cpu} onChange={e => setCpu(e.target.value)} className="w-full glass-input p-2 rounded-lg text-xs" />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">RAM</label>
                  <input type="text" value={ram} onChange={e => setRam(e.target.value)} className="w-full glass-input p-2 rounded-lg text-xs" />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Ổ Cứng Storage</label>
                  <input type="text" value={storage} onChange={e => setStorage(e.target.value)} className="w-full glass-input p-2 rounded-lg text-xs" />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Hệ Điều Hành</label>
                  <input type="text" value={os} onChange={e => setOs(e.target.value)} className="w-full glass-input p-2 rounded-lg text-xs" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ghi Chú</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full glass-input p-2.5 rounded-xl text-xs resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={saveLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                {saveLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saveLoading ? 'Đang Lưu...' : 'LƯU THAY ĐỔI'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* READONLY DETAIL MODE */
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Asset Identity Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Địa chỉ IP</div>
                <div className="font-mono font-bold text-cyan-400 text-xs mt-1">{detail.ip_address || 'N/A'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Địa chỉ MAC</div>
                <div className="font-mono text-slate-200 text-[11px] mt-1">{detail.mac_address || 'N/A'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Số Serial / TAG</div>
                <div className="font-mono text-slate-200 text-[11px] mt-1 truncate">{detail.serial_number || 'N/A'}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Trạng thái</div>
                <div className="font-semibold text-emerald-400 text-xs mt-1">{detail.status || 'Đang hoạt động'}</div>
              </div>
            </div>

            {/* Location & User Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl glass-card space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  <span>Đơn Vị & Bưu Cục Quản Lý</span>
                </div>
                <div className="text-sm font-bold text-white">{detail.post_office_name} ({detail.post_office_code})</div>
                <div className="text-xs text-slate-400">Trực thuộc: <span className="text-slate-200 font-semibold">{detail.commune_name} ({detail.commune_code})</span></div>
                <div className="text-xs text-slate-400">Địa chỉ: {detail.post_office_address || 'Theo quản lý địa bàn xã'}</div>
              </div>

              <div className="p-4 rounded-xl glass-card space-y-2">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <User className="w-4 h-4" />
                  <span>Người Sử Dụng Được Bàn Giao</span>
                </div>
                <div className="text-sm font-bold text-white">{detail.assigned_user_name || detail.raw_user_name || 'Chưa bàn giao cụ thể'}</div>
                {detail.assigned_user_hrm && (
                  <div className="text-xs text-purple-300 font-mono">Mã HRM: {detail.assigned_user_hrm}</div>
                )}
                <div className="text-xs text-slate-400">Ghi nhận từ dữ liệu bưu điện</div>
              </div>
            </div>

            {/* Hardware Specs Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Thông Số Kỹ Thuật Chi Tiết (Hardware Specs)</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400">CPU</div>
                  <div className="text-xs font-semibold text-white mt-0.5">{detail?.specs?.cpu || 'N/A'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Dung Lượng RAM</div>
                  <div className="text-xs font-semibold text-cyan-400 mt-0.5">{detail?.specs?.ram || 'N/A'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Ổ Cứng Storage</div>
                  <div className="text-xs font-semibold text-blue-400 mt-0.5">{detail?.specs?.storage || 'N/A'}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Hệ Điều Hành</div>
                  <div className="text-xs font-semibold text-white mt-0.5">{detail?.specs?.os || 'N/A'}</div>
                </div>

              </div>
            </div>

            {/* Audit Logs */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <span>Lịch Sử Luân Chuyển & Cập Nhật (Audit Logs)</span>
              </h4>

              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                {detail.logs && detail.logs.map((log, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                      <div>
                        <div className="font-semibold text-slate-200">{log.reason || log.action}</div>
                        <div className="text-[11px] text-slate-400">{log.transferred_at}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                      {log.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
