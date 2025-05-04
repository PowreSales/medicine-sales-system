const GAS_URL = 'YOUR_GAS_WEB_APP_URL'; // Replace with your GAS web app URL
let role = '';
let sessionId = '';
let inventoryData = [];
let selectedItems = [];

function showModal(title, message, isConfirm = false) {
  if (document.getElementById('modal').style.display === 'flex') return;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-buttons').innerHTML = isConfirm
    ? '<button id="modal-confirm">Confirm</button><button id="modal-cancel">Cancel</button>'
    : '<button id="modal-ok">OK</button>';
  document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', duration);
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (show && !loading) {
    const div = document.createElement('div');
    div.id = 'loading';
    div.textContent = 'Loading...';
    document.body.appendChild(div);
    setTimeout(() => showLoading(false), 10000);
  } else if (!show && loading) {
    loading.remove();
  }
}

async function callGasFunction(functionName, data) {
  console.log(`Calling GAS function: ${functionName}`, data);
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ functionName, data }),
      mode: 'cors',
      credentials: 'include'
    });
    const result = await response.json();
    console.log(`Response from ${functionName}:`, result);
    if (result.error) throw new Error(result.error);
    return result.data;
  } catch (error) {
    console.error(`Error in ${functionName}:`, error);
    throw error;
  }
}

function initializeSelect2() {
  $('.medicine-select').select2({
    placeholder: 'Select medicine...',
    allowClear: true,
    width: '100%'
  });
  $('.medicine-name-select').select2({
    placeholder: 'Add or select medicine...',
    allowClear: true,
    width: '100%',
    tags: true
  });
  $('#medicine').on('change', updateUnitPrice);
}

async function login() {
  const loginBtn = document.getElementById('login-btn');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) {
    showToast('Please enter username and password');
    return;
  }
  loginBtn.disabled = true;
  showLoading(true);
  try {
    console.log('Login attempt:', { username, password });
    const result = await callGasFunction('validateUser', { username, password });
    showLoading(false);
    if (result.success) {
      role = result.role;
      sessionId = result.sessionId;
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      const navBar = document.getElementById('nav-bar');
      navBar.classList.add('active');
      if (result.role === 'Manager') {
        document.getElementById('inventory-btn').classList.remove('hidden');
        document.getElementById('sales-report-btn').classList.remove('hidden');
        document.getElementById('sales-summary-btn').classList.remove('hidden');
      }
      showSection('sales-form-section');
      showToast('Login successful');
    } else {
      showModal('Error', result.message || 'Login failed');
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message || 'Failed to connect to server');
    console.error('Login error:', error);
  } finally {
    loginBtn.disabled = false;
  }
}

function showSection(sectionId) {
  document.querySelectorAll('.form-section').forEach(section => section.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
  if (sectionId === 'sales-form-section' || sectionId === 'inventory-form-section') {
    loadInventory();
  }
}

function logout() {
  role = '';
  sessionId = '';
  inventoryData = [];
  selectedItems = [];
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('nav-bar').classList.remove('active');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  showToast('Logged out successfully');
}

async function loadInventory() {
  if (!sessionId) {
    showModal('Error', 'Session expired. Please log in.');
    logout();
    return;
  }
  showLoading(true);
  try {
    const result = await callGasFunction('getInventoryData', { sessionId });
    showLoading(false);
    if (result.success) {
      inventoryData = result.data;
      updateInventoryTable();
      updateMedicineDropdowns();
    } else {
      showModal('Error', result.message || 'Failed to load inventory');
      if (result.message === 'Invalid session') logout();
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message);
  }
}

function updateInventoryTable() {
  const tbody = document.getElementById('inventory-table').getElementsByTagName('tbody')[0];
  tbody.innerHTML = '';
  inventoryData.forEach(item => {
    const row = document.createElement('tr');
    row.setAttribute('aria-label', `Medicine: ${item.name}`);
    const status = item.stock === 0 ? 'Out of Stock' : item.stock < item.reorderLevel ? 'Low Stock' : 'In Stock';
    row.className = status.toLowerCase().replace(' ', '-');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.unitPrice.toFixed(2)}</td>
      <td>${item.stock}</td>
      <td>${status}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateMedicineDropdowns() {
  const medicineSelect = document.getElementById('medicine');
  const medicineNameSelect = document.getElementById('medicine-name');
  medicineSelect.innerHTML = '<option value="">Select medicine...</option>';
  medicineNameSelect.innerHTML = '<option value="">Add or select medicine...</option>';
  inventoryData.forEach(item => {
    if (item.stock > 0) {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = `${item.name} (Stock: ${item.stock})`;
      option.dataset.price = item.unitPrice;
      option.dataset.stock = item.stock;
      medicineSelect.appendChild(option);
    }
    const nameOption = document.createElement('option');
    nameOption.value = item.name;
    nameOption.textContent = item.name;
    nameOption.dataset.price = item.unitPrice;
    nameOption.dataset.stock = item.stock;
    medicineNameSelect.appendChild(nameOption);
  });
  $('#medicine').trigger('change');
}

function updateUnitPrice() {
  const selectedOption = document.getElementById('medicine').selectedOptions[0];
  const unitPrice = selectedOption ? parseFloat(selectedOption.dataset.price) || 0 : 0;
  const stock = selectedOption ? parseInt(selectedOption.dataset.stock) || 0 : 0;
  document.getElementById('unit-price').value = unitPrice.toFixed(2);
  document.getElementById('available-stock').textContent = stock;
  const quantityInput = document.getElementById('quantity');
  quantityInput.max = stock;
  quantityInput.value = stock > 0 ? 1 : '';
  updateGrandTotal();
}

function addItem() {
  const medicine = document.getElementById('medicine').value;
  const quantity = parseInt(document.getElementById('quantity').value) || 0;
  const unitPrice = parseFloat(document.getElementById('unit-price').value) || 0;
  if (!medicine || quantity <= 0) {
    showToast('Select a medicine and valid quantity');
    return;
  }
  const selectedOption = document.getElementById('medicine').selectedOptions[0];
  const availableStock = parseInt(selectedOption.dataset.stock) || 0;
  if (quantity > availableStock) {
    showToast(`Only ${availableStock} units available`);
    return;
  }
  selectedItems.push({ medicine, quantity, unitPrice, total: unitPrice * quantity });
  updateSummary();
  updateGrandTotal();
  document.getElementById('medicine').value = '';
  document.getElementById('quantity').value = '';
  document.getElementById('unit-price').value = '';
  $('#medicine').val(null).trigger('change');
  showToast('Item added');
}

function updateSummary() {
  const summary = document.getElementById('purchase-summary');
  if (selectedItems.length === 0) {
    summary.innerHTML = 'No items selected.';
    return;
  }
  let html = '<table role="grid"><thead><tr><th scope="col">Medicine</th><th scope="col">Quantity</th><th scope="col">Price (GHC)</th><th scope="col">Total</th></tr></thead><tbody>';
  selectedItems.forEach(item => {
    html += `<tr><td>${item.medicine}</td><td>${item.quantity}</td><td>${item.unitPrice.toFixed(2)}</td><td>${item.total.toFixed(2)}</td></tr>`;
  });
  html += '</tbody></table>';
  summary.innerHTML = html;
}

function updateGrandTotal() {
  const grandTotal = selectedItems.reduce((sum, item) => sum + item.total, 0);
  document.getElementById('grand-total').value = grandTotal.toFixed(2);
}

async function submitSale() {
  if (!sessionId) {
    showModal('Error', 'Session expired. Please log in.');
    logout();
    return;
  }
  const saleDate = document.getElementById('sale-date').value;
  const paymentMethod = document.getElementById('payment-method').value;
  if (!saleDate || selectedItems.length === 0 || !paymentMethod) {
    showToast('Complete all fields and add items');
    return;
  }
  showLoading(true);
  try {
    const result = await callGasFunction('submitSale', {
      sessionId,
      data: { date: saleDate, items: selectedItems, paymentMethod }
    });
    showLoading(false);
    if (result.success) {
      showModal('Success', 'Sale recorded');
      selectedItems = [];
      document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('medicine').value = '';
      document.getElementById('quantity').value = '';
      document.getElementById('unit-price').value = '';
      $('#medicine').val(null).trigger('change');
      updateSummary();
      loadInventory();
    } else {
      showModal('Error', result.message || 'Failed to record sale');
      if (result.message === 'Invalid session') logout();
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message);
  }
}

async function addMedicine() {
  if (!sessionId) {
    showModal('Error', 'Session expired. Please log in.');
    logout();
    return;
  }
  const name = document.getElementById('medicine-name').value.trim();
  const unitPrice = parseFloat(document.getElementById('medicine-price').value) || 0;
  const stock = parseInt(document.getElementById('medicine-stock').value) || 0;
  if (!name || unitPrice <= 0 || stock < 0) {
    showToast('Enter valid medicine name, price, and stock');
    return;
  }
  showLoading(true);
  try {
    const result = await callGasFunction('addMedicine', {
      sessionId,
      data: { name, unitPrice, stock }
    });
    showLoading(false);
    if (result.success) {
      showModal('Success', 'Medicine added/updated');
      document.getElementById('medicine-name').value = '';
      document.getElementById('medicine-price').value = '';
      document.getElementById('medicine-stock').value = '';
      $('#medicine-name').val(null).trigger('change');
      loadInventory();
    } else {
      showModal('Error', result.message || 'Failed to add medicine');
      if (result.message === 'Invalid session') logout();
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message);
  }
}

async function loadSalesReport() {
  if (!sessionId) {
    showModal('Error', 'Session expired. Please log in.');
    logout();
    return;
  }
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  if (!startDate || !endDate) {
    showToast('Select both dates');
    return;
  }
  showLoading(true);
  try {
    const result = await callGasFunction('getSalesReport', {
      sessionId,
      data: { startDate, endDate }
    });
    showLoading(false);
    if (result.success) {
      const tbody = document.getElementById('sales-table').getElementsByTagName('tbody')[0];
      tbody.innerHTML = '';
      result.data.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${sale.date}</td>
          <td>${sale.medicine}</td>
          <td>${sale.unitPrice.toFixed(2)}</td>
          <td>${sale.quantity}</td>
          <td>${(sale.unitPrice * sale.quantity).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
      });
    } else {
      showModal('Error', result.message || 'Failed to load report');
      if (result.message === 'Invalid session') logout();
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message);
  }
}

async function loadSalesSummary() {
  if (!sessionId) {
    showModal('Error', 'Session expired. Please log in.');
    logout();
    return;
  }
  const startDate = document.getElementById('summary-start-date').value;
  const endDate = document.getElementById('summary-end-date').value;
  if (!startDate || !endDate) {
    showToast('Select both dates');
    return;
  }
  showLoading(true);
  try {
    const result = await callGasFunction('getSalesSummary', {
      sessionId,
      data: { startDate, endDate }
    });
    showLoading(false);
    if (result.success) {
      const tbody = document.getElementById('sales-summary-table').getElementsByTagName('tbody')[0];
      tbody.innerHTML = '';
      result.data.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.medicine}</td>
          <td>${item.totalSales.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
      });
    } else {
      showModal('Error', result.message || 'Failed to load summary');
      if (result.message === 'Invalid session') logout();
    }
  } catch (error) {
    showLoading(false);
    showModal('Error', error.message);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  initializeSelect2();
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('sale-date').max = new Date().toISOString().split('T')[0];

  // Navigation buttons
  document.querySelector('button[aria-label="Sales Form"]').addEventListener('click', () => showSection('sales-form-section'));
  document.getElementById('inventory-btn').addEventListener('click', () => showSection('inventory-form-section'));
  document.getElementById('sales-report-btn').addEventListener('click', () => showSection('sales-report'));
  document.getElementById('sales-summary-btn').addEventListener('click', () => showSection('sales-summary-section'));
  document.querySelector('button[aria-label="Logout"]').addEventListener('click', logout);

  // Form buttons
  document.getElementById('add-item-btn').addEventListener('click', addItem);
  document.getElementById('submit-sale-btn').addEventListener('click', submitSale);
  document.getElementById('add-medicine-btn').addEventListener('click', addMedicine);
  document.getElementById('generate-report-btn').addEventListener('click', loadSalesReport);
  document.getElementById('generate-summary-btn').addEventListener('click', loadSalesSummary);

  // Modal buttons
  document.getElementById('modal-ok').addEventListener('click', closeModal);
  document.getElementById('modal-buttons').addEventListener('click', (e) => {
    if (e.target.id === 'modal-confirm') confirmAction();
    if (e.target.id === 'modal-cancel') closeModal();
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker Registered'))
    .catch(err => console.error('Service Worker Error:', err));
}
