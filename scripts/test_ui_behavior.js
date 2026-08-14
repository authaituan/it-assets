const http = require('http');
const { spawn } = require('child_process');

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('--- BẮT ĐẦU TEST UI MÔ PHỎNG ---\n');
  
  // 1. Đăng nhập để lấy token
  console.log('1. Đăng nhập admin (hrm_code: admin, password: 123456)...');
  const loginRes = await request('POST', '/api/auth/login', { hrm_code: 'admin', password: '123456' });
  const token = loginRes.body.token;
  console.log('-> Đăng nhập thành công, đã lấy token.');

  // 2. Gọi category-raw-options (Bước 1 của user)
  console.log('\n2. Gọi GET /api/equipments/category-raw-options...');
  const optsRes1 = await request('GET', '/api/equipments/category-raw-options', null, token);
  console.log('-> Kết quả: ' + optsRes1.body.length + ' labels tìm thấy.');
  console.log(optsRes1.body.slice(0, 3)); // show first 3

  // 3. Lấy 1 thiết bị thật (Bước 3)
  const eqId = '3595844b-d77c-426f-bff4-29342ee30439';
  console.log('\n3. Gọi GET /api/equipments/' + eqId + ' để lấy specs ban đầu...');
  const eqRes1 = await request('GET', '/api/equipments/' + eqId, null, token);
  console.log('-> Specs trước khi edit:', eqRes1.body.specs);
  
  // Mô phỏng Form Chỉnh Sửa trên UI (EquipmentDetailModal)
  console.log('\n4. Mô phỏng UI: Edit CHỈ ô Phân Loại Chi Tiết thành "Test Label Browser 123", giữ nguyên các ô Hardware Specs đã load trên form...');
  const updatePayload = {
    model: eqRes1.body.model,
    status: eqRes1.body.status,
    device_type_id: eqRes1.body.device_type_id,
    post_office_id: eqRes1.body.post_office_id,
    purchase_year: eqRes1.body.purchase_year,
    category_raw: "Test Label Browser 123",
    specs: {
      cpu: eqRes1.body.specs.cpu || '',
      ram: eqRes1.body.specs.ram || '',
      storage: eqRes1.body.specs.storage || '',
      os: eqRes1.body.specs.os || ''
    }
  };
  const putRes = await request('PUT', '/api/equipments/' + eqId, updatePayload, token);
  console.log('-> Lưu thành công! Trạng thái:', putRes.status);
  
  // Gọi lại lấy specs
  console.log('\n5. Gọi lại GET /api/equipments/' + eqId + ' để kiểm tra Specs sau khi edit...');
  const eqRes2 = await request('GET', '/api/equipments/' + eqId, null, token);
  console.log('-> Specs SAU khi edit:', eqRes2.body.specs);
  const specsObj = eqRes2.body.specs;
  if (specsObj.cpu && specsObj.ram && specsObj.category_raw === 'Test Label Browser 123') {
    console.log('=> XÁC NHẬN: Các field phần cứng (cpu, ram...) được giữ nguyên vẹn, category_raw được cập nhật!');
  } else {
    console.error('=> LỖI: Dữ liệu phần cứng bị mất!');
  }

  // 4. Tạo thiết bị mới với nhãn mới
  console.log('\n6. Tạo thiết bị mới với nhãn "Custom Label ABC"...');
  const createPayload = {
    hostname: 'TEST-NEW-001',
    device_type_id: eqRes1.body.device_type_id,
    post_office_id: eqRes1.body.post_office_id,
    purchase_year: 2024,
    category_raw: "Custom Label ABC",
    specs: { cpu: '', ram: '', storage: '', os: '' }
  };
  const postRes = await request('POST', '/api/equipments', createPayload, token);
  console.log('-> Tạo thành công. Trạng thái:', postRes.status);

  // 5. Kiểm tra danh sách gợi ý
  console.log('\n7. Gọi lại GET /api/equipments/category-raw-options lần 2...');
  const optsRes2 = await request('GET', '/api/equipments/category-raw-options', null, token);
  const hasTest = optsRes2.body.find(o => o.label === 'Test Label Browser 123');
  const hasCustom = optsRes2.body.find(o => o.label === 'Custom Label ABC');
  console.log('-> "Test Label Browser 123" có trong danh sách? ' + !!hasTest + ' (số lượng: ' + (hasTest ? hasTest.count : 0) + ')');
  console.log('-> "Custom Label ABC" có trong danh sách? ' + !!hasCustom + ' (số lượng: ' + (hasCustom ? hasCustom.count : 0) + ')');
  
  console.log('\n--- HOÀN TẤT TEST ---');
}

console.log('Khởi động server local...');
const serverProc = spawn('node', ['server/index.js'], { cwd: 'e:/OneDrive/Antigravity/quanly-ccdc', shell: true });

serverProc.stdout.on('data', (data) => {
  if (data.toString().includes('đang chạy tại')) {
    run().then(() => {
      serverProc.kill();
      process.exit(0);
    }).catch(e => {
      console.error(e);
      serverProc.kill();
      process.exit(1);
    });
  }
});

serverProc.stderr.on('data', (data) => console.error('Server Error:', data.toString()));

