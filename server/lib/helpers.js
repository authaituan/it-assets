// Hàm dùng chung cho nhiều route (tách nguyên văn từ server/index.js).

// Helper function to format JSON specs
const parseSpecs = (specsStr) => {
  try {
    return typeof specsStr === 'string' ? JSON.parse(specsStr) : (specsStr || {});
  } catch (e) {
    return {};
  }
};

// Parse chuỗi -> số thực, rỗng/không hợp lệ -> null (dùng cho latitude/longitude).
function parseFloatOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// ==========================================
// Helper string normalizer (bỏ dấu + viết thường), dùng chung cho tìm kiếm
// nhân sự (search/autocomplete). Copy nguyên logic từ route HRM cũ
// (POST /api/hrm/upload-and-map, đã xoá — xem docs/ai/04_DECISIONS.md) trước
// khi xoá route đó, giữ lại đúng hành vi chuẩn hoá.
// ==========================================
const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Tiền tố mã CCDC hợp lệ: 2-5 ký tự IN HOA / số (A-Z, 0-9).
const ASSET_PREFIX_REGEX = /^[A-Z0-9]{2,5}$/;

module.exports = { parseSpecs, parseFloatOrNull, normalizeStr, ASSET_PREFIX_REGEX };
