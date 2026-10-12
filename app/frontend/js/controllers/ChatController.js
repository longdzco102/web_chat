/**
 * controllers/ChatController.js
 * Real-time chat: text + stickers, EXP cooldown feedback, breakthrough UI.
 * NO mock data — all live via Socket.io.
 */
import { toast } from '../utils/toast.js';
import { getSocket } from '../utils/socket.js';
import api from '../utils/api.js';

// ── Sticker definitions (filenames in /stickers/) ─────────────────────────
const STICKERS = [
  { file: '01.webp', label: '👍 Tốt' },
  { file: 'bo_tay.webp', label: '🤷 Bó Tay' },
  { file: 'de_thuong.webp', label: '🥰 Dễ Thương' },
  { file: 'dung.webp', label: '✅ Đúng' },
  { file: 'ha.webp', label: '❓ Hả' },
  { file: 'ok.webp', label: '👌 OK' },
  { file: 'tai_xuong.webp', label: 'Não' },
  { file: 'tai_xuong_1.webp', label: 'Chó' },
  { file: 'tai_xuong_2.webp', label: 'Mèo' },
  { file: 'ua.webp', label: '😳 Ủa' },
];



export class ChatController {
  constructor({ userModel, messageModel, chatView, authController }) {
    this.userModel = userModel;
    this.messageModel = messageModel;
    this.chatView = chatView;
    this.authController = authController;
    this._currentChannelId = null;
    this._typingTimer = null;
    this._mediaRecorder = null;
    this._audioChunks = [];
    this._recordStartTime = 0;
    this._recordInterval = null;
    this.onDmReceived = null; // Callback for AppController to refresh DM sidebar
    this._bindUI();
    this._renderStickerPicker();
    this._bindWorldNotice();
  }

  /** Called by AppController when user enters a channel */
  setChannel(channelId) {
    if (this._currentChannelId && !String(this._currentChannelId).startsWith('dm:') && getSocket()) {
      getSocket().emit('channel:leave', { channelId: this._currentChannelId });
    }
    this._currentChannelId = channelId;
    if (!channelId) return;

    const s = getSocket();

    if (String(channelId).startsWith('dm:')) {
      const targetUserId = channelId.split(':')[1];
      api.dms.history(targetUserId)
        .then(({ messages }) => {
          this.messageModel.setFromServer(messages || []);
          this.chatView.render(this.messageModel.all, this.userModel.data?.id);

          // Mark read
          api.dms.markRead(targetUserId).catch(console.error);
        })
        .catch(err => toast(err.message, 'error'));
    } else {
      if (!s) return;
      s.emit('channel:join', { channelId }, ({ ok, messages, error }) => {
        if (error) { toast(error, 'error'); return; }
        if (ok && messages) {
          this.messageModel.setFromServer(messages);
          this.chatView.render(this.messageModel.all, this.userModel.data?.id);
        }
      });
    }
  }

  setupGlobalSocketListeners() {
    const s = getSocket();
    if (!s) return;

    // 1. DM Message
    s.on('dm:message', (msg) => {
      const myId = String(this.userModel.data?.id);
      const currentTargetId = String(this._currentChannelId).startsWith('dm:')
        ? String(this._currentChannelId).split(':')[1]
        : null;

      if (currentTargetId) {
        const isMsgFromTarget = String(msg.sender_id) === currentTargetId && String(msg.receiver_id) === myId;
        const isMsgFromMe = String(msg.sender_id) === myId && String(msg.receiver_id) === currentTargetId;

        if (isMsgFromTarget || isMsgFromMe) {
          this.messageModel.addFromServer(msg);
          this.chatView.render(this.messageModel.all, this.userModel.data?.id);

          if (isMsgFromTarget) {
            api.dms.markRead(currentTargetId).catch(console.error);
          }
        }
      }
      if (this.onDmReceived) this.onDmReceived(msg);
    });

    // 2. Sect Channel Message
    s.on('message:new', (msg) => {
      if (msg.channel_id && String(msg.channel_id) === String(this._currentChannelId)) {
        this.messageModel.addFromServer(msg);
        this.chatView.render(this.messageModel.all, this.userModel.data?.id);
      }
    });

    // 3. Reaction Update
    s.on('message:reaction_update', (data) => {
      // It's safe to update model regardless, but we only re-render if it belongs to current view
      // Wait, data doesn't have channelId, but messageModel handles finding it by id.
      this.messageModel.updateReaction(data);
      this.chatView.render(this.messageModel.all, this.userModel.data?.id);
    });

    // 4. Typing Start
    s.on('typing:start', ({ userId, name, channelId }) => {
      if (channelId && channelId !== this._currentChannelId) return;
      if (String(userId) !== String(this.userModel.data?.id)) {
        this.chatView.showTyping(name);
      }
    });

    // 5. Typing Stop
    s.on('typing:stop', ({ userId, channelId }) => {
      if (channelId && channelId !== this._currentChannelId) return;
      if (String(userId) !== String(this.userModel.data?.id)) {
        this.chatView.hideTyping();
      }
    });

    // 6. EXP Update
    s.on('user:exp_update', (expData) => {
      if (!expData) return;
      this.userModel.updateExp(expData);
      this.authController.refreshExpBar();
      this._checkBreakthroughReady();
    });
  }

  // ── Breakthrough ready check ────────────────────────────────────────────
  _checkBreakthroughReady() {
    const btn = document.getElementById('btn-breakthrough');
    if (!btn || !this.userModel.data) return;
    const { exp, maxExp } = this.userModel.data;
    const ready = (exp ?? 0) >= (maxExp ?? Infinity);
    btn.classList.toggle('ready', ready);
    btn.title = ready ? '⚡ Đột Phá Cảnh Giới!' : 'Linh Khí chưa đủ';
  }

  // ── Bind world broadcast ────────────────────────────────────────────────
  _bindWorldNotice() {
    const s = getSocket();
    if (!s) return setTimeout(() => this._bindWorldNotice(), 1500);

    s.off('world_notice').on('world_notice', ({ message, type }) => {
      toast(`${message}`, type === 'breakthrough' ? 'success' : 'info', 6000);
      // Also show in chat area as system message
      this.chatView.showSystemMessage(message);
    });
  }

  _bindUI() {
    // Send on Enter
    document.getElementById('btn-send')
      ?.addEventListener('click', () => this._sendMessage());
    document.getElementById('message-input')
      ?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendMessage(); }
      });

    // Typing emit
    document.getElementById('message-input')
      ?.addEventListener('input', e => {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
        if (this._currentChannelId && getSocket()) {
          getSocket().emit('typing:start', { channelId: this._currentChannelId });
          clearTimeout(this._typingTimer);
          this._typingTimer = setTimeout(() => {
            getSocket().emit('typing:stop', { channelId: this._currentChannelId });
          }, 2000);
        }
      });

    // Sticker picker toggle
    document.getElementById('btn-sticker')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('sticker-picker')?.classList.toggle('hidden');
      document.getElementById('emoji-picker')?.classList.add('hidden');
    });

    // Close pickers on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('#sticker-picker') && e.target.id !== 'btn-sticker')
        document.getElementById('sticker-picker')?.classList.add('hidden');
    });

    document.getElementById('btn-attach')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click();
    });

    document.getElementById('file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this._sendFile(file);
        e.target.value = ''; // reset
      }
    });

    document.getElementById('btn-voice')?.addEventListener('click', () => {
      this._startRecording();
    });

    document.getElementById('btn-stop-record')?.addEventListener('click', () => {
      this._stopRecording(true); // save and send
    });

    document.getElementById('btn-cancel-record')?.addEventListener('click', () => {
      this._stopRecording(false); // discard
    });

    // Breakthrough button
    document.getElementById('btn-breakthrough')?.addEventListener('click', () => {
      if (!this.userModel.isLoggedIn) return;
      this._requestBreakthrough();
    });
  }

  _renderStickerPicker() {
    const grid = document.getElementById('sticker-grid');
    if (!grid) return;
    grid.innerHTML = STICKERS.map(s =>
      `<button class="sticker-thumb" data-file="${s.file}" title="${s.label}">
         <img src="/stickers/${s.file}" alt="${s.label}" loading="lazy" />
       </button>`
    ).join('');
    grid.querySelectorAll('.sticker-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('sticker-picker')?.classList.add('hidden');
        this._sendSticker(btn.dataset.file);
      });
    });
  }

  _sendSticker(filename) {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return;
    }
    if (!this._currentChannelId) {
      toast('Hãy chọn kênh để gửi sticker!', 'error');
      return;
    }

    if (String(this._currentChannelId).startsWith('dm:')) {
      const targetUserId = this._currentChannelId.split(':')[1];
      api.dms.send(targetUserId, { content: filename, type: 'sticker' })
        .catch(err => toast(err.message, 'error'));
    } else {
      if (!getSocket()) return;
      getSocket().emit('message:send',
        { channelId: this._currentChannelId, content: filename, type: 'sticker' },
        ({ error }) => { if (error) toast(error, 'error'); }
      );
    }
  }

  _sendMessage() {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return;
    }
    const input = document.getElementById('message-input');
    const text = input?.value.trim();
    if (!text) return;

    if (!this._currentChannelId) {
      toast('Hãy chọn một kênh để gửi tin nhắn', 'error');
      return;
    }

    if (String(this._currentChannelId).startsWith('dm:')) {
      const targetUserId = this._currentChannelId.split(':')[1];
      api.dms.send(targetUserId, { content: text })
        .then(() => {
          this.chatView.clearInput();
        })
        .catch(err => toast(err.message, 'error'));
    } else {
      if (!getSocket()) return;
      getSocket().emit('message:send',
        { channelId: this._currentChannelId, content: text, type: 'text' },
        ({ error }) => { if (error) toast(error, 'error'); }
      );
      getSocket().emit('typing:stop', { channelId: this._currentChannelId });
      this.chatView.clearInput();
    }
  }

  _requestBreakthrough() {
    const btn = document.getElementById('btn-breakthrough');
    if (!btn?.classList.contains('ready')) {
      toast('Linh Khí chưa đủ để đột phá!', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Đang đột phá...';

    getSocket()?.emit('request_breakthrough', (res) => {
      btn.disabled = false;
      this._checkBreakthroughReady();

      if (res?.error) {
        toast(res.error, 'error');
        btn.textContent = '⚡ Đột Phá';
        return;
      }
      if (res?.success) {
        btn.textContent = '⚡ Đột Phá';
        toast(`🎊 Đột phá thành công! Chào mừng ${this.userModel.data?.realm}!`, 'success', 5000);
        this._showBreakthroughEffect('success');
      } else {
        btn.textContent = '⚡ Đột Phá';
        toast(`💥 Tẩu Hỏa Nhập Ma! Mất ${res.penalty} Linh Khí! 😭`, 'error', 5000);
        this._showBreakthroughEffect('fail');
      }
    });
  }

  _showBreakthroughEffect(type) {
    const overlay = document.createElement('div');
    overlay.className = `breakthrough-overlay breakthrough-${type}`;
    overlay.innerHTML = type === 'success'
      ? '<div class="bt-content">⚡<br>ĐỘT PHÁ THÀNH CÔNG!</div>'
      : '<div class="bt-content">💥<br>TẨU HỎA NHẬP MA!</div>';
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2500);
  }

  // ── File and Voice handling ─────────────────────────────────────────────

  async _sendFile(file, isVoice = false) {
    if (!this.userModel.isLoggedIn) {
      document.getElementById('modal-auth')?.classList.remove('hidden');
      return;
    }
    if (!this._currentChannelId) {
      toast('Hãy chọn kênh để gửi!', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file, isVoice ? 'voice-message.webm' : file.name);
    if (isVoice) {
      formData.append('type', 'voice');
    }

    // If there's text in input, send it too
    const input = document.getElementById('message-input');
    const text = input?.value.trim();
    if (text) formData.append('content', text);

    try {
      toast('Đang truyền file...', 'info');
      if (String(this._currentChannelId).startsWith('dm:')) {
        const targetUserId = this._currentChannelId.split(':')[1];
        await api.dms.send(targetUserId, formData);
      } else {
        await api.channels.send(this._currentChannelId, formData);
      }
      this.chatView.clearInput();
      toast('Đã gửi thành công', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async _startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Trình duyệt không hỗ trợ ghi âm', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._mediaRecorder = new MediaRecorder(stream);
      this._audioChunks = [];

      this._mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };

      this._mediaRecorder.onstart = () => {
        document.getElementById('message-input').style.display = 'none';
        document.getElementById('recording-indicator').classList.remove('hidden');
        this._recordStartTime = Date.now();
        this._recordInterval = setInterval(() => {
          const diff = Math.floor((Date.now() - this._recordStartTime) / 1000);
          const m = String(Math.floor(diff / 60)).padStart(2, '0');
          const s = String(diff % 60).padStart(2, '0');
          document.getElementById('recording-time').textContent = `${m}:${s}`;
        }, 1000);
      };

      this._mediaRecorder.onstop = () => {
        clearInterval(this._recordInterval);
        document.getElementById('message-input').style.display = 'block';
        document.getElementById('recording-indicator').classList.add('hidden');
        document.getElementById('recording-time').textContent = '00:00';

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      this._mediaRecorder.start();
    } catch (e) {
      toast('Không thể truy cập Microphone', 'error');
    }
  }

  _stopRecording(save = false) {
    if (!this._mediaRecorder || this._mediaRecorder.state === 'inactive') return;

    if (save) {
      this._mediaRecorder.onstop = () => {
        clearInterval(this._recordInterval);
        document.getElementById('message-input').style.display = 'block';
        document.getElementById('recording-indicator').classList.add('hidden');
        document.getElementById('recording-time').textContent = '00:00';

        const blob = new Blob(this._audioChunks, { type: 'audio/webm' });
        this._sendFile(blob, true);

        const stream = this._mediaRecorder.stream;
        stream.getTracks().forEach(track => track.stop());
      };
    }
    this._mediaRecorder.stop();
  }
}
