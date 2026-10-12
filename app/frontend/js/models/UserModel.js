/**
 * models/UserModel.js – No mock data. All data from server.
 */

// Realm config mirrored from backend/src/config/realmSystem.js
// (single source of truth is backend; frontend mirrors for display)
const REALM_CONFIG = [
  { level: 1, name: 'Luyện Khí Kỳ',  maxExp: 100,   css: 'luyen-khi'  },
  { level: 2, name: 'Trúc Cơ Kỳ',    maxExp: 300,   css: 'truc-co'    },
  { level: 3, name: 'Kim Đan Kỳ',     maxExp: 800,   css: 'kim-dan'    },
  { level: 4, name: 'Nguyên Anh Kỳ', maxExp: 2000,  css: 'nguyen-anh' },
  { level: 5, name: 'Hóa Thần Kỳ',   maxExp: 5000,  css: 'hoa-than'   },
  { level: 6, name: 'Luyện Hư Kỳ',   maxExp: 12000, css: 'luyen-hu'   },
  { level: 7, name: 'Hợp Thể Kỳ',    maxExp: 30000, css: 'hop-the'    },
  { level: 8, name: 'Đại Thừa Kỳ',   maxExp: 80000, css: 'dai-thua'   },
  { level: 9, name: 'Độ Kiếp Kỳ',    maxExp: 999999,css: 'do-kiep'    },
];

export function getRealmConfig(idx) {
  return REALM_CONFIG[Math.max(0, Math.min(idx ?? 0, REALM_CONFIG.length - 1))];
}

export { REALM_CONFIG };

export class UserModel {
  constructor() {
    this.isLoggedIn = false;
    this.data = null;
  }

  /** Login from server JWT response */
  loginFromServer(serverUser) {
    const realmIdx = serverUser.realm_index ?? 0;
    const realm    = getRealmConfig(realmIdx);
    this.data = {
      id:         serverUser.id,
      name:       serverUser.name,
      email:      serverUser.email,
      avatar_url: serverUser.avatar_url ?? null,
      avatar:     serverUser.avatar ?? '🌟',
      realm:      serverUser.realm ?? realm.name,
      realmIdx,
      realmCss:   serverUser.realmCss ?? realm.css,
      exp:        serverUser.exp ?? 0,
      maxExp:     serverUser.maxExp ?? realm.maxExp,
    };
    this.isLoggedIn = true;
    return this.data;
  }

  /** Update EXP + realm from server broadcast */
  updateExp({ exp, realm, realm_index, maxExp, realmCss }) {
    if (!this.data) return;
    if (exp        !== undefined) this.data.exp      = exp;
    if (realm      !== undefined) this.data.realm    = realm;
    if (realm_index!== undefined) this.data.realmIdx = realm_index;
    if (maxExp     !== undefined) this.data.maxExp   = maxExp;
    if (realmCss   !== undefined) this.data.realmCss = realmCss;
  }

  logout() {
    this.isLoggedIn = false;
    this.data = null;
  }

  get expPercent() {
    if (!this.data) return 0;
    return Math.min(100, Math.round(((this.data.exp ?? 0) / (this.data.maxExp ?? 1)) * 100));
  }
}
