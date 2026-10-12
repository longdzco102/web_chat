/**
 * controllers/VoiceController.js
 * Handles WebRTC peer connection mesh, voice signaling, mic controls, and speaking detection.
 */
import { getSocket } from '../utils/socket.js';
import { toast }     from '../utils/toast.js';

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export class VoiceController {
  constructor({ userModel, voiceView, appController }) {
    this.userModel = userModel;
    this.voiceView = voiceView;
    this.appController = appController;

    this.peers = new Map(); // socketId -> RTCPeerConnection
    this.localStream = null;
    this.channelId = null;
    this.channelName = null;
    this.micEnabled = true;

    // Web Audio Volume Analyser fields
    this.audioContext = null;
    this.analyser = null;
    this.speakingInterval = null;

    this._bindEvents();
  }

  _bindEvents() {
    // 1. Join button
    this.voiceView.btnJoinEl?.addEventListener('click', () => {
      this.joinChannel();
    });

    // 2. Mute button
    this.voiceView.btnMuteEl?.addEventListener('click', () => {
      this.toggleMute();
    });

    // 3. Leave button
    this.voiceView.btnLeaveEl?.addEventListener('click', () => {
      const isDm = this.channelId && String(this.channelId).startsWith('dm:');
      const channelId = this.channelId;
      this.leaveChannel();
      if (isDm && this.appController) {
          this.appController.switchView('chat', { channelId: channelId, channel: 'Đồng Đạo' });
      }
    });
  }

  setChannel(channelId, channelName) {
    // If clicking same channel and already in it, do nothing
    if (String(this.channelId) === String(channelId) && this.localStream) return;

    // If in another channel, leave it first
    if (this.localStream) {
      this.leaveChannel();
    }

    this.channelId = String(channelId);
    this.channelName = String(channelName);
    this.micEnabled = true;

    // Render static wait screen
    this.voiceView.renderPlaceholder(channelName);
  }

  async joinChannel() {
    if (!this.channelId) return;
    const socket = getSocket();
    if (!socket) {
      toast('Không tìm thấy kết nối WebSocket. Hãy thử đăng nhập lại!', 'error');
      return;
    }

    this.voiceView.renderPlaceholder(this.channelName, true); // show connecting spinner

    try {
      // 1. Get hardware media permissions
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      // Ensure microphone track is initialized properly
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = this.micEnabled;
      });

      // 2. Ask backend to join room session
      socket.emit('voice:join', { channelId: this.channelId }, (response) => {
        if (response.error) {
          toast(response.error, 'error');
          this.voiceView.renderPlaceholder(this.channelName, false);
          this.stopLocalStream();
          return;
        }

        const otherUsers = response.users || [];
        const localSocketId = socket.id;

        // Render Active grid
        this.voiceView.renderActiveRoom(
          this.channelName,
          otherUsers,
          localSocketId,
          this.userModel.data,
          this.micEnabled
        );
        this.updateMuteButtonUI();

        // 3. Establish PeerConnection with existing members
        otherUsers.forEach(user => {
          this.initPeerConnection(user.socketId, true); // True means we are initiating the offer
        });

        // 4. Start local speaking detection
        this.startSpeakingDetection(localSocketId);

        // 5. Register voice socket listeners
        this.registerSocketListeners(socket);

        toast('Đã gia nhập Linh Âm Đại Điện! 🔊', 'success');
      });

    } catch (err) {
      console.error('[WebRTC] Access microphone failed:', err);
      toast('Không thể truy cập Microphone! Hãy cấp quyền truy cập thiết bị.', 'error');
      this.voiceView.renderPlaceholder(this.channelName, false);
      this.stopLocalStream();
    }
  }

  initPeerConnection(targetSocketId, isInitiator) {
    if (this.peers.has(targetSocketId)) {
      this.peers.get(targetSocketId).close();
    }

    const socket = getSocket();
    const pc = new RTCPeerConnection(PEER_CONFIG);
    this.peers.set(targetSocketId, pc);

    // Add local tracks to pc
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('voice:ice_candidate', {
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Connection state logger
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection with ${targetSocketId} is ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.cleanupPeer(targetSocketId);
      }
    };

    // Track handler (receive remote audio)
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from peer ${targetSocketId}`);
      if (pc.remoteAudioEl) {
        pc.remoteAudioEl.remove();
      }

      // Create dynamic hidden audio element to play stream
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);

      pc.remoteAudioEl = audio;
    };

    // If we initiate, create SDP Offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('voice:offer', { targetSocketId, offer });
        } catch (err) {
          console.error('[WebRTC] Create offer error:', err);
        }
      };
    }

    return pc;
  }

  registerSocketListeners(socket) {
    // Make sure we don't duplicate listeners
    socket.off('voice:offer');
    socket.off('voice:answer');
    socket.off('voice:ice_candidate');
    socket.off('voice:user_joined');
    socket.off('voice:user_left');
    socket.off('voice:mic_status_changed');
    socket.off('voice:speaking_status_changed');

    // 1. Receive SDP Offer
    socket.on('voice:offer', async ({ senderSocketId, offer }) => {
      console.log(`[WebRTC] Received offer from ${senderSocketId}`);
      try {
        const pc = this.initPeerConnection(senderSocketId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('voice:answer', { targetSocketId: senderSocketId, answer });
      } catch (err) {
        console.error('[WebRTC] Answer offering failed:', err);
      }
    });

    // 2. Receive SDP Answer
    socket.on('voice:answer', async ({ senderSocketId, answer }) => {
      console.log(`[WebRTC] Received answer from ${senderSocketId}`);
      const pc = this.peers.get(senderSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Set remote description failed:', err);
        }
      }
    });

    // 3. Receive ICE Candidate
    socket.on('voice:ice_candidate', async ({ senderSocketId, candidate }) => {
      const pc = this.peers.get(senderSocketId);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Add ICE candidate failed:', err);
        }
      }
    });

    // 4. Remote member joined
    socket.on('voice:user_joined', (user) => {
      this.voiceView.addMemberCard(user);
      // Wait a tiny bit for track sync
      console.log(`[voice] User ${user.name} joined room.`);
    });

    // 5. Remote member left
    socket.on('voice:user_left', ({ socketId }) => {
      this.cleanupPeer(socketId);
      this.voiceView.removeMemberCard(socketId);
      
      // Auto leave if it's a DM and the other user left
      if (this.channelId && String(this.channelId).startsWith('dm:')) {
         if (this.peers.size === 0) {
             toast('Cuộc gọi kết thúc', 'info');
             this.leaveChannel();
             if (this.appController) {
                 this.appController.switchView('chat', { channelId: this.channelId, channel: 'Đồng Đạo' });
             } else {
                 document.getElementById('btn-home')?.click();
             }
         }
      }
    });

    // 6. Mic status updated
    socket.on('voice:mic_status_changed', ({ socketId, enabled }) => {
      this.voiceView.updateMicStatus(socketId, enabled);
    });

    // 7. Speaking status updated
    socket.on('voice:speaking_status_changed', ({ socketId, isSpeaking }) => {
      this.voiceView.updateSpeakingStatus(socketId, isSpeaking);
    });
  }

  startSpeakingDetection(localSocketId) {
    const socket = getSocket();
    if (!socket || !this.localStream) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      let lastSpeaking = false;

      this.speakingInterval = setInterval(() => {
        if (!this.micEnabled) {
          if (lastSpeaking) {
            lastSpeaking = false;
            this.voiceView.updateSpeakingStatus(localSocketId, false);
            socket.emit('voice:speaking_status_changed', { channelId: this.channelId, isSpeaking: false });
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 12; // Speaking threshold

        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          this.voiceView.updateSpeakingStatus(localSocketId, isSpeaking);
          socket.emit('voice:speaking_status_changed', { channelId: this.channelId, isSpeaking });
        }
      }, 150);

    } catch (err) {
      console.warn('[Web Audio] Speaking detector failed to start:', err);
    }
  }

  toggleMute() {
    if (!this.localStream) return;
    this.micEnabled = !this.micEnabled;

    // Toggle track states
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = this.micEnabled;
    });

    const socket = getSocket();
    socket?.emit('voice:mic_status_changed', { channelId: this.channelId, enabled: this.micEnabled });

    // Update local card UI
    if (socket) {
      this.voiceView.updateMicStatus(socket.id, this.micEnabled);
    }
    this.updateMuteButtonUI();
    toast(this.micEnabled ? 'Đã khởi khẩu truyền âm! 🎙️' : 'Đã bế quan tĩnh âm! 🔇', 'info');
  }

  updateMuteButtonUI() {
    if (!this.voiceView.btnMuteEl) return;
    if (this.micEnabled) {
      this.voiceView.btnMuteEl.classList.remove('muted');
      this.voiceView.btnMuteEl.textContent = '🎙️';
      this.voiceView.btnMuteEl.setAttribute('title', 'Bế Quan Tĩnh Âm (Mute)');
    } else {
      this.voiceView.btnMuteEl.classList.add('muted');
      this.voiceView.btnMuteEl.textContent = '🔇';
      this.voiceView.btnMuteEl.setAttribute('title', 'Mở Khẩu Truyền Âm (Unmute)');
    }
  }

  cleanupPeer(socketId) {
    const pc = this.peers.get(socketId);
    if (pc) {
      pc.close();
      if (pc.remoteAudioEl) {
        pc.remoteAudioEl.remove();
      }
      this.peers.delete(socketId);
    }
  }

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  stopSpeakingDetection() {
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }

  leaveChannel() {
    if (!this.channelId) return;

    const socket = getSocket();
    if (socket) {
      socket.emit('voice:leave', { channelId: String(this.channelId) });
      // clear listeners to prevent overlap
      socket.off('voice:offer');
      socket.off('voice:answer');
      socket.off('voice:ice_candidate');
      socket.off('voice:user_joined');
      socket.off('voice:user_left');
      socket.off('voice:mic_status_changed');
      socket.off('voice:speaking_status_changed');
    }

    // 1. Stop mic
    this.stopLocalStream();

    // 2. Stop volume meter
    this.stopSpeakingDetection();

    // 3. Clear peers connection
    this.peers.forEach((pc, sid) => {
      this.cleanupPeer(sid);
    });
    this.peers.clear();

    // 4. Render placeholder wait screen
    this.voiceView.renderPlaceholder(this.channelName);

    toast('Đã thoái khỏi Linh Âm trận pháp!', 'info');
  }

  // Force leave channel on component destroy
  destroy() {
    this.leaveChannel();
    this.channelId = null;
    this.channelName = null;
  }
}
