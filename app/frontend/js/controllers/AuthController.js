/**
 * controllers/AuthController.js
 * Login/register/logout via real API + Socket.io.
 * Handles EXP bar glow + breakthrough button state.
 */
import { toast }                          from '../utils/toast.js';
import api, { saveToken, clearToken }     from '../utils/api.js';
import { connectSocket, disconnectSocket } from '../utils/socket.js';

export class AuthController {
  constructor({ userModel, sidebarView, memberView, appController, onLogin, onLogout }) {
    this.userModel     = userModel;
    this.sidebarView   = sidebarView;
    this.memberView    = memberView;
    this.appController = appController;
    this.onLogin       = onLogin;
    this.onLogout      = onLogout;
    this._bindUI();
    this._tryAutoLogin();
  }

  async _tryAutoLogin() {
    const token = localStorage.getItem('xianxia_token');
    if (!token) return;
    try {
      const { user } = await api.auth.me();
      saveToken(token);
      connectSocket(token);
      this._doLogin(user);
    } catch {
      clearToken();
    }
  }

  _bindUI() {
    document.getElementById('btn-login')
      ?.addEventListener('click', () => this._openModal());
    document.getElementById('btn-open-login')
      ?.addEventListener('click', () => {
        if (this.userModel.isLoggedIn) this._doLogout();
        else this._openModal();
      });
    document.getElementById('close-auth-modal')
      ?.addEventListener('click', () => this._closeModal());
    document.getElementById('modal-auth')
      ?.addEventListener('click', e => { if (e.target.id === 'modal-auth') this._closeModal(); });

    document.getElementById('tab-login')    ?.addEventListener('click', () => this._showTab('login'));
    document.getElementById('tab-register') ?.addEventListener('click', () => this._showTab('register'));
    document.getElementById('switch-to-register')
      ?.addEventListener('click', e => { e.preventDefault(); this._showTab('register'); });
    document.getElementById('switch-to-login')
      ?.addEventListener('click', e => { e.preventDefault(); this._showTab('login'); });

    document.getElementById('form-login')   ?.addEventListener('submit', e => { e.preventDefault(); this._handleLogin(); });
    document.getElementById('form-register')?.addEventListener('submit', e => { e.preventDefault(); this._handleRegister(); });
    document.getElementById('btn-logout')   ?.addEventListener('click', () => this._doLogout());

    // Settings Modal
    document.getElementById('btn-settings')
      ?.addEventListener('click', () => this._openSettingsModal());
    document.getElementById('close-settings-modal')
      ?.addEventListener('click', () => this._closeSettingsModal());
    document.getElementById('modal-settings')
      ?.addEventListener('click', e => { if (e.target.id === 'modal-settings') this._closeSettingsModal(); });

    // Avatar preview logic
    document.getElementById('btn-select-avatar')
      ?.addEventListener('click', () => document.getElementById('avatar-input')?.click());
    document.getElementById('avatar-input')
      ?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          document.getElementById('settings-avatar-preview').src = URL.createObjectURL(file);
        }
      });
      
    document.getElementById('form-settings')?.addEventListener('submit', (e) => this._handleSettingsSubmit(e));
  }

  _openSettingsModal() {
    if (!this.userModel.isLoggedIn) return;
    document.getElementById('modal-settings')?.classList.remove('hidden');
    document.getElementById('settings-gender').value = this.userModel.data.gender || 'kho_noi';
    document.getElementById('settings-avatar-preview').src = this.userModel.data.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    this.refreshExpBar(); // update settings text
  }
  _closeSettingsModal() {
    document.getElementById('modal-settings')?.classList.add('hidden');
  }

  async _handleSettingsSubmit(e) {
    e.preventDefault();
    const file = document.getElementById('avatar-input').files?.[0];
    const gender = document.getElementById('settings-gender').value;

    if (file && file.size > 2 * 1024 * 1024) {
      toast('Kích thước ảnh tối đa 2MB!', 'error');
      return;
    }

    const formData = new FormData();
    if (file) formData.append('avatar', file);
    formData.append('gender', gender);

    const btn = document.getElementById('btn-save-settings');
    if (btn) btn.textContent = 'Đang lưu...';
    try {
      const res = await api.auth.updateSettings(formData);
      // Update local user data
      this.userModel.data = { ...this.userModel.data, ...res.user };
      this._updateProfileUI(this.userModel.data);
      toast('Cập nhật thiết lập thành công!', 'success');
      this._closeSettingsModal();
    } catch (err) {
      toast(err.message || 'Lỗi cập nhật thiết lập', 'error');
    } finally {
      if (btn) btn.textContent = 'Lưu Thiết Lập';
    }
  }

  _openModal()  { document.getElementById('modal-auth')?.classList.remove('hidden'); }
  _closeModal() { document.getElementById('modal-auth')?.classList.add('hidden'); }

  _showTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('tab-login')    ?.classList.toggle('active', isLogin);
    document.getElementById('tab-register') ?.classList.toggle('active', !isLogin);
    document.getElementById('form-login')   ?.classList.toggle('hidden', !isLogin);
    document.getElementById('form-register')?.classList.toggle('hidden', isLogin);
  }

  async _handleLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const pw    = document.getElementById('login-password')?.value;
    if (!email || !pw) { toast('Vui lòng điền đầy đủ thông tin!', 'error'); return; }
    try {
      const { token, user } = await api.auth.login({ email, password: pw });
      saveToken(token);
      connectSocket(token);
      this._doLogin(user);
    } catch (err) {
      toast(err.message || 'Đăng nhập thất bại', 'error');
    }
  }

  async _handleRegister() {
    const name  = document.getElementById('reg-name')?.value.trim();
    const email = document.getElementById('reg-email')?.value.trim();
    const pw    = document.getElementById('reg-password')?.value;
    if (!name || !email || !pw) { toast('Vui lòng điền đầy đủ thông tin!', 'error'); return; }
    if (pw.length < 6) { toast('Mật chú phải ít nhất 6 ký tự!', 'error'); return; }
    try {
      const { token, user } = await api.auth.register({ name, email, password: pw });
      saveToken(token);
      connectSocket(token);
      this._doLogin(user);
    } catch (err) {
      toast(err.message || 'Đăng ký thất bại', 'error');
    }
  }

  _doLogin(serverUser) {
    const user = this.userModel.loginFromServer(serverUser);
    this._closeModal();
    this._updateProfileUI(user);
    this.sidebarView.show();
    this.memberView.renderFromServer([]);
    toast(`Chào mừng ${user.name} đến Tiên Giới Hội! ✨`, 'success');
    this.appController?.loadUserSects();
    this.onLogin?.(user);
  }

  _doLogout() {
    api.auth.logout().catch(() => {});
    disconnectSocket();
    clearToken();
    this.userModel.logout();
    document.getElementById('guest-profile')?.classList.remove('hidden');
    document.getElementById('user-profile') ?.classList.add('hidden');
    document.getElementById('sect-channels-wrap')?.classList.add('hidden');
    document.getElementById('dm-conversations')?.classList.add('hidden');
    const dmList = document.getElementById('dm-list-dynamic');
    if (dmList) dmList.innerHTML = '';
    document.getElementById('guest-channels')?.classList.remove('hidden');
    document.getElementById('channel-panel-title').textContent = 'Trang Chủ';
    this.sidebarView.hide();
    this.memberView.renderFromServer([]);
    toast('Đã đăng xuất khỏi Tiên Giới', 'info');
    this.onLogout?.();
  }

  _updateProfileUI(user) {
    document.getElementById('guest-profile')?.classList.add('hidden');
    document.getElementById('user-profile') ?.classList.remove('hidden');

    const avatarEl = document.getElementById('profile-avatar');
    const avatarUrl = user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=1a1040`;
    if (avatarEl) {
      avatarEl.src = avatarUrl;
    }
    const settingsAvatarEl = document.getElementById('settings-avatar-preview');
    if (settingsAvatarEl) {
      settingsAvatarEl.src = avatarUrl;
    }

    document.getElementById('profile-name') .textContent = user.name;
    document.getElementById('profile-realm').textContent = user.realm;

    // Apply realm color class to profile realm text
    const realmEl = document.getElementById('profile-realm');
    if (realmEl) {
      realmEl.className = `user-realm realm-name-${user.realmCss ?? 'luyen-khi'}`;
    }

    this.refreshExpBar();
  }

  /** Update EXP bar + glow + breakthrough button */
  refreshExpBar() {
    if (!this.userModel.isLoggedIn) return;
    const u     = this.userModel.data;
    const bar   = document.getElementById('exp-bar');
    const label = document.getElementById('exp-label');
    const pct   = this.userModel.expPercent;
    const isFull = pct >= 100;

    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.toggle('full', isFull);
    }
    if (label) {
      label.textContent = `${(u.exp ?? 0).toLocaleString('vi-VN')} / ${(u.maxExp ?? 0).toLocaleString('vi-VN')} Linh Khí`;
    }

    const settingsStatus = document.getElementById('settings-exp-status');
    if (settingsStatus) {
      settingsStatus.textContent = `Cảnh giới: ${u.realm} | Tu vi: ${(u.exp ?? 0).toLocaleString('vi-VN')} / ${(u.maxExp ?? 0).toLocaleString('vi-VN')}`;
    }

    // Breakthrough button glow
    const btn = document.getElementById('btn-breakthrough');
    if (btn) {
      btn.classList.toggle('ready', isFull);
      btn.title = isFull ? '⚡ Linh Khí đã đầy – Đột Phá ngay!' : `${pct}% Linh Khí`;
    }

    // Update realm name color in profile
    const realmEl = document.getElementById('profile-realm');
    if (realmEl && u.realmCss) {
      realmEl.className = `user-realm realm-name-${u.realmCss}`;
      realmEl.textContent = u.realm;
    }
  }
}
