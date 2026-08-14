import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Monitor, Printer, QrCode, Wifi, Zap, Camera, Scale, Check, AlertCircle } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

export default function AddEquipmentModal({ onClose, onSuccess }) {
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [postOffices, setPostOffices] = useState([]);

  // Form state
  const [selectedDeviceTypeId, setSelectedDeviceTypeId] = useState('');
  const [selectedCommuneId, setSelectedCommuneId] = useState('');
  const [selectedPostOfficeId, setSelectedPostOfficeId] = useState('');
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [brandName, setBrandName] = useState('');
  const [model, setModel] = useState('');
  const [purchaseYear, setPurchaseYear] = useState(new Date().getFullYear());
  const [rawUserName, setRawUserName] = useState('');
  // Gán Người Sử Dụng qua autocomplete (feat/personnel-autocomplete): xem
  // giải thích chi tiết cùng logic trong EquipmentDetailModal.jsx.
  const [assignedUserId, setAssignedUserId] = useState(null);
  const [personnelSuggestions, setPersonnelSuggestions] = useState([]);
  const [showPersonnelSuggestions, setShowPersonnelSuggestions] = useState(false);
  const personnelDebounceRef = useRef(null);
  const [notes, setNotes] = useState('');
  const [categoryRaw, setCategoryRaw] = useState('');
  const [categoryRawOptions, setCategoryRawOptions] = useState([]);

  // Specs state
  const [cpu, setCpu] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [os, setOs] = useState('');
  
  // Specs for printer/other
  const [printType, setPrintType] = useState('');
  const [connection, setConnection] = useState('');


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/device-types')
      .then(res => res.json())
      .then(data => {
        setDeviceTypes(data);
        if (data.length > 0) setSelectedDeviceTypeId(data[0].id);
      });

    fetch('/api/organization/communes')
      .then(res => res.json())
      .then(data => setCommunes(data));

    fetch('/api/equipments/category-raw-options')
      .then(res => res.json())
      .then(data => setCategoryRawOptions(data || []));
  }, []);

  useEffect(() => {
    if (selectedCommuneId) {
      fetch(`/api/organization/post-offices?communeId=${selectedCommuneId}`)
        .then(res => res.json())
        .then(data => {
          setPostOffices(data);
          if (data.length > 0) setSelectedPostOfficeId(data[0].id);
        });
    }
  }, [selectedCommuneId]);

  // Autocomplete "Người Sử Dụng": debounce ~300ms rồi gọi GET /api/personnel/search
  // (route yêu cầu token + role quản lý -> apiFetchJson, không phải fetch thường).
  const handlePersonnelSearchChange = (val) => {
    setRawUserName(val);
    setAssignedUserId(null); // gõ tự do -> huỷ liên kết với gợi ý đã chọn trước đó
    setShowPersonnelSuggestions(true);

    if (personnelDebounceRef.current) clearTimeout(personnelDebounceRef.current);

    if (!val || !val.trim()) {
      setPersonnelSuggestions([]);
      return;
    }

    personnelDebounceRef.current = setTimeout(async () => {
      const result = await apiFetchJson(`/api/personnel/search?q=${encodeURIComponent(val.trim())}`);
      if (result.ok) {
        setPersonnelSuggestions(Array.isArray(result.data) ? result.data : []);
      }
    }, 300);
  };

  const handleSelectPersonnel = (p) => {
    setAssignedUserId(p.id);
    setRawUserName(p.full_name);
    setPersonnelSuggestions([]);
    setShowPersonnelSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDeviceTypeId || !selectedPostOfficeId) {
      alert("Vui lòng chọn Loại thiết bị và Bưu cục!");
      return;
    }

    setLoading(true);
    setError('');

    const activeType = deviceTypes.find(dt => dt.id === selectedDeviceTypeId);
    let specs = {};

    if (activeType && activeType.code === 'COMPUTER') {
      specs = { cpu, ram, storage, os };
    } else if (activeType && activeType.code === 'PRINTER') {
      specs = { printType, connection };
    }

    const result = await apiFetchJson('/api/equipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_type_id: selectedDeviceTypeId,
        post_office_id: selectedPostOfficeId,
        hostname,
        ip_address: ipAddress,
        mac_address: macAddress,
        serial_number: serialNumber,
        brand_name: brandName,
        model,
        purchase_year: purchaseYear,
        raw_user_name: rawUserName,
        assigned_user_id: assignedUserId || null,
        notes,
        category_raw: categoryRaw,
        specs
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

  const selectedTypeCode = deviceTypes.find(dt => dt.id === selectedDeviceTypeId)?.code;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" />
            <span>Thêm Mới Thiết Bị CCDC (Đa Thiết Bị IT)</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Device Type Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
              1. Loại Thiết Bị CNTT
            </label>
            <div className="grid grid-cols-3 gap-2">
              {deviceTypes.map(dt => (
                <button
                  type="button"
                  key={dt.id}
                  onClick={() => setSelectedDeviceTypeId(dt.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    selectedDeviceTypeId === dt.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">{dt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                2. Chọn Bưu Điện Xã (BĐX)
              </label>
              <select
                value={selectedCommuneId}
                onChange={e => setSelectedCommuneId(e.target.value)}
                className="w-full glass-input p-2.5 rounded-xl"
                required
              >
                <option value="">-- Chọn BĐX --</option>
                {communes.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                3. Chọn Bưu Cục (MBC)
              </label>
              <select
                value={selectedPostOfficeId}
                onChange={e => setSelectedPostOfficeId(e.target.value)}
                className="w-full glass-input p-2.5 rounded-xl"
                required
              >
                <option value="">-- Chọn Bưu cục --</option>
                {postOffices.map(po => (
                  <option key={po.id} value={po.id}>{po.code} - {po.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Asset Identifiers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tên Máy / Hostname</label>
              <input
                type="text"
                value={hostname}
                onChange={e => setHostname(e.target.value)}
                placeholder="HUE-TP-GD01"
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Địa Chỉ IP Tĩnh</label>
              <input
                type="text"
                value={ipAddress}
                onChange={e => setIpAddress(e.target.value)}
                placeholder="10.47.12.145"
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Địa Chỉ MAC</label>
              <input
                type="text"
                value={macAddress}
                onChange={e => setMacAddress(e.target.value)}
                placeholder="38-22-E2-18-8F-7F"
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Số Serial / TAG</label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="8CC0113256"
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Hãng Sản Xuất</label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="Dell, HP, Posbank, Zebra..."
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Dòng Máy / Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="OptiPlex 3040 / ProDesk 600 G5"
                className="w-full glass-input p-2.5 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Năm Mua</label>
              <input
                type="number"
                value={purchaseYear}
                onChange={e => setPurchaseYear(e.target.value)}
                min="1990"
                max="2100"
                placeholder={String(new Date().getFullYear())}
                className="w-full glass-input p-2.5 rounded-xl"
              />
              <p className="text-[10px] text-slate-500 mt-1">Dùng để sinh mã CCDC (2 số cuối năm), vd 24 trong PC-24-001.</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Phân Loại Chi Tiết</label>
              <input
                type="text"
                list="add-category-raw-options"
                value={categoryRaw}
                onChange={e => setCategoryRaw(e.target.value)}
                placeholder="Ví dụ: Máy tính để bàn Dell"
                className="w-full glass-input p-2.5 rounded-xl"
              />
              <datalist id="add-category-raw-options">
                {categoryRawOptions.map(opt => (
                  <option key={opt.label} value={opt.label} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Dynamic Hardware Specs Form */}
          {selectedTypeCode === 'COMPUTER' && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-cyan-400 uppercase">Thông Số Cấu Hình Máy Tính</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400">CPU</label>
                  <input type="text" value={cpu} onChange={e => setCpu(e.target.value)} className="w-full glass-input p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">RAM</label>
                  <input type="text" value={ram} onChange={e => setRam(e.target.value)} className="w-full glass-input p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Ổ Cứng</label>
                  <input type="text" value={storage} onChange={e => setStorage(e.target.value)} className="w-full glass-input p-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Hệ Điều Hành</label>
                  <input type="text" value={os} onChange={e => setOs(e.target.value)} className="w-full glass-input p-2 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Người Sử Dụng (Tên Bàn Giao)</label>
            <input
              type="text"
              value={rawUserName}
              onChange={e => handlePersonnelSearchChange(e.target.value)}
              onFocus={() => { if (personnelSuggestions.length > 0) setShowPersonnelSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowPersonnelSuggestions(false), 150)}
              placeholder="Gõ Mã HRM hoặc Họ Tên để tìm... (không bắt buộc)"
              autoComplete="off"
              className="w-full glass-input p-2.5 rounded-xl"
            />
            {assignedUserId && (
              <p className="text-[10px] text-emerald-400 mt-1">Đã gán liên kết với nhân sự (assigned_user_id).</p>
            )}
            {showPersonnelSuggestions && personnelSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                {personnelSuggestions.map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPersonnel(p)}
                    className="px-3 py-2 text-[11px] text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-300 cursor-pointer"
                  >
                    {p.hrm_code || '—'}-{p.full_name}-{p.post_office_code || '—'}-{p.commune_code || '—'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all"
            >
              {loading ? 'Đang Lưu...' : 'LƯU THIẾT BỊ CCDC MỚI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
