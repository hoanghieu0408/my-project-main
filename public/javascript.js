let statusInterval = null;
let currentEditId = null;

// chuẩn hoá url (nếu người dùng nhập thiếu protocol)
function normalizeUrl(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'http://' + trimmed;
}

async function fetchWebsites() {
    const res = await fetch('/websites');
    const data = await res.json();
    const table = document.getElementById('websiteTable');
    table.innerHTML = '';
    // hiển thị ID theo thứ tự (index + 1) nhưng row vẫn giữ data-id = site.id
    data.forEach((site, index) => {
      table.innerHTML += `
        <tr data-id="${site.id}">
          <td>${index + 1}</td>
          <td>${site.name}</td>
          <td><a href="${site.url}" target="_blank" rel="noopener noreferrer">${site.url}</a></td>
          <td id="status-${site.id}" class="${site.active ? 'active' : 'inactive'}">${site.active ? 'Hoạt động' : 'Không hoạt động'}</td>
          <td>
            <button class="edit-btn" onclick="editWebsite(${site.id})" title="Chỉnh sửa">✏️</button>
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
      body: JSON.stringify({ name, url: normalizeUrl(url) })
    });
    document.getElementById('name').value = '';
    document.getElementById('url').value = '';
    fetchWebsites();
  }

  async function updateWebsite(id, name, url) {
    const body = {};
    if (name !== null) body.name = name;
    if (url !== null) body.url = normalizeUrl(url);
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

  // Replace inline-edit behavior with modal popup
  function editWebsite(id) {
    const row = document.querySelector(`#websiteTable tr[data-id="${id}"]`);
    if (!row) return;
    currentEditId = id;

    const nameCell = row.children[1];
    const urlCell = row.children[2];
    const anchor = urlCell.querySelector('a');
    const currentName = nameCell.textContent.trim();
    const currentUrl = anchor ? anchor.href : urlCell.textContent.trim();

    // populate modal inputs
    document.getElementById('modal-name').value = currentName;
    document.getElementById('modal-url').value = currentUrl;

    showModal();
  }

  // show / hide modal helpers
  function showModal() {
    const modal = document.getElementById('editModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    // focus first input
    setTimeout(() => document.getElementById('modal-name').focus(), 50);
  }

  function closeModal() {
    const modal = document.getElementById('editModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    currentEditId = null;
  }

  // modal save / cancel wiring
  document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('modal-save');
    const cancelBtn = document.getElementById('modal-cancel');
    const modal = document.getElementById('editModal');

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (!currentEditId) return;
        const name = document.getElementById('modal-name').value.trim();
        const url = document.getElementById('modal-url').value.trim();
        if (!name || !url) {
          return alert('Vui lòng nhập tên và URL hợp lệ');
        }
        await updateWebsite(currentEditId, name, url);
        closeModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        closeModal();
      });
    }

    // click outside to close
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      // ESC to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
          closeModal();
        }
      });
    }
  });

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