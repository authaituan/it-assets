import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertTriangle, Phone, User, Monitor } from 'lucide-react';
import { apiFetchJson } from '../utils/api';

// ==========================================
// "Bản Đồ Điểm Phục Vụ" — submenu con của "Quản Lý Mạng Lưới" (feat/network-map-view).
// Thay thế nội dung placeholder rỗng của feat/network-submenu-restructure — KHÔNG cần
// đụng lại Sidebar.jsx/App.jsx (đã render đúng component này, không truyền prop nào).
// Dùng leaflet + react-leaflet (lần đầu dùng trong dự án, 2 dependency mới trong
// package.json) + nền OpenStreetMap (tile miễn phí, không cần API key):
// https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
// Dữ liệu: GET /api/network (đã trả sẵn latitude/longitude + equipment_count +
// responsible_user_name qua feat/network-management-backend/feat/network-responsible-
// person-backend — KHÔNG cần gọi API đếm riêng cho từng bưu cục).
// ==========================================

// Toạ độ trung tâm TP Huế — dùng làm fallback khi chưa tính được trung bình toạ độ
// (vd chưa có bưu cục nào có toạ độ).
const HUE_CENTER = [16.4637, 107.5909];
const DEFAULT_ZOOM = 11;

// Bán kính marker tỉ lệ theo equipment_count — dùng căn bậc hai để chênh lệch diện
// tích không quá cực đoan giữa bưu cục 1 máy và bưu cục 60+ máy (vd 531130 VP BĐ
// Thành Phố Huế). Kẹp trong khoảng [6, 26]px cho dễ nhìn ở mọi mức zoom.
function markerRadius(equipmentCount) {
  const count = Number(equipmentCount) || 0;
  return Math.max(6, Math.min(26, 6 + Math.sqrt(count) * 3));
}

function markerColor(operationalStatus, count) {
  if (operationalStatus === 'INACTIVE') return '#EF4444'; // Red
  if (!count || count === 0) return '#A1A1AA'; // Gray
  return '#F97316'; // Orange
}

export default function NetworkMapView({ onSelectUnitFilter }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    // limit lớn để nạp toàn bộ ~206 bưu cục 1 lần (cùng pattern NetworkListView.jsx) —
    // equipment_count đã có sẵn trong response, không cần gọi thêm API đếm riêng.
    apiFetchJson('/api/network?limit=2000').then((result) => {
      if (!isMounted) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems(result.data.items || []);
    });
    return () => { isMounted = false; };
  }, []);

  const pointsWithCoords = useMemo(
    () => items.filter((po) => po.latitude !== null && po.latitude !== undefined && po.longitude !== null && po.longitude !== undefined),
    [items]
  );
  const missingCoordCount = items.length - pointsWithCoords.length;

  const mapCenter = useMemo(() => {
    if (pointsWithCoords.length === 0) return HUE_CENTER;
    const sum = pointsWithCoords.reduce(
      (acc, po) => [acc[0] + Number(po.latitude), acc[1] + Number(po.longitude)],
      [0, 0]
    );
    return [sum[0] / pointsWithCoords.length, sum[1] / pointsWithCoords.length];
  }, [pointsWithCoords]);

  return (
    <div className="p-6 space-y-4">
      <div className="card-soft p-5 rounded-2xl">
        <h2 className="text-xl font-bold text-[var(--color-title)] flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[var(--color-primary)]" />
          <span>Bản Đồ Điểm Phục Vụ</span>
        </h2>
        <p className="text-xs text-[var(--color-body)] mt-1">
          Vị trí thực tế các bưu cục trên nền OpenStreetMap — màu điểm theo tình trạng hoạt động
          (cam = đang hoạt động, đỏ = cảnh báo/ngừng, xám = không có máy), kích thước điểm theo số lượng thiết bị.
        </p>

        {!loading && !error && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-semibold">
              {pointsWithCoords.length} / {items.length} bưu cục hiện được trên bản đồ
            </span>
            {missingCoordCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{missingCoordCount} / {items.length} bưu cục chưa có toạ độ (cần bổ sung dần qua "Danh Sách" hoặc Import Excel)</span>
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>

      <div className="card-soft rounded-2xl overflow-hidden" style={{ height: '650px', minHeight: '600px' }}>
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
            <p className="text-xs text-[var(--color-body)]">Đang nạp dữ liệu bản đồ...</p>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pointsWithCoords.map((po) => {
              const isActive = po.operational_status === 'ACTIVE' || !po.operational_status;
              return (
                <CircleMarker
                  key={po.id}
                  center={[Number(po.latitude), Number(po.longitude)]}
                  radius={markerRadius(po.equipment_count)}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: markerColor(po.operational_status, po.equipment_count),
                    fillOpacity: 0.9,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--color-title)' }}>{po.code} — {po.name}</div>
                      {po.type && <div style={{ fontSize: '11px', color: 'var(--color-body)' }}>{po.type} • {po.commune_name}</div>}
                      <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--color-body)' }}>
                        {po.address || 'Chưa có địa chỉ'}{po.new_ward_name ? `, ${po.new_ward_name}` : ''}
                      </div>
                      {po.phone && (
                        <div style={{ fontSize: '12px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} /> <span>{po.phone}</span>
                        </div>
                      )}
                      <div style={{ fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                          background: isActive ? '#34d399' : '#94a3b8'
                        }}></span>
                        <span>{isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Monitor size={12} /> <span>{po.equipment_count ?? 0} thiết bị</span>
                      </div>
                      {po.responsible_user_name && (
                        <div style={{ fontSize: '12px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> <span>{po.responsible_user_name} ({po.responsible_user_hrm || '—'})</span>
                        </div>
                      )}
                      {(po.equipment_count > 0) && onSelectUnitFilter && (
                        <div style={{ marginTop: '12px' }}>
                          <button
                            onClick={() => onSelectUnitFilter(po.commune_id, po.id)}
                            style={{
                              width: '100%',
                              padding: '6px 12px',
                              backgroundColor: 'var(--color-primary)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'block',
                              textAlign: 'center',
                              boxShadow: '0 2px 4px rgba(14, 165, 233, 0.2)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EA580C'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                          >
                            Xem thiết bị tại đây
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
