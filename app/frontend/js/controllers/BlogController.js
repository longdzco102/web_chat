/**
 * controllers/BlogController.js
 * Posts are user-created, fetched from API.
 * No hardcoded/mock posts.
 */
import { toast } from '../utils/toast.js';
import api       from '../utils/api.js';

export class BlogController {
  constructor({ blogView, userModel }) {
    this.blogView  = blogView;
    this.userModel = userModel;
    this._posts    = [];
    this._filter   = 'all';
    this._bindUI();
    this._loadPosts(); // fetch on boot
  }

  async _loadPosts() {
    try {
      const params = this._filter !== 'all' ? `?tag=${this._filter}` : '';
      const data = await api.posts.list(params);
      this._posts = data.posts ?? [];
    } catch {
      // API down or first time → empty
      this._posts = [];
    }
    this.blogView.render(this._posts);
  }

  _bindUI() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._filter = btn.dataset.filter;
        this._loadPosts();
      });
    });

    // Blog grid click → open post detail
    document.getElementById('blog-grid')?.addEventListener('click', e => {
      const card = e.target.closest('.blog-card');
      if (!card) return;
      const id = card.dataset.postId;
      if (id) this._openPost(id);
    });

    // Create post button (in hero)
    document.getElementById('btn-hero-create-post')?.addEventListener('click', () => {
      if (!this.userModel.isLoggedIn) {
        document.getElementById('modal-auth')?.classList.remove('hidden');
        return;
      }
      document.getElementById('modal-create-post')?.classList.remove('hidden');
    });

    // Submit create post form
    document.getElementById('form-create-post')?.addEventListener('submit', async e => {
      e.preventDefault();
      if (!this.userModel.isLoggedIn) {
        toast('Hãy đăng nhập trước!', 'error');
        return;
      }

      const title   = document.getElementById('post-title')?.value.trim();
      const content = document.getElementById('post-content')?.value.trim();
      const tag     = document.getElementById('post-tag')?.value || 'tu-luyen';

      if (!title || !content) { toast('Hãy điền tiêu đề và nội dung!', 'error'); return; }
      if (content.length < 10) { toast('Nội dung phải ít nhất 10 ký tự!', 'error'); return; }

      try {
        await api.posts.create({ title, content, tag });
        toast('Đã đăng bài thành công! ✨', 'success');
        document.getElementById('modal-create-post')?.classList.add('hidden');
        document.getElementById('form-create-post')?.reset();
        this._loadPosts(); // refresh
      } catch (err) {
        toast(err.message || 'Đăng bài thất bại', 'error');
      }
    });

    // Close create post modal
    document.getElementById('close-create-post')?.addEventListener('click', () => {
      document.getElementById('modal-create-post')?.classList.add('hidden');
    });
    document.getElementById('modal-create-post')?.addEventListener('click', e => {
      if (e.target.id === 'modal-create-post') e.target.classList.add('hidden');
    });

    // Close post detail modal
    document.getElementById('close-post-modal')?.addEventListener('click', () => {
      document.getElementById('modal-post')?.classList.add('hidden');
    });
    document.getElementById('modal-post')?.addEventListener('click', e => {
      if (e.target.id === 'modal-post') e.target.classList.add('hidden');
    });

    // Like in post detail
    document.getElementById('btn-post-like')?.addEventListener('click', async () => {
      const id = this._currentPostId;
      if (!id || !this.userModel.isLoggedIn) return;
      try {
        await api.posts.like(id);
        this._openPost(id); // refresh detail
      } catch (err) {
        toast(err.message || 'Lỗi', 'error');
      }
    });

    // Comment submit
    document.getElementById('btn-comment-submit')?.addEventListener('click', async () => {
      const id = this._currentPostId;
      if (!id || !this.userModel.isLoggedIn) {
        toast('Hãy đăng nhập để bình luận!', 'error');
        return;
      }
      const content = document.getElementById('comment-input')?.value.trim();
      if (!content) return;
      try {
        await api.posts.comment(id, { content });
        document.getElementById('comment-input').value = '';
        this._openPost(id); // refresh
        toast('Đã gửi bình luận! 💬', 'success');
      } catch (err) {
        toast(err.message || 'Lỗi', 'error');
      }
    });
  }

  async _openPost(id) {
    this._currentPostId = id;
    try {
      const data = await api.posts.get(id);
      this.blogView.renderPostDetail(data.post, data.comments ?? []);
      document.getElementById('modal-post')?.classList.remove('hidden');
    } catch (err) {
      toast('Không tìm thấy bài viết', 'error');
    }
  }
}
