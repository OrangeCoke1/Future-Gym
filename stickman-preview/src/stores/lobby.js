import { defineStore } from 'pinia';

export const useLobby = defineStore('lobby', {
  state: () => ({ introSeen: false }),
});
