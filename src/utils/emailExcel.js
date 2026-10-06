const EMAIL_FIELDS = [
  { key: 'email', label: 'Email', required: true, note: 'Email công vụ, dùng làm khoá chính. (BẮT BUỘC)', example: 'vidu.donvi@example.com' },
  { key: 'loai', label: 'Loại (Đơn vị/Cá nhân)', required: true, note: 'Nhập "Đơn vị" hoặc "Cá nhân". (BẮT BUỘC KHI TẠO MỚI)', example: 'Đơn vị' },
  { key: 'maHrm', label: 'Mã HRM', required: false, note: 'Mã HRM (Bắt buộc với Cá nhân, Đơn vị thì bỏ trống).', example: 'HRM001' },
  { key: 'hoTen', label: 'Họ và tên', required: true, note: 'Họ tên hoặc tên Đơn vị. (BẮT BUỘC KHI TẠO MỚI)', example: 'Nguyễn Văn A' },
  { key: 'soDienThoai', label: 'Số điện thoại', required: false, note: 'Số điện thoại liên hệ.', example: '0912345678' },
  { key: 'maBdx', label: 'Mã BĐX', required: false, note: 'Mã Bưu Điện Xã. Nếu nhập phải khớp trên hệ thống.', example: 'BDX01' },
  { key: 'maBuuCuc', label: 'Mã bưu cục', required: false, note: 'Mã bưu cục. Nếu có hệ thống tự suy BĐX.', example: 'MBC01' },
  { key: 'chucDanh', label: 'Chức danh', required: false, note: 'Chức danh (đối với cá nhân).', example: 'Chuyên viên' },
  { key: 'trangThai', label: 'Trạng thái', required: false, note: 'Nhập "Đang sử dụng" hoặc "Đã thu hồi". Bỏ trống tự suy từ Ngày thu hồi.', example: 'Đang sử dụng' },
  { key: 'ngayKhoiTao', label: 'Ngày khởi tạo', required: false, note: 'Định dạng dd/mm/yyyy.', example: '01/01/2024' },
  { key: 'ngayThuHoi', label: 'Ngày thu hồi', required: false, note: 'Định dạng dd/mm/yyyy. (Bắt buộc nếu trạng thái Đã thu hồi).', example: '05/03/2024' }
];

function cellToString(cell) {
  const v = cell ? cell.value : null;
  if (v === null || v === undefined) return '';

  if (v instanceof Date) {
    // exceljs trả Date cho ô định dạng ngày (UTC)
    const dd = String(v.getUTCDate()).padStart(2, '0');
    const mm = String(v.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = v.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((rt) => rt.text).join('');
    if (v.text) return String(v.text);
    if (v.result !== undefined) {
      if (v.result instanceof Date) {
        const dd = String(v.result.getUTCDate()).padStart(2, '0');
        const mm = String(v.result.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = v.result.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
      return String(v.result);
    }
    return '';
  }
  return String(v).trim();
}

function buildHeaderKeyMap(headerRow) {
  const map = {};
  headerRow.eachCell((cell, colNumber) => {
    let label = cellToString(cell).trim().toLowerCase();
    
    // Xử lý biến thể
    if (label === 'loại') label = 'loại (đơn vị/cá nhân)';
    if (label === 'họ tên') label = 'họ và tên';

    const field = EMAIL_FIELDS.find((f) => f.label.trim().toLowerCase() === label);
    if (field) map[colNumber] = field.key;
  });
  return map;
}

function extractRowsFromWorksheet(worksheet) {
  const rows = [];
  const excelRows = [];
  let headerMap = null;
  const missingRequiredColumns = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      headerMap = buildHeaderKeyMap(row);
      
      const emailField = EMAIL_FIELDS.find(f => f.key === 'email');
      const hasEmail = Object.values(headerMap).includes('email');
      if (!hasEmail) {
        missingRequiredColumns.push(emailField.label);
      }
      return;
    }

    if (missingRequiredColumns.length > 0) return;

    let isEmpty = true;
    const rowData = {};
    Object.keys(headerMap).forEach((colNumber) => {
      const val = cellToString(row.getCell(Number(colNumber)));
      rowData[headerMap[colNumber]] = val;
      if (val !== '') isEmpty = false;
    });

    if (!isEmpty) {
      rows.push(rowData);
      excelRows.push(rowNumber);
    }
  });

  return { rows, excelRows, missingRequiredColumns };
}

function buildTemplateWorkbook(ExcelJS) {
  const workbook = new ExcelJS.Workbook();
  const dataSheet = workbook.addWorksheet('Dữ liệu');

  // Header
  dataSheet.addRow(EMAIL_FIELDS.map((f) => f.label));
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Column config (SĐT, Mã HRM dạng text, Ngày dạng text)
  dataSheet.columns = EMAIL_FIELDS.map(f => {
    let col = { width: 20 };
    if (f.key === 'soDienThoai' || f.key === 'maHrm') {
      col.numFmt = '@';
    } else if (f.key === 'ngayKhoiTao' || f.key === 'ngayThuHoi') {
      col.numFmt = '@';
    }
    return col;
  });

  const examples = [
    { email: 'vidu.donvi@example.com', loai: 'Đơn vị', maHrm: '', hoTen: 'Phòng Kỹ thuật', soDienThoai: '0234111222', maBdx: '', maBuuCuc: '', chucDanh: '', trangThai: 'Đang sử dụng', ngayKhoiTao: '10/10/2023', ngayThuHoi: '' },
    { email: 'vidu.canhan1@example.com', loai: 'Cá nhân', maHrm: 'HRM123', hoTen: 'Nguyễn Văn A', soDienThoai: '0912333444', maBdx: '', maBuuCuc: '', chucDanh: 'Chuyên viên', trangThai: 'Đang sử dụng', ngayKhoiTao: '01/01/2024', ngayThuHoi: '' },
    { email: 'vidu.canhan2@example.com', loai: 'Cá nhân', maHrm: 'HRM124', hoTen: 'Trần Thị B', soDienThoai: '0988777666', maBdx: '', maBuuCuc: '', chucDanh: 'Nhân viên', trangThai: 'Đã thu hồi', ngayKhoiTao: '01/02/2023', ngayThuHoi: '20/12/2023' },
    { email: 'vidu.canhan1@example.com', loai: '', maHrm: '', hoTen: '', soDienThoai: '0999999999', maBdx: '', maBuuCuc: '', chucDanh: 'Trưởng phòng', trangThai: '', ngayKhoiTao: '', ngayThuHoi: '' }
  ];

  examples.forEach(ex => {
    const r = dataSheet.addRow(EMAIL_FIELDS.map(f => ex[f.key] ?? ''));
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  });

  // Hướng dẫn
  const guideSheet = workbook.addWorksheet('Hướng dẫn');
  guideSheet.addRow(['Tên cột', 'Bắt buộc?', 'Ý nghĩa', 'Ví dụ / Giá trị hợp lệ']);
  guideSheet.getRow(1).font = { bold: true };
  EMAIL_FIELDS.forEach((f) => {
    guideSheet.addRow([f.label, f.required ? 'Bắt buộc' : 'Không bắt buộc', f.note, f.example]);
  });
  guideSheet.addRow([]);
  guideSheet.addRow(['Quy tắc chung', '', 'DÒNG ĐẦU TIÊN LÀ TIÊU ĐỀ, KHÔNG ĐỔI TÊN CỘT. Các dòng nền vàng là ví dụ — XOÁ TRƯỚC KHI IMPORT.', '']);
  guideSheet.addRow(['', '', 'Email là khoá, không phân biệt hoa/thường. Email đã có -> CẬP NHẬT; chưa có -> TẠO MỚI. Một người có thể có nhiều email.', '']);
  guideSheet.addRow(['', '', 'Email mới bắt buộc có "Loại" và "Họ và tên". Email đã có: ô để trống = giữ nguyên giá trị cũ.', '']);
  guideSheet.addRow(['', '', 'Loại: "Đơn vị" hoặc "Cá nhân". Đơn vị thì Mã HRM để TRỐNG; Cá nhân thì Mã HRM BẮT BUỘC.', '']);
  guideSheet.addRow(['', '', 'Mã BĐX / Mã bưu cục: đều không bắt buộc, phải đúng mã đang có trong Quản lý mạng lưới (không tự tạo mới). Chỉ ghi Mã bưu cục thì hệ thống tự suy ra BĐX; ghi cả hai thì phải khớp nhau.', '']);
  guideSheet.addRow(['', '', 'Trạng thái: "Đang sử dụng" (xoá ngày thu hồi) hoặc "Đã thu hồi" (BẮT BUỘC có Ngày thu hồi). Để trống -> suy ra từ Ngày thu hồi (có ngày = Đã thu hồi, không có = Đang sử dụng).', '']);
  guideSheet.addRow(['', '', 'Ngày: dd/mm/yyyy (ví dụ 05/03/2024).', '']);
  guideSheet.addRow(['', '', 'Email cá nhân đang dùng có Mã HRM chưa có trong "Người sử dụng" sẽ được TỰ THÊM vào đó. Mã HRM đã có thì giữ nguyên (chỉ báo cảnh báo nếu lệch tên/đơn vị). Email đã thu hồi không tạo người dùng.', '']);
  guideSheet.addRow(['', '', 'Nếu có BẤT KỲ dòng lỗi, hệ thống KHÔNG ghi gì cả và liệt kê lỗi theo số dòng để sửa rồi import lại.', '']);

  guideSheet.columns = [{ width: 20 }, { width: 15 }, { width: 80 }, { width: 30 }];
  guideSheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  return workbook;
}

function buildExportWorkbook(ExcelJS, items) {
  const workbook = new ExcelJS.Workbook();
  const dataSheet = workbook.addWorksheet('Email');

  dataSheet.addRow(EMAIL_FIELDS.map((f) => f.label));
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

  dataSheet.columns = EMAIL_FIELDS.map(f => {
    let col = { width: 20 };
    if (f.key === 'soDienThoai' || f.key === 'maHrm') {
      col.numFmt = '@';
    } else if (f.key === 'ngayKhoiTao' || f.key === 'ngayThuHoi') {
      col.numFmt = '@';
    }
    return col;
  });

  items.forEach(item => {
    dataSheet.addRow(EMAIL_FIELDS.map(f => item[f.key] ?? ''));
  });

  return workbook;
}

export {
  EMAIL_FIELDS,
  cellToString,
  buildHeaderKeyMap,
  extractRowsFromWorksheet,
  buildTemplateWorkbook,
  buildExportWorkbook
};
