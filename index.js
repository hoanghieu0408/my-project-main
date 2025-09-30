// cấu hình node express
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const app = express();
const port = 3000;

// Middleware để parse JSON
app.use(express.json());

// Cho phép Express phục vụ file tĩnh (CSS, JS, ảnh...)
app.use(express.static(path.join(__dirname, 'public')));

// Đường dẫn đến file dữ liệu
const dataFile = path.join(__dirname, 'website.json');

// Hàm đọc dữ liệu từ file
function readWebsites() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

// Hàm ghi dữ liệu vào file
function writeWebsites(websites) {
  fs.writeFileSync(dataFile, JSON.stringify(websites, null, 2));
}

// Hàm kiểm tra trạng thái website
async function checkWebsiteStatus(url) {
  try {
    // Thêm http:// nếu không có protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    // Sử dụng axios để kiểm tra với timeout 5 giây
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Chấp nhận 2xx và 3xx
      }
    });
    
    return true; // Website hoạt động
  } catch (error) {
    console.log(`Website ${url} không hoạt động:`, error.message);
    return false; // Website không hoạt động
  }
}

// Hàm cập nhật trạng thái tất cả websites
async function updateAllWebsiteStatus() {
  const websites = readWebsites();
  for (let website of websites) {
    website.active = await checkWebsiteStatus(website.url);
  }
  writeWebsites(websites);
  return websites;
}

// Route trả về file index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes cho websites
// GET /websites - Lấy danh sách tất cả websites
app.get('/websites', (req, res) => {
  const websites = readWebsites();
  res.json(websites);
});

// GET /websites/check-status - Kiểm tra trạng thái tất cả websites
app.get('/websites/check-status', async (req, res) => {
  try {
    const websites = await updateAllWebsiteStatus();
    res.json(websites);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi kiểm tra trạng thái websites' });
  }
});

// POST /websites - Thêm website mới
app.post('/websites', async (req, res) => {
  const { name, url } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name và URL là bắt buộc' });
  }

  // Kiểm tra trạng thái website
  const isActive = await checkWebsiteStatus(url);

  const websites = readWebsites();
  const newWebsite = {
    id: websites.length > 0 ? Math.max(...websites.map(w => w.id)) + 1 : 1,
    name,
    url,
    active: isActive
  };

  websites.push(newWebsite);
  writeWebsites(websites);
  
  res.status(201).json(newWebsite);
});

// PUT /websites/:id - Cập nhật website
app.put('/websites/:id', (req, res) => {
  const { id } = req.params;
  const { name, url } = req.body;

  const websites = readWebsites();
  const websiteIndex = websites.findIndex(w => w.id === parseInt(id));

  if (websiteIndex === -1) {
    return res.status(404).json({ error: 'Website không tồn tại' });
  }

  if (name !== undefined) websites[websiteIndex].name = name;
  if (url !== undefined) websites[websiteIndex].url = url;

  writeWebsites(websites);
  res.json(websites[websiteIndex]);
});

// DELETE /websites/:id - Xóa website
app.delete('/websites/:id', (req, res) => {
  const { id } = req.params;

  const websites = readWebsites();
  const websiteIndex = websites.findIndex(w => w.id === parseInt(id));

  if (websiteIndex === -1) {
    return res.status(404).json({ error: 'Website không tồn tại' });
  }

  websites.splice(websiteIndex, 1);
  writeWebsites(websites);
  
  res.json({ message: 'Website đã được xóa thành công' });
});

// Chạy server
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});

