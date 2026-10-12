/**
 * main.js – Application entry point (no mock data)
 */

// ── Models ─────────────────────────────────────────────────────
import { UserModel }    from './models/UserModel.js';
import { MessageModel } from './models/MessageModel.js';

// ── Views ──────────────────────────────────────────────────────
import { SidebarView } from './views/SidebarView.js';
import { BlogView }    from './views/BlogView.js';
import { ChatView }    from './views/ChatView.js';
import { MemberView }  from './views/MemberView.js';
import { VoiceView }   from './views/VoiceView.js';

// ── Controllers ────────────────────────────────────────────────
import { AppController }  from './controllers/AppController.js';
import { AuthController } from './controllers/AuthController.js';
import { BlogController } from './controllers/BlogController.js';
import { ChatController } from './controllers/ChatController.js';
import { VoiceController } from './controllers/VoiceController.js';

// ══════════════════════════════════════════════════════════════
function boot() {
  // 1. Models
  const userModel    = new UserModel();
  const messageModel = new MessageModel();

  // 2. Views
  const sidebarView = new SidebarView();
  const blogView    = new BlogView();
  const chatView    = new ChatView();
  const memberView  = new MemberView();
  const voiceView   = new VoiceView();

  // 3. Initial renders
  blogView.createParticles();
  blogView.render([]);       // empty until API loads
  memberView.renderFromServer([]);

  // 4. AppController first (no chatCtrl yet)
  const appCtrl = new AppController({
    userModel, sidebarView, chatView, memberView,
  });

  // 5. AuthController – passes appCtrl for post-login sect loading
  const authCtrl = new AuthController({
    userModel, sidebarView, memberView,
    appController: appCtrl,
    onLogin:  (user) => {
      chatView.render([], user.id); // start with empty chat
      appCtrl.setupGlobalSocketListeners();
      if (chatCtrl) chatCtrl.setupGlobalSocketListeners();
      appCtrl.onLoginSuccess();
    },
    onLogout: () => appCtrl.switchView('blog'),
  });

  // 6. BlogController – fully API-driven
  const blogCtrl = new BlogController({ blogView, userModel }); // eslint-disable-line no-unused-vars

  // 7. ChatController – inject into AppController
  const chatCtrl = new ChatController({
    userModel, messageModel, chatView, authController: authCtrl,
  });
  appCtrl.setChatController(chatCtrl);

  // 8. VoiceController – inject into AppController
  const voiceCtrl = new VoiceController({
    userModel, voiceView, appController: appCtrl
  });
  appCtrl.setVoiceController(voiceCtrl);

  // 9. Start on blog view
  appCtrl.switchView('blog');

  console.log(
    '%c☯ Tiên Giới Hội – Khởi Động Thành Công ☯',
    'color:#2DD4BF;font-size:15px;font-weight:700;background:#1E1F22;padding:6px 14px;border-radius:6px;'
  );
}

document.addEventListener('DOMContentLoaded', boot);
