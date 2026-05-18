const API_BASE = window.INDEX0_API_BASE;

const dom = {
    adminLogin: document.getElementById('adminLogin'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminUsernameInput: document.getElementById('adminUsername'),
    adminPasswordInput: document.getElementById('adminPassword'),
    adminLoginError: document.getElementById('adminLoginError'),
    adminDashboard: document.getElementById('adminDashboard'),
    userTableBody: document.getElementById('userTableBody'),
};

const state = {
    adminToken: null,
};

async function adminLogin(username, password) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        state.adminToken = data.token;
        sessionStorage.setItem('index0_admin_token', data.token);
        showDashboard();
    } catch (error) {
        dom.adminLoginError.textContent = error.message;
    }
}

async function fetchUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/users`, {
            headers: { 'Authorization': `Bearer ${state.adminToken}` }
        });
        const users = await response.json();
        if (!response.ok) {
            throw new Error(users.error || 'Failed to fetch users');
        }
        renderUsers(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        // If token is invalid, force logout
        if (error.message.includes('Unauthorized')) {
            logoutAdmin();
        }
    }
}

function renderUsers(users) {
    dom.userTableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.nickname || ''}</td>
            <td>${user.isAdmin ? 'Yes' : 'No'}</td>
            <td>
                <button class="action-btn" data-user-id="${user.id}">View</button>
            </td>
        `;
        dom.userTableBody.appendChild(row);
    });
}

function showDashboard() {
    dom.adminLogin.hidden = true;
    dom.adminDashboard.hidden = false;
    document.body.classList.add('admin-body');
    fetchUsers();
}

function logoutAdmin() {
    state.adminToken = null;
    sessionStorage.removeItem('index0_admin_token');
    dom.adminLogin.hidden = false;
    dom.adminDashboard.hidden = true;
    document.body.classList.remove('admin-body');
    dom.adminUsernameInput.value = '';
    dom.adminPasswordInput.value = '';
}

function setupEventListeners() {
    dom.adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = dom.adminUsernameInput.value;
        const password = dom.adminPasswordInput.value;
        adminLogin(username, password);
    });
}

function checkStoredSession() {
    const token = sessionStorage.getItem('index0_admin_token');
    if (token) {
        state.adminToken = token;
        showDashboard();
    }
}

function init() {
    setupEventListeners();
    checkStoredSession();
}

init();
