/**
 * views/VoiceView.js
 * Renders the "Linh Âm Đại Điện" voice room interface.
 */

export class VoiceView {
  constructor() {
    this.placeholderEl    = document.getElementById('voice-placeholder');
    this.placeholderDescEl= document.getElementById('voice-placeholder-desc');
    this.btnJoinEl        = document.getElementById('voice-btn-join');
    this.activeRoomEl     = document.getElementById('voice-active-room');
    this.activeTitleEl    = document.getElementById('voice-active-title');
    this.gridEl           = document.getElementById('voice-participant-grid');
    this.btnMuteEl        = document.getElementById('voice-btn-mute');
    this.btnLeaveEl        = document.getElementById('voice-btn-leave');
  }

  show() {
    document.getElementById('view-voice')?.classList.add('active');
  }

  renderPlaceholder(channelName, isConnecting = false) {
    if (this.placeholderEl) this.placeholderEl.classList.remove('hidden');
    if (this.activeRoomEl) this.activeRoomEl.classList.add('hidden');

    if (this.placeholderDescEl) {
      this.placeholderDescEl.textContent = `Trận pháp thoại [🔊 ${channelName}] đã sẵn sàng. Hãy gia nhập để cùng đàm đạo!`;
    }

    if (this.btnJoinEl) {
      if (isConnecting) {
        this.btnJoinEl.disabled = true;
        this.btnJoinEl.textContent = 'Đang Kích Hoạt Trận Pháp... ⚡';
      } else {
        this.btnJoinEl.disabled = false;
        this.btnJoinEl.textContent = 'Khởi Kích Trận Pháp ⚡';
      }
    }
  }

  renderActiveRoom(channelName, users, localSocketId, localUser, localMicEnabled) {
    if (this.placeholderEl) this.placeholderEl.classList.add('hidden');
    if (this.activeRoomEl) this.activeRoomEl.classList.remove('hidden');

    if (this.activeTitleEl) {
      this.activeTitleEl.innerHTML = `🔊 Linh Âm Đại Điện <span style="font-size:14px;color:var(--t-secondary);font-weight:400;margin-left:8px;">— Kênh: ${channelName}</span>`;
    }

    if (this.gridEl) {
      this.gridEl.innerHTML = '';

      // 1. Add Local User Card
      const localCardHtml = this._createCardHtml({
        socketId: localSocketId,
        name: localUser.name + ' (Bạn)',
        avatar: localUser.avatar_url || '',
        realm: localUser.realm || 'Luyện Khí Kỳ',
        realmCss: localUser.realmCss || 'realm-1',
        micEnabled: localMicEnabled,
        isLocal: true
      });
      this.gridEl.insertAdjacentHTML('beforeend', localCardHtml);

      // 2. Add Remote User Cards
      users.forEach(u => {
        const cardHtml = this._createCardHtml({
          socketId: u.socketId,
          name: u.name,
          avatar: u.avatar,
          realm: u.realm,
          realmCss: u.realmCss,
          micEnabled: u.micEnabled,
          isLocal: false
        });
        this.gridEl.insertAdjacentHTML('beforeend', cardHtml);
      });
    }
  }

  updateMicStatus(socketId, enabled) {
    const card = document.getElementById(`voice-card-${socketId}`);
    if (!card) return;

    const micBadge = card.querySelector('.voice-mic-badge');
    if (micBadge) {
      if (enabled) {
        micBadge.className = 'voice-mic-badge active';
        micBadge.textContent = '🎙️';
        micBadge.setAttribute('title', 'Đang truyền âm');
      } else {
        micBadge.className = 'voice-mic-badge muted';
        micBadge.textContent = '🔇';
        micBadge.setAttribute('title', 'Bế quan tĩnh âm');
      }
    }
  }

  updateSpeakingStatus(socketId, isSpeaking) {
    const card = document.getElementById(`voice-card-${socketId}`);
    if (!card) return;

    card.classList.toggle('speaking', isSpeaking);
  }

  removeMemberCard(socketId) {
    const card = document.getElementById(`voice-card-${socketId}`);
    card?.remove();
  }

  addMemberCard(user) {
    if (!this.gridEl) return;
    const existing = document.getElementById(`voice-card-${user.socketId}`);
    if (existing) return;

    const cardHtml = this._createCardHtml({
      socketId: user.socketId,
      name: user.name,
      avatar: user.avatar,
      realm: user.realm,
      realmCss: user.realmCss,
      micEnabled: user.micEnabled,
      isLocal: false
    });
    this.gridEl.insertAdjacentHTML('beforeend', cardHtml);
  }

  _createCardHtml({ socketId, name, avatar, realm, realmCss, micEnabled, isLocal }) {
    const micClass = micEnabled ? 'active' : 'muted';
    const micIcon = micEnabled ? '🎙️' : '🔇';
    const micTitle = micEnabled ? 'Đang truyền âm' : 'Bế quan tĩnh âm';

    // Avatar preview
    const cleanAvatar = avatar 
      ? (avatar.startsWith('http') ? avatar : `http://localhost:3000${avatar}`)
      : '';
    const avatarHtml = cleanAvatar
      ? `<img src="${cleanAvatar}" alt="${name}" class="voice-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
         <div class="voice-avatar text-avatar" style="display:none; width:72px; height:72px; border-radius:50%; background:var(--c-active); align-items:center; justify-content:center; font-family:'Noto Serif SC', serif; font-size:24px; color:var(--c-gold); font-weight:700;">${name.substring(0, 1).toUpperCase()}</div>`
      : `<div class="voice-avatar text-avatar" style="display:flex; width:72px; height:72px; border-radius:50%; background:var(--c-active); align-items:center; justify-content:center; font-family:'Noto Serif SC', serif; font-size:24px; color:var(--c-gold); font-weight:700;">${name.substring(0, 1).toUpperCase()}</div>`;

    return `
      <div class="voice-member-card" id="voice-card-${socketId}" data-socket-id="${socketId}">
        <div class="voice-avatar-wrap">
          ${avatarHtml}
          <div class="voice-mic-badge ${micClass}" title="${micTitle}">${micIcon}</div>
        </div>
        <div class="voice-member-name" title="${name}">${name}</div>
        <span class="voice-member-realm ${realmCss || 'realm-1'}">${realm || 'Luyện Khí Kỳ'}</span>
        
        <!-- Speaking waves -->
        <div class="voice-wave-bg">
          <div class="voice-wave-bar"></div>
          <div class="voice-wave-bar"></div>
          <div class="voice-wave-bar"></div>
          <div class="voice-wave-bar"></div>
          <div class="voice-wave-bar"></div>
        </div>
      </div>
    `;
  }
}
