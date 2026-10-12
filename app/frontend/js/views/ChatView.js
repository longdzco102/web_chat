/**
 * views/ChatView.js – Text + sticker messages, realm color badges, system messages
 */
import { escHtml, timeStr } from '../utils/helpers.js';

// Realm CSS classes → display label
const REALM_LABELS = {
  'luyen-khi':  '[Luyện Khí]',
  'truc-co':    '[Trúc Cơ]',
  'kim-dan':    '[Kim Đan]',
  'nguyen-anh': '[Nguyên Anh]',
  'hoa-than':   '[Hóa Thần]',
  'luyen-hu':   '[Luyện Hư]',
  'hop-the':    '[Hợp Thể]',
  'dai-thua':   '[Đại Thừa]',
  'do-kiep':    '[Độ Kiếp]',
};

const ROLE_BADGE = {
  tong_chu:   { cls: 'role-tong-chu',   label: '👑 Tông Chủ' },
  truong_lao: { cls: 'role-truong-lao', label: '🏯 Trưởng Lão' },
};

export class ChatView {
  constructor() {
    this.container  = document.getElementById('chat-messages');
    this.typing     = document.getElementById('typing-indicator');
    this.typingText = document.getElementById('typing-text');
    this.input      = document.getElementById('message-input');
  }

  render(messages, selfId = null) {
    if (!this.container) return;

    if (!messages || messages.length === 0) {
      this.container.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <p>Chưa có tin nhắn nào. Hãy là người mở lời đầu tiên!</p>
        </div>`;
      return;
    }

    let prevUser = null;
    let prevDateStr = null;
    const frag   = document.createDocumentFragment();

    messages.forEach(msg => {
      const uid      = String(msg.user_id ?? msg.userId ?? '');
      const name     = msg.name    ?? 'Vô Danh';
      const avatarRaw = msg.avatar ?? '';
      const realmCss = msg.realm_css ?? msg.realmCss ?? 'luyen-khi';
      const sectRole = msg.sect_role ?? msg.role ?? 'de_tu';
      const msgType  = msg.type    ?? 'text';
      const content  = msg.content ?? msg.text ?? '';
      const ts       = msg.ts ? new Date(msg.ts) : new Date();

      const dateStr = ts.toLocaleDateString('vi-VN', { weekday:'long', day:'numeric', month:'long' });
      if (dateStr !== prevDateStr) {
        const sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.textContent = dateStr;
        frag.appendChild(sep);
        prevDateStr = dateStr;
        prevUser = null; // Reset prevUser to ensure avatar/name shows for first message of new day
      }

      // Render avatar: URL → <img>, otherwise gravatar fallback
      const avatarHtml = (avatarRaw && (avatarRaw.startsWith('http') || avatarRaw.startsWith('/')))
        ? `<img src="${escHtml(avatarRaw)}" alt="${escHtml(name)}" class="avatar-img" loading="lazy" />`
        : `<img src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y" alt="${escHtml(name)}" class="avatar-img" loading="lazy" />`;

      // System messages get special treatment
      if (msgType === 'system') {
        const sys = document.createElement('div');
        sys.className = 'msg-system';
        sys.innerHTML = `<span>${content}</span><span class="msg-system-time">${timeStr(ts)}</span>`;
        frag.appendChild(sys);
        return;
      }

      // Compare as strings – TiDB returns BigInt IDs as strings
      const isSelf      = selfId != null && uid !== '' && uid === String(selfId);
      const isContinued = prevUser === uid;
      const roleBadge   = ROLE_BADGE[sectRole];
      const realmLabel  = REALM_LABELS[realmCss] ?? '[Luyện Khí]';

      // Build content: sticker or text or file/image/voice
      let contentHtml = '';
      if (msgType === 'sticker') {
        contentHtml = `<img src="/stickers/${escHtml(content)}" class="sticker-msg" alt="sticker" loading="lazy" />`;
      } else if (msgType === 'image' && msg.file_url) {
        contentHtml = `
          <div class="msg-bubble has-image">
            ${content !== msg.file_name && content ? `<div class="msg-text">${escHtml(content)}</div>` : ''}
            <img src="${escHtml(msg.file_url)}" class="chat-img-attachment" alt="image" loading="lazy" onclick="window.open(this.src, '_blank')" />
          </div>`;
      } else if (msgType === 'voice' && msg.file_url) {
        contentHtml = `
          <div class="msg-bubble has-audio">
            ${content !== msg.file_name && content ? `<div class="msg-text">${escHtml(content)}</div>` : ''}
            <audio controls src="${escHtml(msg.file_url)}" class="chat-audio-attachment"></audio>
          </div>`;
      } else if (msgType === 'file' && msg.file_url) {
        contentHtml = `
          <div class="msg-bubble has-file">
            ${content !== msg.file_name && content ? `<div class="msg-text">${escHtml(content)}</div>` : ''}
            <a href="${escHtml(msg.file_url)}" download="${escHtml(msg.file_name)}" target="_blank" class="chat-file-attachment">
              <span class="file-icon">📎</span>
              <span class="file-name">${escHtml(msg.file_name || 'File đính kèm')}</span>
            </a>
          </div>`;
      } else {
        contentHtml = `<div class="msg-bubble">${escHtml(content)}</div>`;
      }

      const reactions = (msg.reactions ?? []).map(r =>
        `<span class="reaction-chip" data-emoji="${r.e ?? r.emoji ?? ''}">
           <span>${r.e ?? r.emoji ?? ''}</span>
           <span class="reaction-count">${r.n ?? r.count ?? 1}</span>
         </span>`
      ).join('');

      const el = document.createElement('div');
      el.className = [
        'msg-row',
        isSelf      ? 'is-self'      : '',
        isContinued ? 'is-continued' : '',
        msgType === 'sticker' ? 'is-sticker' : '',
      ].filter(Boolean).join(' ');
      el.dataset.msgId = msg.id ?? '';
      el.dataset.userId = uid;

      el.innerHTML = `
        <div class="msg-avatar" title="${escHtml(name)}">${avatarHtml}</div>
        <div class="msg-content">
          ${!isContinued ? `
          <div class="msg-header">
            ${roleBadge ? `<span class="msg-role-badge ${roleBadge.cls}">${roleBadge.label}</span>` : ''}
            <span class="msg-realm-tag realm-${realmCss}">${realmLabel}</span>
            <span class="msg-name realm-name-${realmCss}">${escHtml(name)}</span>
            <span class="msg-time">${timeStr(ts)}</span>
          </div>` : ''}
          ${contentHtml}
          ${reactions ? `<div class="msg-reactions">${reactions}</div>` : ''}
        </div>`;

      frag.appendChild(el);
      prevUser = uid;
    });

    this.container.innerHTML = '';
    this.container.appendChild(frag);

    this.container.querySelectorAll('.reaction-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('reacted'));
    });

    this.scrollToBottom();
  }

  /** Show a world/system message inline in chat */
  showSystemMessage(text) {
    if (!this.container) return;
    const el = document.createElement('div');
    el.className = 'msg-system';
    el.textContent = text;
    this.container.appendChild(el);
    this.scrollToBottom();
  }

  showTyping(name) {
    if (this.typingText) this.typingText.textContent = `${name} đang nhập...`;
    this.typing?.classList.remove('hidden');
  }
  hideTyping() { this.typing?.classList.add('hidden'); }

  clearInput() {
    if (!this.input) return;
    this.input.value = '';
    this.input.style.height = 'auto';
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      if (this.container) this.container.scrollTop = this.container.scrollHeight;
    });
  }
}
