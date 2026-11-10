// JSON 文件存储：data/db.json。单进程足够用，写入做了防抖。
const { iso } = require('./time');
const fs = require('fs');
const path = require('path');
const { seed } = require('./seed');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'reports'), { recursive: true });

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  db = seed();
}
// 补齐新版本增加的集合
const base = seed();
for (const k of Object.keys(base)) if (db[k] === undefined) db[k] = base[k];

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 2));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  }, 200);
}
save();

const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function log(text, kind = 'system') {
  db.moments.unshift({ id: uid('m'), text, kind, at: iso() });
  db.moments = db.moments.slice(0, 300);
  save();
}

module.exports = { db, save, uid, log, DATA_DIR };
