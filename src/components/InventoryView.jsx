import React, { useEffect, useState } from 'react';
import {
 Monitor,
 Printer,
 QrCode,
 Wifi,
 Zap,
 Camera,
 Scale,
 Search,
 Filter,
 MapPin,
 Building2,
 User,
 Eye,
 Edit3,
 ChevronLeft,
 ChevronRight,
 Sparkles,
 RefreshCw,
 Plus,
 Download,
 Upload
} from 'lucide-react';
import ExportEquipmentModal from './ExportEquipmentModal';
import ImportEquipmentModal from './ImportEquipmentModal';
import { apiFetch } from '../utils/api';

export default function InventoryView({
 search,
 setSearch,
 onSelectEquipment,
 onOpenAddModal,
 initialDeviceTypeId,
 initialCommuneId,
 initialPostOfficeId
}) {
 const [items, setItems] = useState([]);
 const [communes, setCommunes] = useState([]);
 const [postOffices, setPostOffices] = useState([]);
 const [deviceTypes, setDeviceTypes] = useState([]);
 const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
 const [loading, setLoading] = useState(true);

 // Filter States
 const [selectedCommuneId, setSelectedCommuneId] = useState(initialCommuneId || '');
 const [selectedPostOfficeId, setSelectedPostOfficeId] = useState(initialPostOfficeId || '');
 const [selectedDeviceTypeId, setSelectedDeviceTypeId] = useState('');
 const [selectedStatus, setSelectedStatus] = useState('');
 const [categoryRawOptions, setCategoryRawOptions] = useState([]);
 const [selectedCategoryRaw, setSelectedCategoryRaw] = useState('');

 // Export/Import Excel modal
 const [showExportModal, setShowExportModal] = useState(false);
 const [showImportModal, setShowImportModal] = useState(false);

 // Tách riêng để có thể gọi lại sau khi Import tạo mới bưu cục/danh mục
 // (danh sách BĐX/Bưu cục/Loại thiết bị cần cập nhật để dropdown lọc thấy ngay).
 const fetchCommunes = () => {
 apiFetch('/api/organization/communes')
 .then(res => res.json())
 .then(data => setCommunes(data))
 .catch(err => console.error(err));
 };

 const fetchDeviceTypes = () => {
 apiFetch('/api/device-types')
 .then(res => res.json())
 .then(data => setDeviceTypes(data))
 .catch(err => console.error(err));
 };

 const fetchPostOffices = () => {
 let url = '/api/organization/post-offices';
 if (selectedCommuneId) {
 url += `?communeId=${selectedCommuneId}`;
 }
 apiFetch(url)
 .then(res => res.json())
 .then(data => setPostOffices(data))
 .catch(err => console.error(err));
 };

 // Load Communes & Device Types on Mount
 useEffect(() => {
 fetchCommunes();
 fetchDeviceTypes();
 }, []);

 // Update selectedDeviceTypeId when initialDeviceTypeId changes
 useEffect(() => {
 if (initialDeviceTypeId !== undefined) {
 setSelectedDeviceTypeId(initialDeviceTypeId || '');
 }
 }, [initialDeviceTypeId]);

 // Fetch category raw options
 useEffect(() => {
 let url = '/api/equipments/category-raw-options';
 if (selectedDeviceTypeId) {
 url += `?deviceTypeId=${selectedDeviceTypeId}`;
 }
 apiFetch(url)
 .then(res => res.json())
 .then(data => {
 const options = data || [];
 setCategoryRawOptions(options);
 if (selectedCategoryRaw && !options.some(o => o.label === selectedCategoryRaw)) {
 setSelectedCategoryRaw('');
 }
 })
 .catch(err => console.error(err));
 }, [selectedDeviceTypeId]);

 // Track if this is the first time the cascade load runs
 const [isFirstCascade, setIsFirstCascade] = useState(true);

 // Cascade Load Post Offices when Commune changes
 useEffect(() => {
 if (!isFirstCascade) {
 setSelectedPostOfficeId('');
 } else {
 setIsFirstCascade(false);
 }
 
 let url = '/api/organization/post-offices';
 if (selectedCommuneId) {
 url += `?communeId=${selectedCommuneId}`;
 }
 apiFetch(url)
 .then(res => res.json())
 .then(data => setPostOffices(data))
 .catch(err => console.error(err));
 }, [selectedCommuneId]);

 // Load Equipments when Filters / Search / Page change
 const fetchEquipments = () => {
 setLoading(true);
 const params = new URLSearchParams({
 page: pagination.page,
 limit: pagination.limit
 });

 if (search) params.append('search', search);
 if (selectedCommuneId) params.append('communeId', selectedCommuneId);
 if (selectedPostOfficeId) params.append('postOfficeId', selectedPostOfficeId);
 if (selectedDeviceTypeId) params.append('deviceTypeId', selectedDeviceTypeId);
 if (selectedCategoryRaw) params.append('categoryRaw', selectedCategoryRaw);
 if (selectedStatus) params.append('status', selectedStatus);

 apiFetch(`/api/equipments?${params.toString()}`)
 .then(res => res.json())
 .then(data => {
 setItems(data.items || []);
 setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
 setLoading(false);
 })
 .catch(err => {
 console.error(err);
 setLoading(false);
 });
 };

 useEffect(() => {
 fetchEquipments();
 }, [search, selectedCommuneId, selectedPostOfficeId, selectedDeviceTypeId, selectedCategoryRaw, selectedStatus, pagination.page]);

 // Helper icon renderer
 const getDeviceIcon = (code) => {
 switch (code) {
 case 'PRINTER': return <Printer className="w-4 h-4 text-sky-600" />;
 case 'SCANNER': return <QrCode className="w-4 h-4 text-green-700" />;
 case 'NETWORK': return <Wifi className="w-4 h-4 text-yellow-700" />;
 case 'UPS': return <Zap className="w-4 h-4 text-yellow-400" />;
 case 'CAMERA': return <Camera className="w-4 h-4 text-red-700" />;
 case 'SCALE': return <Scale className="w-4 h-4 text-sky-600" />;
 default: return <Monitor className="w-4 h-4 text-[var(--color-primary)]" />;
 }
 };

 // Bộ lọc ĐANG ÁP DỤNG trên danh sách — dùng chung cho Export (đúng tập
 // đang xem, không phải luôn luôn toàn bộ thiết bị).
 const currentFilters = {
 search,
 communeId: selectedCommuneId,
 postOfficeId: selectedPostOfficeId,
 deviceTypeId: selectedDeviceTypeId,
 categoryRaw: selectedCategoryRaw,
 status: selectedStatus
 };

 const filterSummaryParts = [];
 if (search) filterSummaryParts.push(`tìm "${search}"`);
 if (selectedCommuneId) {
 const c = communes.find((x) => x.id === selectedCommuneId);
 filterSummaryParts.push(`BĐX: ${c ? c.name : selectedCommuneId}`);
 }
 if (selectedPostOfficeId) {
 const p = postOffices.find((x) => x.id === selectedPostOfficeId);
 filterSummaryParts.push(`Bưu cục: ${p ? p.name : selectedPostOfficeId}`);
 }
 if (selectedDeviceTypeId) {
 const dt = deviceTypes.find((x) => x.id === selectedDeviceTypeId);
 filterSummaryParts.push(`Loại thiết bị: ${dt ? dt.name : selectedDeviceTypeId}`);
 }
 if (selectedCategoryRaw) filterSummaryParts.push(`Phân loại: ${selectedCategoryRaw}`);
 if (selectedStatus) filterSummaryParts.push(`Trạng thái: ${selectedStatus}`);
 const filterSummary = filterSummaryParts.length > 0
 ? filterSummaryParts.join(' · ')
 : `toàn bộ ${pagination.total} thiết bị (không lọc)`;

 const handleImportSuccess = () => {
 fetchEquipments();
 fetchCommunes();
 fetchDeviceTypes();
 fetchPostOffices();
 };

 // Helper status badge renderer
 const getStatusBadge = (status) => {
 switch (status) {
 case 'IN_USE':
 return <span className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-semibold">Đang sử dụng</span>;
 case 'IN_STOCK':
 return <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-600 text-[11px] font-semibold">Tồn kho / Dự phòng</span>;
 case 'MAINTENANCE':
 return <span className="px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-[11px] font-semibold">Bảo trì</span>;
 case 'BROKEN':
 return <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">Hỏng / Chờ xử lý</span>;
 default:
 return <span className="px-2.5 py-1 rounded-full bg-gray-50 text-[var(--color-body)] text-[11px]">Không rõ</span>;
 }
 };

 return (
 <div className="p-6 space-y-6">
 {/* Header & Filter Bar */}
 <div className="card-soft p-5 rounded-2xl space-y-4">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-xl font-bold text-white flex items-center gap-2">
 <Monitor className="w-5 h-5 text-[var(--color-primary)]" />
 <span>Danh Sách CCDC IT & Thiết Bị Bưu Điện</span>
 </h2>
 <p className="text-xs text-[var(--color-body)] mt-1">Tìm kiếm & lọc CCDC theo Bưu điện Xã (BĐX), Bưu cục, Loại thiết bị, Trạng thái</p>
 </div>

 <div className="flex items-center gap-2 flex-wrap">
 <button
 onClick={() => setShowExportModal(true)}
 className="btn btn-outline-primary border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-800 flex items-center gap-2"
 >
 <Download className="w-4 h-4" />
 <span>Export Excel</span>
 </button>
 <button
 onClick={() => setShowImportModal(true)}
 className="btn btn-outline-primary flex items-center gap-2"
 >
 <Upload className="w-4 h-4" />
 <span>Import Excel</span>
 </button>
 <button
 onClick={onOpenAddModal}
 className="btn btn-dark flex items-center gap-1.5"
 >
 <Plus className="w-4 h-4" />
 <span>Thêm Thiết Bị CCDC</span>
 </button>
 </div>
 </div>

 {/* Cascading Filter Controls */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-[var(--color-border)]">
 {/* Filter 1: BĐX Commune Dropdown */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1 uppercase tracking-wider">
 1. Bưu Điện Xã (BĐX)
 </label>
 <select
 value={selectedCommuneId}
 onChange={(e) => setSelectedCommuneId(e.target.value)}
 className="w-full input-soft px-3 py-2 rounded-xl text-xs"
 >
 <option value="">-- Tất cả BĐX ({communes.length}) --</option>
 {communes.map(c => (
 <option key={c.id} value={c.id}>
 {c.code} - {c.name}
 </option>
 ))}
 </select>
 </div>

 {/* Filter 2: Cascading Bưu cục (MBC) Dropdown */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1 uppercase tracking-wider">
 2. Bưu Cục (MBC)
 </label>
 <select
 value={selectedPostOfficeId}
 onChange={(e) => setSelectedPostOfficeId(e.target.value)}
 className="w-full input-soft px-3 py-2 rounded-xl text-xs"
 >
 <option value="">-- Tất cả bưu cục ({postOffices.length}) --</option>
 {postOffices.map(po => (
 <option key={po.id} value={po.id}>
 {po.code} - {po.name} ({po.type || 'GD3'})
 </option>
 ))}
 </select>
 </div>

 {/* Filter 3: Device Type Dropdown */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1 uppercase tracking-wider">
 3. Loại Thiết Bị CCDC
 </label>
 <select
 value={selectedDeviceTypeId}
 onChange={(e) => setSelectedDeviceTypeId(e.target.value)}
 className="w-full input-soft px-3 py-2 rounded-xl text-xs"
 >
 <option value="">-- Tất cả loại thiết bị --</option>
 {deviceTypes.map(dt => (
 <option key={dt.id} value={dt.id}>
 {dt.name}
 </option>
 ))}
 </select>
 </div>

 {/* Filter 3.5: Category Raw Dropdown */}
 {categoryRawOptions.length > 0 && (
 <div>
 <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1 uppercase tracking-wider">
 Phân Loại Chi Tiết
 </label>
 <select
 value={selectedCategoryRaw}
 onChange={(e) => setSelectedCategoryRaw(e.target.value)}
 className="w-full input-soft px-3 py-2 rounded-xl text-xs"
 >
 <option value="">-- Tất cả phân loại --</option>
 {categoryRawOptions.map(opt => (
 <option key={opt.label} value={opt.label}>
 {opt.label} ({opt.count})
 </option>
 ))}
 </select>
 </div>
 )}

 {/* Filter 4: Status Dropdown */}
 <div>
 <label className="block text-[11px] font-semibold text-[var(--color-body)] mb-1 uppercase tracking-wider">
 4. Trạng Thái Cấp Phát
 </label>
 <select
 value={selectedStatus}
 onChange={(e) => setSelectedStatus(e.target.value)}
 className="w-full input-soft px-3 py-2 rounded-xl text-xs"
 >
 <option value="">-- Tất cả trạng thái --</option>
 <option value="IN_USE">Đang sử dụng</option>
 <option value="IN_STOCK">Tồn kho / Dự phòng</option>
 <option value="MAINTENANCE">Bảo trì / Sửa chữa</option>
 <option value="BROKEN">Hỏng / Chờ thanh lý</option>
 </select>
 </div>
 </div>
 </div>

 {/* Assets Table Section */}
 <div className="card-soft rounded-2xl overflow-hidden">
 {loading ? (
 <div className="p-12 flex flex-col items-center justify-center gap-3">
 <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
 <p className="text-xs text-[var(--color-body)]">Đang nạp danh sách CCDC...</p>
 </div>
 ) : items.length === 0 ? (
 <div className="p-12 text-center text-[var(--color-body)]">
 <Monitor className="w-12 h-12 mx-auto text-[var(--color-subtext)] mb-3" />
 <p className="font-semibold text-sm text-[var(--color-title)]">Không tìm thấy thiết bị CCDC phù hợp</p>
 <p className="text-xs text-[var(--color-subtext)] mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="table-soft w-full text-left text-xs">
 <thead>
 <tr className="bg-gray-50 text-[var(--color-body)] font-semibold border-b border-[var(--color-border)] uppercase tracking-wider text-[11px]">
 <th className="py-3.5 px-4">Mã CCDC / Máy</th>
 <th className="py-3.5 px-4">Định Danh Mạng (IP/MAC)</th>
 <th className="py-3.5 px-4">Bưu Điện Xã (BĐX) & Bưu Cục</th>
 <th className="py-3.5 px-4">Người Sử Dụng</th>
 <th className="py-3.5 px-4">Cấu Hình / Thông Số</th>
 <th className="py-3.5 px-4">Trạng Thái</th>
 <th className="py-3.5 px-4 text-right">Thao Tác</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100">
 {items.map((item) => (
 <tr 
 key={item.id} 
 className="hover:bg-gray-50 transition-colors group cursor-pointer"
 onClick={() => onSelectEquipment(item)}
 >
 {/* Asset Tag & Hostname */}
 <td className="py-3.5 px-4">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center border border-[var(--color-border)] group-hover:border-orange-200 group-hover:bg-orange-50 transition-all">
 {getDeviceIcon(item.device_type_code)}
 </div>
 <div>
 {/* Ưu tiên hiển thị MÃ CCDC (asset_tag) làm chữ đậm chính. */}
 <div className="font-bold text-[var(--color-title)] flex items-center gap-1.5 font-mono">
 <span>{item.asset_tag || 'Chưa có mã'}</span>
 </div>
 <div className="text-[11px] text-[var(--color-body)]">
 {item.hostname && <span className="text-[var(--color-title)] font-medium">{item.hostname} · </span>}
 {item.brand_name || 'Hãng khác'} {item.model || ''}
 </div>
 {item.specs?.category_raw && (
 <div className="mt-1 inline-flex px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[10px] text-sky-600 font-medium">
 {item.specs.category_raw}
 </div>
 )}
 </div>
 </div>
 </td>

 {/* IP & MAC */}
 <td className="py-3.5 px-4">
 <div className="font-mono text-[var(--color-primary)] font-medium">
 {item.ip_address || 'Chưa cấp IP'}
 </div>
 <div className="font-mono text-[11px] text-[var(--color-body)] mt-0.5">
 {item.mac_address || 'Chưa có MAC'}
 </div>
 </td>

 {/* Commune BĐX & Post Office MBC */}
 <td className="py-3.5 px-4">
 <div className="font-semibold text-[var(--color-title)]">
 {item.post_office_name} <span className="text-[10px] text-[var(--color-primary)] font-mono">({item.post_office_code})</span>
 </div>
 <div className="text-[11px] text-[var(--color-body)] flex items-center gap-1 mt-0.5">
 <MapPin className="w-3 h-3 text-[var(--color-subtext)] shrink-0" />
 <span className="truncate max-w-[160px]">{item.commune_name}</span>
 </div>
 </td>

 {/* Assigned User */}
 <td className="py-3.5 px-4">
 <div className="font-medium text-[var(--color-title)] flex items-center gap-1.5">
 <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
 <span>{item.assigned_user_display}</span>
 </div>
 {item.assigned_user_hrm && (
 <div className="text-[10px] text-sky-600 font-mono mt-0.5">
 HRM: {item.assigned_user_hrm}
 </div>
 )}
 </td>

 {/* Hardware Specs Summary */}
 <td className="py-3.5 px-4">
 <div className="flex flex-wrap gap-1">
 {item.specs.cpu && (
 <span className="px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-[var(--color-title)] border border-[var(--color-border)]">
 {item.specs.cpu}
 </span>
 )}
 {item.specs.ram && (
 <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[10px] text-orange-600 border border-orange-200">
 RAM {item.specs.ram}
 </span>
 )}
 {item.specs.storage && (
 <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[10px] text-sky-600 border border-sky-200">
 {item.specs.storage}
 </span>
 )}
 {item.specs.os && (
 <span className="px-1.5 py-0.5 rounded bg-gray-50 text-[10px] text-[var(--color-body)] border border-[var(--color-border)]">
 {item.specs.os}
 </span>
 )}
 </div>
 </td>

 {/* Status Badge */}
 <td className="py-3.5 px-4">
 {getStatusBadge(item.status)}
 </td>

 {/* Actions */}
 <td className="py-3.5 px-4 text-right">
 <button 
 onClick={(e) => {
 e.stopPropagation();
 onSelectEquipment(item);
 }}
 className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-orange-50 hover:text-[var(--color-primary)] text-[var(--color-title)] transition-all text-xs font-semibold flex items-center gap-1 ml-auto"
 >
 <Eye className="w-3.5 h-3.5" />
 <span>Chi Tiết</span>
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* Pagination Footer */}
 <div className="p-4 border-t border-[var(--color-border)] bg-white flex items-center justify-between">
 <div className="text-xs text-[var(--color-body)]">
 Hiển thị <span className="font-bold text-white">{items.length}</span> / <span className="font-bold text-white">{pagination.total}</span> thiết bị CCDC
 </div>

 <div className="flex items-center gap-2">
 <button
 disabled={pagination.page <= 1}
 onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
 className="px-3 py-1.5 rounded-lg input-soft text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-orange-200 transition-all flex items-center gap-1"
 >
 <ChevronLeft className="w-4 h-4" />
 <span>Trang trước</span>
 </button>
 <span className="text-xs text-[var(--color-body)] px-2 font-medium">
 Trang {pagination.page} / {pagination.totalPages}
 </span>
 <button
 disabled={pagination.page >= pagination.totalPages}
 onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
 className="px-3 py-1.5 rounded-lg input-soft text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-orange-200 transition-all flex items-center gap-1"
 >
 <span>Trang sau</span>
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>

 {showExportModal && (
 <ExportEquipmentModal
 onClose={() => setShowExportModal(false)}
 filters={currentFilters}
 filterSummary={filterSummary}
 />
 )}

 {showImportModal && (
 <ImportEquipmentModal
 onClose={() => setShowImportModal(false)}
 onSuccess={handleImportSuccess}
 />
 )}
 </div>
 );
}
