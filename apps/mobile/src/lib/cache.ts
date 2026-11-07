import { Directory, File, Paths } from 'expo-file-system';

/**
 * Offline cache for the last fetched schedule, clients and money, so the app
 * opens instantly and still shows today's jobs with no signal. Stored in the
 * app's private documents folder (sandboxed, encrypted at rest by the OS),
 * never in backups we control, and wiped on sign-out and account deletion.
 */
const dir = () => new Directory(Paths.document, 'beadup-cache');
const fileFor = (key: string) => new File(dir(), `${key.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)}.json`);

export async function readCache<T>(key: string): Promise<{ data: T; savedAt: number } | null> {
  try {
    const f = fileFor(key);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as { data: T; savedAt: number };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    await fileFor(key).write(JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // The cache is a convenience; never fail a screen because of it.
  }
}

export function clearCache(): void {
  try {
    const d = dir();
    if (d.exists) d.delete();
  } catch {
    // ignore
  }
}
