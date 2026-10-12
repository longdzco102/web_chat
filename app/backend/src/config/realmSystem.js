/**
 * config/realmSystem.js
 * Hardcoded realm progression — single source of truth for both backend and frontend.
 * Export as CommonJS for backend; the frontend copies this config inline.
 */

const REALM_SYSTEM = [
  { level: 1, name: 'Luyện Khí Kỳ',  maxExp: 100,   color: '#9CA3AF', css: 'luyen-khi'  },
  { level: 2, name: 'Trúc Cơ Kỳ',    maxExp: 300,   color: '#6EE7B7', css: 'truc-co'    },
  { level: 3, name: 'Kim Đan Kỳ',     maxExp: 800,   color: '#FCD34D', css: 'kim-dan'    },
  { level: 4, name: 'Nguyên Anh Kỳ', maxExp: 2000,  color: '#A78BFA', css: 'nguyen-anh' },
  { level: 5, name: 'Hóa Thần Kỳ',   maxExp: 5000,  color: '#F87171', css: 'hoa-than'   },
  { level: 6, name: 'Luyện Hư Kỳ',   maxExp: 12000, color: '#60A5FA', css: 'luyen-hu'   },
  { level: 7, name: 'Hợp Thể Kỳ',    maxExp: 30000, color: '#FB923C', css: 'hop-the'    },
  { level: 8, name: 'Đại Thừa Kỳ',   maxExp: 80000, color: '#E879F9', css: 'dai-thua'   },
  { level: 9, name: 'Độ Kiếp Kỳ',    maxExp: 999999,color: '#FBBF24', css: 'do-kiep'    },
];

/** Get realm config by index (0-based) */
function getRealmByIndex(idx) {
  return REALM_SYSTEM[Math.max(0, Math.min(idx, REALM_SYSTEM.length - 1))];
}

/** Calculate realm index from total cumulative exp */
function getRealmForExp(totalExp) {
  for (let i = REALM_SYSTEM.length - 1; i >= 0; i--) {
    if (totalExp >= (i > 0 ? REALM_SYSTEM[i - 1].maxExp : 0)) return i;
  }
  return 0;
}

/** EXP reward per valid chat message (after cooldown) */
const EXP_PER_MESSAGE = 2;
/** Cooldown in milliseconds (1 minute) */
const EXP_COOLDOWN_MS = 60_000;
/** Breakthrough success rate */
const BREAKTHROUGH_SUCCESS_RATE = 0.80;
/** Breakthrough fail penalty (EXP deducted) */
const BREAKTHROUGH_FAIL_PENALTY = 20;

module.exports = {
  REALM_SYSTEM,
  getRealmByIndex,
  getRealmForExp,
  EXP_PER_MESSAGE,
  EXP_COOLDOWN_MS,
  BREAKTHROUGH_SUCCESS_RATE,
  BREAKTHROUGH_FAIL_PENALTY,
};
