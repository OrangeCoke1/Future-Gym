// Local accounts (users table). Passwords are never stored: PBKDF2-SHA256 with a random 16-byte salt per user,
// through the browser's Web Crypto. Errors are thrown as Chinese source text, which the UI translates.

export const NAME_MAX = 20, PASS_MIN = 4;
const ITER = 100000;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));

async function hash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
}

/** what a store may keep in memory: never the hash */
const pub = u => ({ id: u.id, username: u.username, profile: u.profile });

/** usernames are trimmed and compared as typed (case-sensitive) */
export const cleanName = s => String(s ?? '').trim();

/** @returns {Promise<{ id: number, username: string, profile: import('../sim/metrics.js').Profile }>} */
export async function register(db, username, password, profile) {
  const name = cleanName(username);
  if (!name || name.length > NAME_MAX) throw new Error('用户名需要 1–20 个字');
  if (String(password).length < PASS_MIN) throw new Error('密码至少 4 位');
  if (await db.users.where('username').equals(name).count()) throw new Error('这个用户名已被使用');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const row = { username: name, passHash: await hash(String(password), salt), salt: hex(salt), createdAt: Date.now(), profile: { ...profile } };
  row.id = await db.users.add(row);
  return pub(row);
}

/** same error for an unknown name and a wrong password, so the form does not reveal which names exist */
export async function login(db, username, password) {
  const u = await db.users.where('username').equals(cleanName(username)).first();
  if (!u || (await hash(String(password), unhex(u.salt))) !== u.passHash) throw new Error('用户名或密码不正确');
  return pub(u);
}

/** @returns {Promise<ReturnType<typeof pub> | null>} the logged-in user after a reload */
export async function getUser(db, id) {
  const u = Number.isInteger(id) ? await db.users.get(id) : null;
  return u ? pub(u) : null;
}

export const saveProfile = (db, id, profile) => db.users.update(id, { profile: { ...profile } });
