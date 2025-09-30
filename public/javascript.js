let statusInterval = null;

async function fetchWebsites() {
    const res = await fetch('/websites');
    const data = await res.json();
    const table = document.getElementById('websiteTable');
    table.innerHTML = '';
    data.forEach(site => {
      table.innerHTML += `
        <tr>
          <td>${site.id}</td>
          <td>${site.name}</td>
          <td>${site.url}</td>
          <td id="status-${site.id}" class="${site.active ? 'active' : 'inactive'}">${site.active ? 'Hoạt động' : 'Không hoạt động'}</td>
          <td>
            <button onclick="deleteWebsite(${site.id})">Xóa</button>
          </td>
        </tr>
      `;
    });

    // Bắt đầu hoặc reset việc kiểm tra trạng thái
    startStatusChecks(data);
  }

  async function addWebsite() {
    const name = document.getElementById('name').value;
    const url = document.getElementById('url').value;
    if (!name || !url) return alert('Vui lòng nhập đủ thông tin');
    await fetch('/websites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });
    document.getElementById('name').value = '';
    document.getElementById('url').value = '';
    fetchWebsites();
  }

  async function updateWebsite(id, name, url) {
    const body = {};
    if (name !== null) body.name = name;
    if (url !== null) body.url = url;
    await fetch('/websites/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    fetchWebsites();
  }

  async function deleteWebsite(id) {
    if (!confirm('Bạn có chắc muốn xóa website này?')) return;
    await fetch('/websites/' + id, { method: 'DELETE' });
    fetchWebsites();
  }

  // Kiểm tra 1 website và cập nhật ô status
  async function checkWebsiteStatus(site) {
    const cell = document.getElementById(`status-${site.id}`);
    if (!cell) return;
    cell.textContent = '⏳ Kiểm tra...';
    cell.className = '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // timeout 8s
      const res = await fetch(site.url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeout);
      // Với mode: 'no-cors', response sẽ là opaque; coi là online nếu không bị reject
      const online = res && (res.ok || res.type === 'opaque');
      cell.textContent = online ? '🟢 Hoạt động' : '🔴 Không hoạt động';
      cell.className = online ? 'active' : 'inactive';
    } catch (e) {
      cell.textContent = '🔴 Không hoạt động';
      cell.className = 'inactive';
    }
  }

  // Bắt đầu vòng lặp kiểm tra trạng thái mỗi 10s
  function startStatusChecks(sites) {
    if (statusInterval) clearInterval(statusInterval);
    // kiểm tra ngay lần đầu từ danh sách hiện có
    sites.forEach(s => checkWebsiteStatus(s));
    // rồi mỗi 10s sẽ lấy lại danh sách từ server và kiểm tra (để cập nhật nếu có thay đổi)
    statusInterval = setInterval(async () => {
      try {
        const res = await fetch('/websites');
        const latest = await res.json();
        latest.forEach(s => checkWebsiteStatus(s));
      } catch (e) {
        // im lặng nếu lỗi
      }
    }, 10000);
  }

  fetchWebsites();