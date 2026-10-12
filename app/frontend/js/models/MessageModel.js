/**
 * models/MessageModel.js – Chat message state
 * Uses real server messages only.
 */

export class MessageModel {
  constructor() {
    this._messages = [];
  }

  get all() { return this._messages; }

  /** Replace all messages from server response */
  setFromServer(messages) {
    this._messages = messages.map(m => this._normalize(m));
  }

  /** Append a single server message (received via socket) */
  addFromServer(msg) {
    this._messages.push(this._normalize(msg));
  }

  /** Update reactions for a specific message */
  updateReaction({ messageId, emoji, count, reacted }) {
    const msg = this._messages.find(m => (m.id ?? m.userId) === messageId);
    if (!msg) return;
    msg.reactions = msg.reactions ?? [];
    const existing = msg.reactions.find(r => r.e === emoji || r.emoji === emoji);
    if (existing) {
      existing.n = count;
    } else if (count > 0) {
      msg.reactions.push({ e: emoji, n: count });
    }
  }

  clear() { this._messages = []; }

  /** Normalize server message shape → frontend shape */
  _normalize(msg) {
    return {
      id:         msg.id,
      user_id:    msg.user_id ?? msg.sender_id ?? msg.userId,
      userId:     msg.user_id ?? msg.sender_id ?? msg.userId,
      sender_id:  msg.sender_id ?? msg.user_id ?? msg.userId,
      receiver_id:msg.receiver_id,
      text:       msg.content ?? msg.text,
      content:    msg.content ?? msg.text,
      type:       msg.type ?? 'text',
      // server user info embedded
      name:       msg.name,
      avatar:     msg.avatar,
      realm:      msg.realm,
      realmIdx:   msg.realm_index,
      realmCss:   msg.realm_css,
      realm_css:  msg.realm_css,
      role:       msg.sect_role ?? msg.role,
      sect_role:  msg.sect_role ?? msg.role,
      reactions:  (msg.reactions ?? []).map(r => ({ e: r.emoji ?? r.e, n: r.count ?? r.n })),
      created_at: msg.created_at ?? new Date().toISOString(),
      ts:         msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
      file_url:   msg.file_url ?? msg.fileUrl,
      file_path:  msg.file_path ?? msg.filePath,
      file_name:  msg.file_name ?? msg.fileName,
    };
  }
}
