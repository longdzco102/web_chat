/**
 * views/MemberView.js – Renders member list in col 4
 * Supports both mock data and live server member list.
 */
import { escHtml } from '../utils/helpers.js';


const GROUP_LABELS = {
  tong_chu:   'Tông Chủ',
  truong_lao: 'Trưởng Lão',
  de_tu:      'Đệ Tử',
};

export class MemberView {
  constructor() {
    this.list = document.getElementById('member-list');
  }


  /** Render from server member list (array of { id, name, avatar, realm, status, role }) */
  renderFromServer(members) {
    const groups = {
      tong_chu:   members.filter(m => m.role === 'tong_chu'),
      truong_lao: members.filter(m => m.role === 'truong_lao'),
      de_tu:      members.filter(m => m.role === 'de_tu'),
    };
    const html = Object.entries(groups).map(([key, list]) => {
      if (!list.length) return '';
      const items = list.map(m => this._memberHTML(m)).join('');
      return `<div class="member-group-label">${GROUP_LABELS[key]} — ${list.length}</div>${items}`;
    }).join('');
    this.list.innerHTML = html || '<div class="member-group-label">Chưa có thành viên</div>';
  }

  /** Render friends list and recent DM conversations when at Home page */
  renderFriendsAndRecentDms(friends, recentDms) {
    const friendIds = new Set(friends.map(f => String(f.id)));
    
    // Group 1: Bạn bè (Đã kết bạn)
    const friendItems = friends.map(f => {
      const avatarUrl = f.avatar_url?.startsWith('http') ? f.avatar_url 
        : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
      const avatarHtml = `<img src="${escHtml(avatarUrl)}" alt="${escHtml(f.name)}" class="member-avatar-img" loading="lazy" />`;
        
      return `
        <div class="member-item friend-item ${f.status === 'offline' ? 'offline' : ''}"
             role="listitem" tabindex="0" aria-label="${escHtml(f.name)}"
             data-uid="${f.id}">
          <div class="member-avatar-wrap">
            <div class="member-avatar">${avatarHtml}</div>
            <div class="member-status ${f.status ?? 'offline'}"></div>
          </div>
          <div class="member-info">
            <div class="member-name">${escHtml(f.name)}</div>
            <div class="member-realm-badge" style="display:flex; justify-content:space-between; align-items:center;">
              <span>${f.realm ?? 'Luyện Khí Kỳ'}</span>
              <span class="friend-badge" style="background:rgba(45,212,191,0.15); color:#2dd4bf; border:1px solid rgba(45,212,191,0.3); border-radius:4px; padding:1px 4px; font-size:9px; font-weight:bold;">Đã kết bạn</span>
            </div>
          </div>
        </div>`;
    }).join('');
    
    // Group 2: Truyền tin gần đây (Lọc bỏ bạn bè để không bị trùng lặp)
    const nonFriendDms = recentDms.filter(d => !friendIds.has(String(d.id)));
    
    const dmItems = nonFriendDms.map(d => {
      const avatarUrl = d.avatar_url?.startsWith('http') ? d.avatar_url
        : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
      const avatarHtml = `<img src="${escHtml(avatarUrl)}" alt="${escHtml(d.name)}" class="member-avatar-img" loading="lazy" />`;
        
      return `
        <div class="member-item dm-conversation-item ${d.status === 'offline' ? 'offline' : ''}"
             role="listitem" tabindex="0" aria-label="${escHtml(d.name)}"
             data-uid="${d.id}" data-username="${escHtml(d.name)}">
          <div class="member-avatar-wrap">
            <div class="member-avatar">${avatarHtml}</div>
            <div class="member-status ${d.status ?? 'offline'}"></div>
          </div>
          <div class="member-info">
            <div class="member-name">${escHtml(d.name)}</div>
            <div class="member-realm-badge">${d.realm ?? 'Luyện Khí Kỳ'}</div>
          </div>
        </div>`;
    }).join('');
    
    let html = '';
    if (friends.length > 0) {
      html += `<div class="member-group-label">🤝 ĐỒNG ĐẠO BẠN BÈ — ${friends.length}</div>${friendItems}`;
    } else {
      html += `<div class="member-group-label">🤝 ĐỒNG ĐẠO BẠN BÈ</div><div class="member-empty-hint" style="padding:12px; font-size:12px; color:var(--t-muted); text-align:center;">Chưa kết kết giao đồng đạo nào</div>`;
    }
    
    if (nonFriendDms.length > 0) {
      html += `<div class="member-group-label">💬 TRUYỀN TIN GẦN ĐÂY — ${nonFriendDms.length}</div>${dmItems}`;
    }
    
    this.list.innerHTML = html;
  }

  /** Update a single member's status dot in place */
  setUserStatus(userId, status) {
    const item = this.list.querySelector(`[data-uid="${userId}"]`);
    if (!item) return;
    const dot = item.querySelector('.member-status');
    if (dot) dot.className = `member-status ${status}`;
    item.classList.toggle('offline', status === 'offline');
  }

  filterByName(query) {
    const q = query.toLowerCase();
    this.list.querySelectorAll('.member-item').forEach(el => {
      const name = el.querySelector('.member-name')?.textContent?.toLowerCase() ?? '';
      el.style.display = name.includes(q) ? '' : 'none';
    });
  }

  _memberHTML(m) {
    const avatarUrl = m.avatar_url?.startsWith('http') ? m.avatar_url
      : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    const avatarHtml = `<img src="${escHtml(avatarUrl)}" alt="${escHtml(m.name)}" class="member-avatar-img" loading="lazy" />`;

    return `
      <div class="member-item ${m.status === 'offline' ? 'offline' : ''}"
           role="listitem" tabindex="0" aria-label="${escHtml(m.name)}"
           data-uid="${m.id}">
        <div class="member-avatar-wrap">
          <div class="member-avatar">${avatarHtml}</div>
          <div class="member-status ${m.status ?? 'offline'}"></div>
        </div>
        <div class="member-info">
          <div class="member-name">${escHtml(m.name)}</div>
          <div class="member-realm-badge">${m.realm ?? ''}</div>
        </div>
      </div>`;
  }
}
