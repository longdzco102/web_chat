/**
 * views/SidebarView.js – Sect icons sidebar
 * Supports server data and onSectClick callback.
 */
import { escHtml } from '../utils/helpers.js';

export class SidebarView {
  constructor() {
    this.sectList = document.getElementById('sect-list');
    this.onSectClick = null; // set by AppController
  }

  show() { this.sectList?.classList.remove('hidden'); }
  hide() { this.sectList?.classList.add('hidden'); }

  /** Render from server sect list */
  renderFromServer(sects) {
    if (!this.sectList) return;
    this.sectList.innerHTML = sects.map(s => `
      <div class="sect-icon ${s.isOwner ? 'sect-owner' : ''}"
           data-id="${s.id}"
           title="${escHtml(s.name)}${s.isOwner ? ' (Tông Chủ)' : ''}"
           role="button" tabindex="0" aria-label="${escHtml(s.name)}">
        ${s.icon ?? '🐉'}
        <div class="sidebar-tooltip">${escHtml(s.name)}${s.isOwner ? ' 👑' : ''}</div>
      </div>`
    ).join('');

    this.sectList.querySelectorAll('.sect-icon').forEach(el => {
      el.addEventListener('click', () => {
        this.setActive(el.dataset.id);
        this.onSectClick?.(el.dataset.id);
      });
    });
  }

  setActive(id) {
    this.sectList?.querySelectorAll('.sect-icon').forEach(el => {
      el.classList.toggle('active', el.dataset.id === String(id));
    });
  }
}
