/**
 * views/BlogView.js – Renders blog posts from API data
 * Shows empty state when no posts exist.
 */
import { escHtml } from '../utils/helpers.js';

const TAG_LABELS = {
  'tu-luyen':  '📖 Tu Luyện',
  'chien-dau': '⚔️ Chiến Đấu',
  'bao-vat':   '💎 Bảo Vật',
  'tong-mon':  '🏯 Tông Môn',
  'truy-tim':  '🔍 Truy Tầm',
};

export class BlogView {
  constructor() {
    this.grid = document.getElementById('blog-grid');
    this._particlesEl = document.getElementById('hero-particles');
  }

  _renderAvatar(avatar) {
    if (!avatar) return '🌟';
    if (avatar.startsWith('http')) {
      return `<img src="${escHtml(avatar)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; display:block;" alt="avatar" />`;
    }
    return escHtml(avatar);
  }

  /** Render posts array (from API) */
  render(posts) {
    if (!this.grid) return;

    if (!posts || posts.length === 0) {
      this.grid.innerHTML = `
        <div class="blog-empty-state">
          <div class="empty-icon">📜</div>
          <h3>Chưa có bài viết nào</h3>
          <p>Hãy là người đầu tiên đăng bài trên Bảng Cáo Thị!</p>
        </div>`;
      return;
    }

    this.grid.innerHTML = posts.map(post => `
      <article class="blog-card" data-post-id="${post.id}" role="button" tabindex="0">
        ${post.cover_url
          ? `<div class="card-cover" style="background-image:url(${escHtml(post.cover_url)})"></div>`
          : `<div class="card-cover card-cover-gradient">
               <span class="card-cover-icon">${post.icon ?? '📖'}</span>
             </div>`
        }
        <div class="card-body">
          <span class="card-tag tag-${post.tag}">${TAG_LABELS[post.tag] ?? post.tag}</span>
          <h3 class="card-title">${escHtml(post.title)}</h3>
          <p class="card-excerpt">${escHtml(post.excerpt ?? post.content?.slice(0, 120) ?? '')}</p>
          <div class="card-meta">
            <div class="card-author">
              <span class="card-author-avatar" style="display:inline-block; width:24px; height:24px; border-radius:50%; vertical-align:middle; overflow:hidden;">${this._renderAvatar(post.author_avatar)}</span>
              <span class="card-author-name" style="vertical-align:middle;">${escHtml(post.author_name ?? 'Vô Danh')}</span>
              <span class="card-author-realm">${escHtml(post.author_realm ?? '')}</span>
            </div>
            <div class="card-stats">
              <span>👁 ${post.views ?? 0}</span>
              <span>❤ ${post.likes ?? 0}</span>
              <span>💬 ${post.comment_count ?? 0}</span>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  }

  /** Render post detail inside modal */
  renderPostDetail(post, comments) {
    const el = document.getElementById('modal-post-content');
    if (!el) return;

    el.innerHTML = `
      <div class="post-detail-header">
        <span class="card-tag tag-${post.tag}">${TAG_LABELS[post.tag] ?? post.tag}</span>
        <h2>${escHtml(post.title)}</h2>
        <div class="post-detail-meta">
          <span style="display:inline-block; width:24px; height:24px; border-radius:50%; margin-right:8px; vertical-align:middle; overflow:hidden;">${this._renderAvatar(post.author_avatar)}</span>
          <span class="post-detail-author" style="vertical-align:middle;">${escHtml(post.author_name ?? 'Vô Danh')}</span>
          <span class="post-detail-realm">${escHtml(post.author_realm ?? '')}</span>
          <span class="post-detail-time">${new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
        </div>
      </div>
      <div class="post-detail-body">${escHtml(post.content).replace(/\n/g, '<br>')}</div>
      <div class="post-detail-actions">
        <button id="btn-post-like" class="post-action-btn">❤ ${post.likes ?? 0}</button>
        <span>👁 ${post.views ?? 0}</span>
      </div>`;

    // Comments
    const commentsList = document.getElementById('post-comments-list');
    if (commentsList) {
      if (!comments || comments.length === 0) {
        commentsList.innerHTML = '<p class="comments-empty">Chưa có bình luận nào</p>';
      } else {
        commentsList.innerHTML = comments.map(c => `
          <div class="comment-item">
            <span class="comment-avatar" style="display:inline-block; width:32px; height:32px; border-radius:50%; overflow:hidden; flex-shrink:0;">${this._renderAvatar(c.avatar)}</span>
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-name">${escHtml(c.name ?? 'Vô Danh')}</span>
                <span class="comment-realm">${escHtml(c.realm ?? '')}</span>
                <span class="comment-time">${new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <p class="comment-text">${escHtml(c.content)}</p>
            </div>
          </div>`).join('');
      }
    }
  }

  createParticles() {
    if (!this._particlesEl) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left   = Math.random() * 100 + '%';
      p.style.top    = Math.random() * 100 + '%';
      p.style.animationDelay    = Math.random() * 6 + 's';
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      p.textContent = ['✦','✧','⚡','🌟','💫'][Math.floor(Math.random() * 5)];
      this._particlesEl.appendChild(p);
    }
  }
}
