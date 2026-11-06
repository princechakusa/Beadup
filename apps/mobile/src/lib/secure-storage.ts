import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the iOS Keychain / Android Keystore
 * (rules.md section 7). Values are split into chunks because SecureStore
 * values should stay under ~2 KB and a session with tokens can be larger.
 *
 * AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: readable for background token refresh,
 * never included in backups or moved to another device.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const CHUNK = 1800;

// SecureStore keys may only contain letters, digits, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(base: string) {
  const count = Number((await SecureStore.getItemAsync(`${base}.n`, OPTIONS)) ?? 0);
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${base}.${i}`, OPTIONS)),
  );
  await SecureStore.deleteItemAsync(`${base}.n`, OPTIONS);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(`${base}.n`, OPTIONS)) ?? 0);
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${base}.${i}`, OPTIONS)),
    );
    // A missing chunk means a torn write: treat as signed out rather than crash.
    if (parts.some((p) => p == null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = safeKey(key);
    await removeChunks(base);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${base}.${i}`, chunks[i], OPTIONS);
    }
    // Written last, so a half-finished write reads back as "no value".
    await SecureStore.setItemAsync(`${base}.n`, String(chunks.length), OPTIONS);
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(safeKey(key));
  },
};
