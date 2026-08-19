
const API_BASE = '/api';

const Auth = {
  getToken() { return localStorage.getItem('eit_token'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('eit_user')); } catch { return null; }
  },
  setSession(token, user) {
    localStorage.setItem('eit_token', token);
    localStorage.setItem('eit_user', JSON.stringify(user));
  },
  updateUser(user) { localStorage.setItem('eit_user', JSON.stringify(user)); },
  logout() {
    localStorage.removeItem('eit_token');
    localStorage.removeItem('eit_user');
    window.location.href = 'login.html';
  },
  requireAuth() {
    if (!this.getToken()) window.location.href = 'login.html';
  }
};

const API = {
  async request(method, path, body, authRequired = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (authRequired) {
      const token = Auth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      if (res.status === 401 && authRequired) {
        Auth.logout();
      }
      throw new Error((data && data.message) || 'Request failed');
    }
    return data;
  },
  get(path, authRequired = true) { return this.request('GET', path, undefined, authRequired); },
  post(path, body, authRequired = true) { return this.request('POST', path, body, authRequired); },
  put(path, body, authRequired = true) { return this.request('PUT', path, body, authRequired); },
  delete(path, authRequired = true) { return this.request('DELETE', path, undefined, authRequired); }
};
