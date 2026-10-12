/**
 * controllers/AppController.js
 * Root controller: dynamic channel loading, sect management, presence.
 */
import { toast }      from '../utils/toast.js';
import { getSocket }  from '../utils/socket.js';
import api            from '../utils/api.js';

export class AppController {
  constructor({ userModel, sidebarView, chatView, memberView }) {
    this.userModel    = userModel;
    this.sidebarView  = sidebarView;
    this.chatView     = chatView;
    this.memberView   = memberView;
    this._currentView = 'blog';
    this._chatCtrl    = null;
    this._currentSect = null;
    this._channels    = [];
    this._currentDmUserId = null;
    this._incomingCallCallerId = null;
    this._queryCounter = 0;
    this._bindGlobal();
  }

  _generateQueryToken() {
    this._queryCounter = (this._queryCounter || 0) + 1;
    return this._queryCounter;
  }

  setChatController(chatCtrl) { 
    this._chatCtrl = chatCtrl; 
    if (chatCtrl) {
      chatCtrl.onDmReceived = (msg) => {
        this.loadDmConversations();
      };
    }
  }
  setVoiceController(voiceCtrl) { this._voiceCtrl = voiceCtrl; }

  // ── Global Socket Setup (Called after login) ────────────────
  setupGlobalSocketListeners() {
    const s = getSocket();
    if (!s) return;

    s.off('dm:message').on('dm:message', msg => {
      if (!this.userModel?.isLoggedIn) return;
      
      // Cập nhật lại list DMs và Bạn bè nếu có tin nhắn DM mới
      this.loadDmConversations();
      this.loadFriendsAndRecentDms();

      // Kiểm tra xem có đang ở trong trang chat của người này không
      const myId = String(this.userModel.data?.id);
      const isChattingWithSender = this._currentView === 'chat' && this._chatCtrl && this._chatCtrl._currentChannelId === `dm:${msg.sender_id}`;
      const isChattingWithReceiver = this._currentView === 'chat' && this._chatCtrl && this._chatCtrl._currentChannelId === `dm:${msg.receiver_id}`;
      
      if (!isChattingWithSender && !isChattingWithReceiver) {
        if (String(msg.sender_id) !== myId) {
          toast(`Thư truyền âm mới: ${msg.content.substring(0,20)}...`, 'info');
        }
      }
    });

    // ── Ringing Flow ─────────────────────────────────────────────
    s.off('voice:incoming_call').on('voice:incoming_call', callerInfo => {
      const modal = document.getElementById('modal-incoming-call');
      const avatar = document.getElementById('incoming-call-avatar');
      const name = document.getElementById('incoming-call-name');
      if (modal && avatar && name) {
        avatar.src = callerInfo.avatar || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        name.textContent = callerInfo.name;
        modal.classList.remove('hidden');
      }
      this._incomingCallCallerId = callerInfo.id;
    });

    s.off('voice:call_accepted').on('voice:call_accepted', info => {
      document.getElementById('modal-outgoing-call')?.classList.add('hidden');
      this.switchView('voice', {
        channel: `Đàm Đạo: ${info.targetName}`,
        channelId: info.channelId,
        autoJoin: true
      });
      toast('Kết nối linh âm thành công!', 'success');
    });

    s.off('voice:call_rejected').on('voice:call_rejected', info => {
      document.getElementById('modal-outgoing-call')?.classList.add('hidden');
      toast(`Đạo hữu ${info.name} đang bế quan (Từ chối).`, 'error');
    });

    s.off('voice:call_cancelled').on('voice:call_cancelled', info => {
      document.getElementById('modal-incoming-call')?.classList.add('hidden');
      toast(`Cuộc gọi nhỡ từ ${info.name}.`, 'info');
    });
  }

  // ── View Switching ──────────────────────────────────────────
  switchView(name, opts = {}) {
    this._generateQueryToken();
    this._currentView = name;

    // Clean up voice connection if leaving the voice view
    if (name !== 'voice') {
      this._voiceCtrl?.leaveChannel();
    }

    ['blog', 'chat', 'voice'].forEach(v => {
      document.getElementById(`view-${v}`)?.classList.toggle('active', v === name);
    });
    const pageEl = document.getElementById('breadcrumb-page');
    if (name === 'blog')  { 
      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) breadcrumb.textContent = 'Trang Chủ';
      if (pageEl) pageEl.textContent = 'Bảng Cáo Thị'; 
    }
    if (name === 'voice') {
      const ch = opts.channel ?? 'Linh Âm Đại Điện';
      const channelId = opts.channelId ?? null;
      if (pageEl) pageEl.textContent = '🔊 ' + ch;
      if (channelId) {
        this._voiceCtrl?.setChannel(channelId, ch);
        if (opts.autoJoin) {
          setTimeout(() => this._voiceCtrl?.joinChannel(), 300);
        }
      }
    }
    if (name === 'chat') {
      const ch = opts.channel ?? 'đại-sảnh';
      const channelId = opts.channelId ?? null;
      
      if (channelId && String(channelId).startsWith('dm:')) {
        const breadcrumb = document.getElementById('breadcrumb');
        if (breadcrumb) breadcrumb.textContent = 'Đồng Đạo Truyền Tin';
        if (pageEl) pageEl.textContent = '💬 ' + ch;
      } else {
        const breadcrumb = document.getElementById('breadcrumb');
        if (breadcrumb) breadcrumb.textContent = this._currentSect ? 'Tông Môn' : 'Trang Chủ';
        if (pageEl) pageEl.textContent = '# ' + ch;
      }
      
      if (channelId) this._chatCtrl?.setChannel(channelId);
    }
  }

  _requireLogin() {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return false;
    }
    return true;
  }

  // ── Setup lists on Login ───────────────────────────
  onLoginSuccess() {
    if (this.userModel.isLoggedIn) {
      this.loadDmConversations();
      this.loadFriendsAndRecentDms();
    }
  }

  // ── Load user's sects after login ───────────────────────────
  async loadUserSects() {
    try {
      this.loadNotificationsCount();
      const data = await api.sects.mine();
      const sects = data.sects ?? [];
      this.sidebarView.renderFromServer(sects);
      if (sects.length > 0) this.sidebarView.show();

      // DM conversations
      if (!this._currentSect && this.userModel.isLoggedIn) {
        document.getElementById('dm-conversations')?.classList.remove('hidden');
        this.loadDmConversations();
        this.loadFriendsAndRecentDms();
      }
    } catch { /* no sects yet */ }
  }

  async loadFriendsAndRecentDms() {
    if (!this.userModel?.isLoggedIn) return;
    this._friendQueryCounter = (this._friendQueryCounter || 0) + 1;
    const token = this._friendQueryCounter;
    try {
      const { friends } = await api.friends.list();
      const { conversations } = await api.dms.listRecent();
      if (this._friendQueryCounter !== token) return;
      if (this._currentSect !== null) return;
      this.memberView.renderFriendsAndRecentDms(friends ?? [], conversations ?? []);
    } catch (err) {
      console.error('Không tải được danh sách đồng đạo:', err);
    }
  }

  // ── Load channels for a sect ────────────────────────────────
  async _loadSectChannels(sectId, isManager = false) {
    const token = this._generateQueryToken();
    const s = getSocket();
    try {
      const data = await api.sects.channels(sectId);
      if (this._queryCounter !== token) return;
      if (this._currentSect !== sectId) return;
      this._channels = data.channels ?? [];

      this._renderChannelList(isManager);
    } catch (err) {
      if (this._currentSect === sectId) {
        toast('Không tải được kênh: ' + err.message, 'error');
      }
    }
  }

  _renderChannelList(isManager = false) {
    const container = document.getElementById('sect-channels-dynamic');
    if (!container) return;
    container.innerHTML = '';

    const groups = {
      announcement: { label: '📢 THÔNG BÁO', items: [] },
      text:         { label: '# KÊNH TÁN GẪU', items: [] },
      voice:        { label: '🔊 KÊNH THOẠI', items: [] },
    };

    this._channels.forEach(ch => {
      (groups[ch.type] ?? groups.text).items.push(ch);
    });

    Object.values(groups).forEach(g => {
      if (g.items.length === 0) return;
      container.innerHTML += `<div class="channel-group-label"><span class="caret">▾</span> ${g.label}</div>`;
      g.items.forEach(ch => {
        const icon = ch.type === 'voice' ? '🔊' : ch.type === 'announcement' ? '📢' : '#';
        const view = ch.type === 'voice' ? 'voice' : 'chat';
        const editBtn = isManager
          ? `<button class="channel-edit-icon" data-channel-id="${ch.id}" title="Chỉnh sửa kênh">✏️</button>`
          : '';
        container.innerHTML += `
          <div class="channel-item" data-view="${view}" data-channel="${ch.name}"
               data-channel-id="${ch.id}" data-channel-type="${ch.type}"
               role="button" tabindex="0">
            <span class="channel-icon">${icon}</span>
            <span class="channel-name-text">${ch.name}</span>
            ${editBtn}
          </div>`;
      });
    });

    if (container.innerHTML.trim() === '') {
      container.innerHTML = `<div class="channel-empty-hint">🌿 Tông môn chưa có kênh nào</div>`;
    }

    // Bind click on channel items
    container.querySelectorAll('.channel-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('channel-edit-icon')) return;
        const view = item.dataset.view;
        const channel = item.dataset.channel;
        const channelId = item.dataset.channelId;
        const channelType = item.dataset.channelType;
        if (view === 'chat') this.switchView('chat', { channel, channelId, channelType });
        else if (view === 'voice') this.switchView('voice', { channel, channelId, channelType });
        container.querySelectorAll('.channel-item').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Bind edit icons
    container.querySelectorAll('.channel-edit-icon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const channelId = btn.dataset.channelId;
        const channelItem = btn.closest('.channel-item');
        const channelName = channelItem?.dataset.channel ?? '';
        const channelType = channelItem?.dataset.channelType ?? 'text';
        this._openChannelModal('edit', { id: channelId, name: channelName, type: channelType });
      });
    });
  }

  // ── Load members for a sect ─────────────────────────────────
  async _loadSectMembers(sectId) {
    const token = this._generateQueryToken();
    try {
      const data = await api.sects.members(sectId);
      if (this._queryCounter !== token) return;
      if (this._currentSect !== sectId) return;
      this.memberView.renderFromServer(data.members ?? []);
    } catch { /* empty */ }
  }

  // ── Global Bindings ─────────────────────────────────────────
  _bindGlobal() {
    // Logo → blog
    document.getElementById('btn-home')?.addEventListener('click', () => {
      this.switchView('blog');
      document.getElementById('channel-panel-title').textContent = 'Trang Chủ';
      this._currentSect = null;
      this.sidebarView.setActive(null);
      document.getElementById('guest-channels')?.classList.remove('hidden');
      document.getElementById('sect-channels-wrap')?.classList.add('hidden');
      document.getElementById('btn-voice-call')?.classList.add('hidden');

      document.querySelectorAll('#channel-list .channel-item').forEach(el => el.classList.remove('active'));
      document.querySelector('#guest-channels .channel-item[data-view="blog"]')?.classList.add('active');

      if (this.userModel.isLoggedIn) {
        document.getElementById('dm-conversations')?.classList.remove('hidden');
        this.loadDmConversations();
        this.loadFriendsAndRecentDms();
      } else {
        document.getElementById('dm-conversations')?.classList.add('hidden');
        const list = document.getElementById('member-list');
        if (list) list.innerHTML = '<div class="member-group-label">Đăng nhập để xem đồng đạo</div>';
      }
    });

    // Guest channel items (blog links)
    document.querySelectorAll('#guest-channels .channel-item').forEach(item => {
      item.addEventListener('click', () => {
        this.switchView('blog');
        document.querySelectorAll('.channel-item').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Sect icon clicks from sidebar
    this.sidebarView.onSectClick = async (sectId) => {
      if (!this._requireLogin()) return;
      this._currentSect = sectId;
      document.getElementById('guest-channels')?.classList.add('hidden');
      document.getElementById('dm-conversations')?.classList.add('hidden');
      document.getElementById('sect-channels-wrap')?.classList.remove('hidden');
      document.getElementById('btn-voice-call')?.classList.add('hidden');

      // Load sect info
      try {
        const { sect } = await api.sects.get(sectId);
        if (this._currentSect !== sectId) return;
        document.getElementById('channel-panel-title').textContent = sect?.name ?? 'Tông Môn';
        // Show edit button only for owner
        const editBtn = document.getElementById('btn-edit-sect');
        if (editBtn) editBtn.style.display = (sect.owner_id === this.userModel.data?.id) ? '' : 'none';
      } catch { /* fallback */ }

      // Determine if user is manager (tong_chu or truong_lao)
      let isManager = false;
      try {
        const { members } = await api.sects.members(sectId);
        if (this._currentSect !== sectId) return;
        this._currentSectMembers = members;
        const me = members.find(m => String(m.id) === String(this.userModel.data?.id));
        isManager = me && (me.role === 'tong_chu' || me.role === 'truong_lao');
        this._isManager = isManager;
        this.memberView.renderFromServer(members);
      } catch { /* empty */ }

      await this._loadSectChannels(sectId, isManager);
      if (this._currentSect !== sectId) return;

      // Show/hide channel management bar
      const mgmtBar = document.getElementById('channel-mgmt-bar');
      if (mgmtBar) mgmtBar.classList.toggle('hidden', !isManager);

      // Show edit button for owner
      const editBtn = document.getElementById('btn-edit-sect');
      try {
        const { sect } = await api.sects.get(sectId);
        if (this._currentSect !== sectId) return;
        if (editBtn) editBtn.style.display = (String(sect.owner_id) === String(this.userModel.data?.id)) ? '' : 'none';
      } catch { if (editBtn) editBtn.style.display = 'none'; }

      // Auto-enter first text channel (not announcement)
      const firstText = this._channels.find(c => c.type === 'text');
      if (this._currentSect !== sectId) return;
      if (firstText) {
        this.switchView('chat', { channel: firstText.name, channelId: firstText.id, channelType: 'text' });
      } else {
        this.chatView?.render([], null);
      }

      // Socket presence
      getSocket()?.emit('sect:join', { sectId });
    };

    // Presence listeners
    const bindPresence = () => {
      const s = getSocket();
      if (!s) return;
      s.off('user:online').on('user:online', d => {
        this.memberView.setUserStatus(d.userId, 'online');
      });
      s.off('user:offline').on('user:offline', d => {
        this.memberView.setUserStatus(d.userId, 'offline');
      });
      s.off('notification:new').on('notification:new', notif => {
        let displayContent = notif.content;
        if (notif.type === 'sect_invite' || notif.type === 'friend_request') {
          try {
            const data = JSON.parse(notif.content);
            displayContent = data.text || notif.content;
          } catch (e) {}
        }
        toast(`📢 ${notif.title}\n${displayContent}`, 'info');
        this._updateNotifBadge(1);

        // Background sync
        if (notif.type && (notif.type.startsWith('friend_') || notif.type === 'friend_request')) {
          this.loadFriendsAndRecentDms();
        }
        if (notif.type && notif.type.startsWith('sect_')) {
          this.loadUserSects();
        }
      });
      s.off('friend:update').on('friend:update', () => {
        this.loadFriendsAndRecentDms();
      });
      s.off('sect:update').on('sect:update', () => {
        this.loadUserSects();
      });
    };
    // Re-bind when socket reconnects
    setTimeout(bindPresence, 2000);

    // Hero buttons
    document.getElementById('btn-hero-join')?.addEventListener('click', () => {
      if (this._requireLogin()) {
        toast('Hãy tạo hoặc gia nhập một Tông Môn để bắt đầu chat!', 'info');
      }
    });
    document.getElementById('btn-hero-explore')?.addEventListener('click', () => {
      document.getElementById('view-blog')?.scrollTo({ top: 400, behavior: 'smooth' });
    });

    // Member panel toggle
    document.getElementById('btn-members-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('member-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    });

    // Member search
    document.querySelector('.member-search')?.addEventListener('input', e => {
      this.memberView.filterByName(e.target.value);
    });

    // ── Create Sect ───────────────────────────────────────
    document.getElementById('btn-create-sect')?.addEventListener('click', () => {
      if (!this._requireLogin()) return;
      document.getElementById('modal-create-sect')?.classList.remove('hidden');
    });
    document.getElementById('close-create-sect')?.addEventListener('click', () => {
      document.getElementById('modal-create-sect')?.classList.add('hidden');
    });
    document.getElementById('modal-create-sect')?.addEventListener('click', e => {
      if (e.target.id === 'modal-create-sect') e.target.classList.add('hidden');
    });
    document.querySelectorAll('.sect-icon-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.sect-icon-opt').forEach(x => x.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    document.getElementById('form-create-sect')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('sect-name')?.value.trim();
      const icon = document.querySelector('.sect-icon-opt.selected')?.dataset.icon ?? '🐉';
      const desc = document.getElementById('sect-desc')?.value.trim();
      if (!name) { toast('Vui lòng đặt tên Tông Môn!', 'error'); return; }

      try {
        await api.sects.create({ name, icon, description: desc });
        document.getElementById('modal-create-sect')?.classList.add('hidden');
        document.getElementById('form-create-sect')?.reset();
        toast(`Tông Môn "${name}" đã thành lập! 🎉`, 'success');
        this.loadUserSects(); // refresh sidebar
      } catch (err) {
        toast(err.message || 'Lỗi tạo Tông Môn', 'error');
      }
    });

    // ── Edit Sect ─────────────────────────────────────────
    document.getElementById('btn-edit-sect')?.addEventListener('click', () => {
      if (!this._currentSect) return;
      document.getElementById('modal-edit-sect')?.classList.remove('hidden');
    });
    document.getElementById('close-edit-sect')?.addEventListener('click', () => {
      document.getElementById('modal-edit-sect')?.classList.add('hidden');
    });
    document.getElementById('form-edit-sect')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('edit-sect-name')?.value.trim();
      const desc = document.getElementById('edit-sect-desc')?.value.trim();
      if (!name) { toast('Tên không được trống!', 'error'); return; }
      try {
        await api.sects.update(this._currentSect, { name, description: desc });
        document.getElementById('modal-edit-sect')?.classList.add('hidden');
        document.getElementById('channel-panel-title').textContent = name;
        toast('Đã cập nhật Tông Môn! ✅', 'success');
        this.loadUserSects();
      } catch (err) { toast(err.message, 'error'); }
    });

    // ── Invite Member ─────────────────────────────────────
    document.getElementById('btn-invite-member')?.addEventListener('click', () => {
      if (!this._currentSect) return;
      document.getElementById('modal-invite')?.classList.remove('hidden');
    });
    document.getElementById('close-invite')?.addEventListener('click', () => {
      document.getElementById('modal-invite')?.classList.add('hidden');
    });
    document.getElementById('form-invite')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('invite-name')?.value.trim();
      if (!name) { toast('Nhập tên thành viên!', 'error'); return; }
      try {
        await api.sects.invite(this._currentSect, { name });
        document.getElementById('modal-invite')?.classList.add('hidden');
        document.getElementById('invite-name').value = '';
        toast(`Đã mời ${name} vào Tông Môn! ✉️`, 'success');
        this._loadSectMembers(this._currentSect);
      } catch (err) { toast(err.message, 'error'); }
    });

    // Voice handler setup is handled via VoiceController directly

    // ── Channel management ──────────────────────────────────
    document.getElementById('btn-add-channel')?.addEventListener('click', () => {
      this._openChannelModal('create');
    });
    document.getElementById('close-channel-modal')?.addEventListener('click', () => {
      document.getElementById('modal-channel')?.classList.add('hidden');
    });
    document.getElementById('modal-channel')?.addEventListener('click', e => {
      if (e.target.id === 'modal-channel') e.target.classList.add('hidden');
    });
    document.getElementById('form-channel')?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('channel-name')?.value.trim();
      const type = document.getElementById('channel-type')?.value;
      if (!name) { toast('Tên kênh không được trống!', 'error'); return; }

      const editingId = document.getElementById('form-channel').dataset.editingId;
      try {
        if (editingId) {
          await api.sects.updateChannel(this._currentSect, editingId, { name, type });
          toast('Đã cập nhật kênh! ✅', 'success');
        } else {
          await api.sects.createChannel(this._currentSect, { name, type });
          toast(`Đã tạo kênh "${name}"! 🎉`, 'success');
        }
        document.getElementById('modal-channel')?.classList.add('hidden');
        const isManager = true;
        await this._loadSectChannels(this._currentSect, isManager);
      } catch (err) { toast(err.message || 'Lỗi kênh', 'error'); }
    });
    document.getElementById('btn-delete-channel')?.addEventListener('click', async () => {
      const editingId = document.getElementById('form-channel').dataset.editingId;
      if (!editingId) return;
      if (!confirm('Xác nhận xóa kênh? Toàn bộ tin nhắn sẽ bị xóa.')) return;
      try {
        await api.sects.deleteChannel(this._currentSect, editingId);
        toast('Đã xóa kênh!', 'success');
        document.getElementById('modal-channel')?.classList.add('hidden');
        const isManager = true;
        await this._loadSectChannels(this._currentSect, isManager);
      } catch (err) { toast(err.message || 'Lỗi xóa kênh', 'error'); }
    });

    // ── Search User Modal Bindings ───────────────────────────
    const searchBtn = document.getElementById('btn-search');
    const searchModal = document.getElementById('modal-search-user');
    const searchInput = document.getElementById('search-user-input');
    const searchResults = document.getElementById('search-user-results');
    const closeSearch = document.getElementById('close-search-user');

    searchBtn?.addEventListener('click', () => {
      if (!this._requireLogin()) return;
      searchModal?.classList.remove('hidden');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      if (searchResults) {
        searchResults.innerHTML = '<div class="search-empty" style="text-align:center; padding:20px; color:var(--t-muted);">Nhập tên để tìm kiếm đồng đạo...</div>';
      }
    });

    closeSearch?.addEventListener('click', () => {
      searchModal?.classList.add('hidden');
    });
    searchModal?.addEventListener('click', e => {
      if (e.target.id === 'modal-search-user') e.target.classList.add('hidden');
    });

    let searchTimeout = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (!query) {
        searchResults.innerHTML = '<div class="search-empty" style="text-align:center; padding:20px; color:var(--t-muted);">Nhập tên để tìm kiếm đồng đạo...</div>';
        return;
      }
      
      searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:var(--t-muted);">Đang dò la tin tức... 🌀</div>';

      searchTimeout = setTimeout(async () => {
        try {
          const { users } = await api.auth.searchUsers(query);
          if (!users || users.length === 0) {
            searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:var(--t-muted);">Không có tin tức về đồng đạo này 🍂</div>';
            return;
          }
          searchResults.innerHTML = '';
          users.forEach(u => {
            const isMember = this._currentSectMembers?.some(m => String(m.id) === String(u.id));
            let actionBtnHtml = '';
            if (isMember) {
              actionBtnHtml = '<span class="btn-invite-action joined">Đã gia nhập</span>';
            } else if (this._currentSect && this._isManager) {
              actionBtnHtml = `<button class="btn-invite-action invite" data-username="${u.name}">Chiêu Mộ</button>`;
            }

            const avatarUrl = u.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
            const avatarHtml = `<img src="${avatarUrl}" class="search-avatar" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" />`;

            searchResults.innerHTML += `
              <div class="search-result-item" data-uid="${u.id}">
                <div class="search-user-info">
                  ${avatarHtml}
                  <div class="search-user-meta">
                    <span class="search-user-name">${u.name}</span>
                    <span class="search-user-realm ${u.realmCss || 'realm-1'}">${u.realm || 'Luyện Khí Kỳ'}</span>
                  </div>
                </div>
                ${actionBtnHtml}
              </div>
            `;
          });

          searchResults.querySelectorAll('.btn-invite-action.invite').forEach(btn => {
            btn.addEventListener('click', async (evt) => {
              evt.stopPropagation();
              const username = btn.dataset.username;
              btn.disabled = true;
              btn.textContent = 'Đang mời...';
              try {
                await api.sects.invite(this._currentSect, { name: username });
                toast(`Đã mời đệ tử ${username} vào Tông Môn! ✉️`, 'success');
                btn.className = 'btn-invite-action joined';
                btn.textContent = 'Đã mời';
                this._loadSectMembers(this._currentSect);
              } catch (err) {
                toast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Chiêu Mộ';
              }
            });
          });

        } catch (err) {
          searchResults.innerHTML = `<div style="text-align:center; padding:20px; color:#e05c5c;">Gặp chướng ngại: ${err.message}</div>`;
        }
      }, 300);
    });

    // ── Notifications Modal Bindings ─────────────────────────
    const notifBtn = document.getElementById('btn-notifications');
    const notifModal = document.getElementById('modal-notifications');
    const notifList = document.getElementById('notifications-list');
    const closeNotif = document.getElementById('close-notifications');
    const closeNotifBtn = document.getElementById('close-notifications-btn');
    const clearNotifBtn = document.getElementById('btn-clear-notifications');

    const renderNotifications = async () => {
      try {
        const { notifications } = await api.notifications.list();
        if (!notifications || notifications.length === 0) {
          notifList.innerHTML = '<div class="notif-empty" style="text-align:center; padding:20px; color:var(--t-muted);">Không có truyền tin mới...</div>';
          return;
        }
        notifList.innerHTML = '';
        notifications.forEach(n => {
          const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const unreadStyle = !n.is_read ? 'border-left: 3px solid var(--c-gold); padding-left: 9px;' : '';
          
          let displayContent = n.content;
          let isInteractive = false;
          if (n.type === 'friend_request' || n.type === 'sect_invite') {
            try {
              const parsed = JSON.parse(n.content);
              displayContent = parsed.text || n.content;
              isInteractive = true;
            } catch (e) {
              console.error('Failed to parse interactive notification content:', e);
            }
          }

          let buttonsHtml = '';
          if (isInteractive) {
            buttonsHtml = `
              <div class="notif-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                <button class="btn-notif-accept" data-id="${n.id}" style="background: linear-gradient(135deg, #1e5f3c, #103522); border: 1px solid #2e8b57; color: #fff; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 0 5px rgba(46,139,87,0.3); transition: all 0.2s;">Chấp Nhận 🤝</button>
                <button class="btn-notif-reject" data-id="${n.id}" style="background: linear-gradient(135deg, #7c1a1a, #4a1010); border: 1px solid #a52a2a; color: #fff; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 0 5px rgba(165,42,42,0.3); transition: all 0.2s;">Từ Chối 🚫</button>
              </div>
            `;
          }

          notifList.innerHTML += `
            <div class="notif-result-item" style="${unreadStyle} display: flex; justify-content: space-between; align-items: flex-start; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <div class="notif-user-info" style="display: flex; gap: 10px; flex: 1;">
                <div class="notif-avatar text-avatar" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); font-size: 16px;">${n.type === 'sect_invite' ? '📜' : n.type === 'friend_request' ? '🤝' : '🔔'}</div>
                <div class="notif-user-meta" style="display: flex; flex-direction: column; flex: 1;">
                  <span class="notif-user-name" style="font-weight: bold; color: var(--c-gold); font-size: 13px;">${n.title}</span>
                  <span class="notif-user-realm" style="color: #d1d5db; font-size: 12px; margin-top: 4px; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">${displayContent}</span>
                  ${buttonsHtml}
                </div>
              </div>
              <span style="font-size: 11px; color: var(--t-muted); margin-left: 10px; white-space: nowrap;">${timeStr}</span>
            </div>
          `;

          if (!n.is_read) {
            api.notifications.read(n.id).catch(() => {});
          }
        });

        this._updateNotifBadge(0, true);

      } catch (err) {
        notifList.innerHTML = `<div style="text-align:center; padding:20px; color:#e05c5c;">Gặp chướng ngại: ${err.message}</div>`;
      }
    };

    notifList?.addEventListener('click', async (e) => {
      const acceptBtn = e.target.closest('.btn-notif-accept');
      const rejectBtn = e.target.closest('.btn-notif-reject');
      if (acceptBtn) {
        const id = acceptBtn.dataset.id;
        acceptBtn.disabled = true;
        try {
          const res = await api.notifications.accept(id);
          toast(`✨ ${res.message || 'Thao tác thành công!'}`, 'success');
          await renderNotifications();
          this.loadFriendsAndRecentDms();
          if (this._currentSect) {
            this._loadSectMembers(this._currentSect);
          }
          this.loadUserSects();
        } catch (err) {
          toast(err.message || 'Lỗi thao tác', 'error');
          acceptBtn.disabled = false;
        }
      }
      if (rejectBtn) {
        const id = rejectBtn.dataset.id;
        rejectBtn.disabled = true;
        try {
          const res = await api.notifications.reject(id);
          toast(`✨ ${res.message || 'Đã từ chối!'}`, 'success');
          await renderNotifications();
          this.loadFriendsAndRecentDms();
          this.loadUserSects();
        } catch (err) {
          toast(err.message || 'Lỗi thao tác', 'error');
          rejectBtn.disabled = false;
        }
      }
    });

    notifBtn?.addEventListener('click', () => {
      if (!this._requireLogin()) return;
      notifModal?.classList.remove('hidden');
      renderNotifications();
    });

    closeNotif?.addEventListener('click', () => {
      notifModal?.classList.add('hidden');
    });
    closeNotifBtn?.addEventListener('click', () => {
      notifModal?.classList.add('hidden');
    });
    notifModal?.addEventListener('click', e => {
      if (e.target.id === 'modal-notifications') e.target.classList.add('hidden');
    });

    clearNotifBtn?.addEventListener('click', async () => {
      if (!confirm('Xác nhận xóa toàn bộ truyền tin?')) return;
      try {
        await api.notifications.clearAll();
        toast('Đã dọn dẹp truyền tin!', 'success');
        renderNotifications();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Esc closes all modals
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      ['modal-auth','modal-create-sect','modal-post','modal-create-post',
       'modal-edit-sect','modal-invite','modal-settings','modal-channel',
       'modal-search-user', 'modal-notifications', 'modal-user-profile'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });
      document.getElementById('sticker-picker')?.classList.add('hidden');
    });

    // Voice 1-1 call button click
    document.getElementById('btn-voice-call')?.addEventListener('click', () => {
      if (!this._currentDmUserId) return;
      const targetName = document.getElementById('breadcrumb-page')?.textContent?.replace('💬 Đạo Hữu: ', '') || 'Đạo Hữu';
      
      const modal = document.getElementById('modal-outgoing-call');
      if (modal) {
        document.getElementById('outgoing-call-name').textContent = targetName;
        
        // Cập nhật avatar cho người gọi
        let avatarUrl = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        const dmItemAvatar = document.querySelector(`[data-uid="${this._currentDmUserId}"] img`);
        if (dmItemAvatar && dmItemAvatar.src) {
          avatarUrl = dmItemAvatar.src;
        }
        const avatarEl = document.getElementById('outgoing-call-avatar');
        if (avatarEl) avatarEl.src = avatarUrl;
        
        modal.classList.remove('hidden');
      }

      const s = getSocket();
      if(s) s.emit('voice:call_request', { targetUserId: String(this._currentDmUserId) });
    });

    document.getElementById('btn-cancel-call')?.addEventListener('click', () => {
      const s = getSocket();
      if(s) s.emit('voice:call_cancel', { targetUserId: String(this._currentDmUserId) });
      document.getElementById('modal-outgoing-call')?.classList.add('hidden');
    });
    
    document.getElementById('btn-reject-call')?.addEventListener('click', () => {
      const s = getSocket();
      if(s && this._incomingCallCallerId) s.emit('voice:call_reject', { targetUserId: String(this._incomingCallCallerId) });
      document.getElementById('modal-incoming-call')?.classList.add('hidden');
    });

    document.getElementById('btn-accept-call')?.addEventListener('click', () => {
      const s = getSocket();
      const callerId = String(this._incomingCallCallerId);
      if(s && callerId) {
        s.emit('voice:call_accept', { targetUserId: callerId });
        document.getElementById('modal-incoming-call')?.classList.add('hidden');
        
        const targetName = document.getElementById('incoming-call-name')?.textContent || 'Đạo Hữu';
        this.switchView('voice', {
          channel: `Đàm Đạo: ${targetName}`,
          channelId: `dm:${callerId}`,
          autoJoin: true
        });
      }
    });

    // Cultivator Profile modal close
    document.getElementById('close-user-profile')?.addEventListener('click', () => {
      document.getElementById('modal-user-profile')?.classList.add('hidden');
    });
    document.getElementById('modal-user-profile')?.addEventListener('click', e => {
      if (e.target.id === 'modal-user-profile') e.target.classList.add('hidden');
    });

    // Avatar Click Event Delegation
    document.addEventListener('click', e => {
      const memberItem = e.target.closest('.member-item');
      
      // Nếu click vào member item ở Trang Chủ (không phải click avatar) -> mở chat DM
      if (memberItem && !e.target.closest('.member-avatar-wrap') && !this._currentSect) {
        const uid = memberItem.dataset.uid;
        const name = memberItem.querySelector('.member-name')?.textContent;
        if (uid && name) {
          this.startDmChat(uid, name);
          return;
        }
      }

      const msgRow = e.target.closest('.msg-row');
      const searchItem = e.target.closest('.search-result-item');

      const isAvatarClick = e.target.closest('.msg-avatar') ||
                            e.target.closest('.member-avatar-wrap') ||
                            e.target.closest('.search-avatar') ||
                            e.target.classList.contains('card-author-avatar') ||
                            e.target.classList.contains('comment-avatar');

      if (!isAvatarClick) return;

      let userId = null;
      if (memberItem) {
        userId = memberItem.dataset.uid;
      } else if (msgRow) {
        userId = msgRow.dataset.userId;
      } else if (searchItem) {
        userId = searchItem.dataset.uid;
      }

      if (userId) {
        e.preventDefault();
        e.stopPropagation();
        this.openCultivatorProfile(userId);
      }
    });
  }

  /** Open channel modal in 'create' or 'edit' mode */
  _openChannelModal(mode, channel = null) {
    const modal     = document.getElementById('modal-channel');
    const form      = document.getElementById('form-channel');
    const titleEl   = document.getElementById('channel-modal-title');
    const iconEl    = document.getElementById('channel-modal-icon');
    const submitBtn = document.getElementById('channel-form-submit');
    const deleteWrap= document.getElementById('channel-modal-delete-wrap');
    const nameInput = document.getElementById('channel-name');
    const typeSelect= document.getElementById('channel-type');
    if (!modal || !form) return;

    if (mode === 'create') {
      form.dataset.editingId = '';
      titleEl.textContent = 'Tạo Kênh Mới';
      iconEl.textContent  = '#';
      submitBtn.textContent = 'Tạo Kênh ✨';
      if (nameInput) nameInput.value = '';
      if (typeSelect) typeSelect.value = 'text';
      if (deleteWrap) deleteWrap.style.display = 'none';
    } else {
      form.dataset.editingId = channel.id;
      titleEl.textContent = 'Chỉnh Sửa Kênh';
      iconEl.textContent  = channel.type === 'voice' ? '🔊' : channel.type === 'announcement' ? '📢' : '#';
      submitBtn.textContent = 'Lưu Thay Đổi ✅';
      if (nameInput) nameInput.value = channel.name;
      if (typeSelect) typeSelect.value = channel.type;
      if (deleteWrap) deleteWrap.style.display = '';
    }

    modal.classList.remove('hidden');
  }

  async loadNotificationsCount() {
    if (!this.userModel?.isLoggedIn) return;
    try {
      const { notifications } = await api.notifications.list();
      const unreadCount = notifications.filter(n => !n.is_read).length;
      this._updateNotifBadge(unreadCount, true);
    } catch { /* empty */ }
  }

  _updateNotifBadge(count, setDirectly = false) {
    const btn = document.getElementById('btn-notifications');
    if (!btn) return;
    let badge = btn.querySelector('.notif-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'notif-badge';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
    
    let current = setDirectly ? 0 : parseInt(badge.textContent || '0', 10);
    let newVal = current + count;
    if (newVal <= 0) {
      badge.remove();
    } else {
      badge.textContent = newVal > 99 ? '99+' : newVal;
    }
  }

  // ── Đồng Đạo Truyền Tin (DM) & Bảng Ngọc Đệ Tử ──────────────────

  async startDmChat(userId, username) {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return;
    }
    this._currentDmUserId = userId;
    
    // Ẩn bảng ngọc profile nếu đang mở
    document.getElementById('modal-user-profile')?.classList.add('hidden');
    
    // Đặt lại trạng thái tông môn về Trang Chủ/DM
    this._currentSect = null;
    this.sidebarView.setActive(null);

    // Chuyển view sang chat riêng
    this.switchView('chat', { channel: username, channelId: `dm:${userId}` });

    this.loadFriendsAndRecentDms();
    
    // Hiện nút gọi thoại 1-1 trên topbar
    const btnCall = document.getElementById('btn-voice-call');
    if (btnCall) btnCall.classList.remove('hidden');
    
    // Ẩn danh sách kênh tông môn, hiện danh sách cuộc trò chuyện DM
    document.getElementById('sect-channels-wrap')?.classList.add('hidden');
    document.getElementById('guest-channels')?.classList.remove('hidden');
    document.getElementById('dm-conversations')?.classList.remove('hidden');

    // Tắt focus bảng tin ở sidebar trái
    document.querySelectorAll('#channel-list .channel-item').forEach(el => el.classList.remove('active'));

    const channelTitle = document.getElementById('channel-panel-title');
    if (channelTitle) channelTitle.textContent = 'Trang Chủ';

    // Đảm bảo ở sidebar, các mục DM được render mới nhất
    await this.loadDmConversations();

    // Đồng bộ lại sidebar phải hiển thị đúng danh sách Bạn bè và DM gần đây
    await this.loadFriendsAndRecentDms();
  }

  async loadDmConversations() {
    if (!this.userModel?.isLoggedIn) return;
    this._dmQueryCounter = (this._dmQueryCounter || 0) + 1;
    const token = this._dmQueryCounter;
    try {
      const { conversations } = await api.dms.listRecent();
      if (this._dmQueryCounter !== token) return;
      const container = document.getElementById('dm-list-dynamic');
      if (!container) return;
      container.innerHTML = '';
      
      if (!conversations || conversations.length === 0) {
        container.innerHTML = `<div class="channel-empty-hint" style="padding:10px 15px; font-size:12px; color:var(--t-muted); text-align:center;">Chưa có truyền tin riêng</div>`;
        return;
      }
      
      conversations.forEach(c => {
        const isActive = this._currentView === 'chat' && this._chatCtrl?._currentChannelId === `dm:${c.id}`;
        const activeClass = isActive ? 'active' : '';
        const unreadHtml = c.unread_count > 0 
          ? `<span class="dm-unread-badge" style="background:var(--c-gold); color:#000; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:bold; margin-left:auto; box-shadow:0 0 8px var(--c-gold);">${c.unread_count}</span>` 
          : '';
          
        const avatarUrl = c.avatar || c.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        const statusClass = c.status === 'online' ? 'online' : 'offline';
        
        container.innerHTML += `
          <div class="channel-item dm-item ${activeClass}" data-uid="${c.id}" data-username="${c.name}" role="button" tabindex="0" style="display:flex; align-items:center; gap:8px; padding:6px 12px; margin:2px 0; border-radius:4px; cursor:pointer;">
            <div class="user-avatar-wrap" style="position:relative; width:24px; height:24px; flex-shrink:0;">
              <img src="${avatarUrl}" class="user-avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />
              <div class="status-dot ${statusClass}" style="position:absolute; bottom:-2px; right:-2px; width:8px; height:8px; border:1px solid #1a1040; border-radius:50%;"></div>
            </div>
            <div style="display:flex; flex-direction:column; overflow:hidden; flex:1;">
              <span class="channel-name-text" style="font-size:13px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.name}</span>
              <span style="font-size:10px; color:var(--t-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${c.realm || 'Luyện Khí Kỳ'}</span>
            </div>
            ${unreadHtml}
          </div>
        `;
      });
      
      // Lắng nghe sự kiện click trên các DM item để chuyển sang chat riêng
      container.querySelectorAll('.dm-item').forEach(item => {
        item.addEventListener('click', () => {
          const uid = item.dataset.uid;
          const uname = item.dataset.username;
          this.startDmChat(uid, uname);
        });
      });
    } catch (err) {
      console.error('Không tải được danh sách hội thoại DM:', err);
    }
  }

  async openCultivatorProfile(userId) {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return;
    }
    
    try {
      toast('Đang dò la tu vi...', 'info');
      const { user } = await api.auth.getUser(userId);
      if (!user) throw new Error('Không tìm thấy đạo hữu');
      
      const blockData = await api.blocks.list();
      const blocks = blockData.blocks ?? [];
      const isBlocked = blocks.some(b => String(b.blocked_id) === String(userId));
      
      const modal = document.getElementById('modal-user-profile');
      const avatarEl = document.getElementById('user-profile-avatar');
      const nameEl = document.getElementById('user-profile-name');
      const realmEl = document.getElementById('user-profile-realm');
      const emailEl = document.getElementById('user-profile-email');
      const genderEl = document.getElementById('user-profile-gender');
      const expBarEl = document.getElementById('user-profile-exp-bar');
      const expTextEl = document.getElementById('user-profile-exp-text');
      const btnDm = document.getElementById('btn-profile-dm');
      const btnBlock = document.getElementById('btn-profile-block');
      const btnFriend = document.getElementById('btn-profile-friend');
      
      if (!modal || !avatarEl || !nameEl || !realmEl || !emailEl || !expBarEl || !expTextEl || !btnDm || !btnBlock || !btnFriend) return;
      
      // Kiểm tra trạng thái kết bạn
      let isFriend = false;
      try {
        const friendCheck = await api.friends.check(userId);
        isFriend = friendCheck.isFriend;
      } catch (err) {
        console.error('Lỗi check bạn bè:', err);
      }

      const avatarUrl = user.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
      avatarEl.src = avatarUrl;
      nameEl.textContent = user.name;
      realmEl.textContent = `Cảnh Giới: ${user.realm || 'Luyện Khí Kỳ'}`;
      
      if (genderEl) {
        const genderMap = { 'nam': 'Nam', 'nu': 'Nữ', 'kho_noi': 'Khó Nói' };
        genderEl.textContent = genderMap[user.gender] || 'Khó Nói';
      }

      // Nếu là người dùng khác, email đã bị backend lọc.
      emailEl.textContent = user.email || '***@tiengioi.vn';
      
      const exp = user.exp ?? 0;
      const maxExp = user.maxExp ?? 10000;
      const expPercent = Math.min((exp / maxExp) * 100, 100);
      expBarEl.style.width = `${expPercent}%`;
      expTextEl.textContent = `${exp.toLocaleString()} / ${maxExp.toLocaleString()} Linh Khí`;
      
      // Nút bấm
      if (String(userId) === String(this.userModel.data?.id)) {
        btnDm.style.display = 'none';
        btnBlock.style.display = 'none';
        btnFriend.style.display = 'none';
      } else {
        btnDm.style.display = '';
        btnBlock.style.display = '';
        btnFriend.style.display = '';
        
        // Friend click
        btnFriend.replaceWith(btnFriend.cloneNode(true)); // clear listeners
        const newBtnFriend = document.getElementById('btn-profile-friend');
        if (isFriend) {
          newBtnFriend.textContent = '🙌 Hủy Kết Bạn';
          newBtnFriend.className = 'btn-profile-action unfriend';
          newBtnFriend.addEventListener('click', async () => {
            try {
              await api.friends.remove(userId);
              toast(`Đã cắt đứt nhân duyên kết giao với ${user.name}!`, 'success');
              document.getElementById('modal-user-profile')?.classList.add('hidden');
              this.loadFriendsAndRecentDms();
            } catch (err) {
              toast(err.message, 'error');
            }
          });
        } else {
          newBtnFriend.textContent = '🤝 Kết Bạn';
          newBtnFriend.className = 'btn-profile-action friend';
          newBtnFriend.addEventListener('click', async () => {
            try {
              await api.friends.add(userId);
              toast(`Đã kết giao đồng đạo với ${user.name}! 🎉`, 'success');
              document.getElementById('modal-user-profile')?.classList.add('hidden');
              this.loadFriendsAndRecentDms();
            } catch (err) {
              toast(err.message, 'error');
            }
          });
        }
        
        // DM click
        btnDm.replaceWith(btnDm.cloneNode(true)); // clear listeners
        const newBtnDm = document.getElementById('btn-profile-dm');
        newBtnDm.addEventListener('click', () => {
          this.startDmChat(user.id, user.name);
        });
        
        // Block click
        btnBlock.replaceWith(btnBlock.cloneNode(true)); // clear listeners
        const newBtnBlock = document.getElementById('btn-profile-block');
        if (isBlocked) {
          newBtnBlock.textContent = '🔓 Hủy Chặn';
          newBtnBlock.style.background = 'rgba(74,222,128,0.2)';
          newBtnBlock.style.borderColor = 'rgba(74,222,128,0.4)';
          newBtnBlock.style.color = '#4ade80';
          newBtnBlock.addEventListener('click', async () => {
            try {
              await api.blocks.unblock(userId);
              toast(`Đã hóa giải trận pháp bế quan với ${user.name}! ✨`, 'success');
              this.openCultivatorProfile(userId); // refresh profile view
            } catch (err) {
              toast(err.message, 'error');
            }
          });
        } else {
          newBtnBlock.textContent = '🚫 Chặn Đồng Đạo';
          newBtnBlock.style.background = 'rgba(224,92,92,0.2)';
          newBtnBlock.style.borderColor = 'rgba(224,92,92,0.4)';
          newBtnBlock.style.color = '#e05c5c';
          newBtnBlock.addEventListener('click', async () => {
            if (!confirm(`Xác nhận chặn đồng đạo ${user.name}? Hai bên sẽ không thể truyền tin hay đàm thoại.`)) return;
            try {
              await api.blocks.block(userId);
              toast(`Đã lập trận pháp bế quan, chặn ${user.name}! 🚫`, 'success');
              this.openCultivatorProfile(userId); // refresh profile view
            } catch (err) {
              toast(err.message, 'error');
            }
          });
        }
      }
      
      modal.classList.remove('hidden');
    } catch (err) {
      toast(err.message, 'error');
    }
  }
}
