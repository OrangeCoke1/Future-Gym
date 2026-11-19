// Local accounts: register, log in, log out (顶栏 → 登录). The logged-in user's id is kept in localStorage so a
// reload stays logged in; the account itself (password hash, profile) lives in IndexedDB (db/users.js).
// While logged in, the profile store edits that user's profile.
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { load, save } from '../utils/storage.js';
import { sharedDb } from '../db/db.js';
import { register as dbRegister, login as dbLogin, getUser, saveProfile } from '../db/users.js';
import { useProfile } from './profile.js';

export const useAuth = defineStore('auth', () => {
  const db = sharedDb();
  const prof = useProfile();
  /** @type {import('vue').ShallowRef<{ id: number, username: string } | null>} */
  const user = shallowRef(null);
  /** false until the saved login has been checked (avoids a flash of the logged-out UI) */
  const ready = ref(false);

  function enter(u) {
    user.value = { id: u.id, username: u.username };
    save('stick.user', u.id);
    prof.bind(u.profile, p => saveProfile(db, u.id, p).catch(e => console.warn('[auth]', e)));
  }
  /** the new account starts with the profile currently on screen */
  async function register(username, password) { enter(await dbRegister(db, username, password, prof.profile)); }
  async function login(username, password) { enter(await dbLogin(db, username, password)); }
  function logout() { user.value = null; save('stick.user', null); prof.bind(null); }

  // restore the login after a reload; a missing or unreadable account just means logged out
  getUser(db, load('stick.user', v => v))
    .then(u => { if (u) enter(u); else save('stick.user', null); })
    .catch(e => console.warn('[auth]', e))
    .finally(() => { ready.value = true; });
  return { user, ready, register, login, logout };
});
