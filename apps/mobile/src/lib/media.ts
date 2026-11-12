// The detailer's photo and portfolio ("Recent work") on their booking page.
// Photos are re-encoded on the phone (drops EXIF/GPS), stored in the private
// profile-media bucket under <user id>/, and served to clients by the web app.
import * as ImagePicker from 'expo-image-picker';

import { prepare, randomName } from './ai';
import { refreshBookingPage } from './data';
import { supabase } from './supabase';

export const MAX_WORK = 12;
export type WorkItem = { id: string; path: string; caption: string; url: string | null };
export type Media = { photoPath: string | null; photoUrl: string | null; work: WorkItem[] };

async function uid(): Promise<string> {
  const { data } = await supabase!.auth.getUser();
  if (!data.user) throw new Error('signed out');
  return data.user.id;
}

/** Short-lived links so the app can show the detailer their own private files. */
async function signed(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase!.storage.from('profile-media').createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function fetchMedia(): Promise<Media> {
  if (!supabase) return { photoPath: null, photoUrl: null, work: [] };
  const [me, items] = await Promise.all([
    supabase.from('detailers').select('*').maybeSingle(),
    supabase.from('portfolio_items').select('id, path, caption').order('sort_order').order('created_at'),
  ]);
  if (me.error) throw me.error;
  if (items.error) throw items.error;
  const photoPath: string | null = me.data?.photo_path ?? null;
  const urls = await signed([...(photoPath ? [photoPath] : []), ...items.data.map((i) => i.path)]);
  return {
    photoPath,
    photoUrl: photoPath ? (urls[photoPath] ?? null) : null,
    work: items.data.map((i) => ({ id: i.id, path: i.path, caption: i.caption, url: urls[i.path] ?? null })),
  };
}

/** Lets the detailer pick one photo, cropped to `aspect`. Null when cancelled. */
export async function pickPhoto(aspect: [number, number]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1, exif: false });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

async function upload(uri: string, longEdge: number): Promise<string> {
  const id = await uid();
  const bytes = await prepare(uri, longEdge);
  const path = `${id}/${randomName()}.jpg`;
  const { error } = await supabase!.storage.from('profile-media').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Sets (or with null, removes) the detailer's own photo. */
export async function setProfilePhoto(uri: string | null, previous: string | null): Promise<void> {
  if (!supabase) return;
  const id = await uid();
  const path = uri ? await upload(uri, 800) : null;
  const { error } = await supabase.from('detailers').update({ photo_path: path }).eq('id', id);
  if (error) {
    if (path) await supabase.storage.from('profile-media').remove([path]);
    throw error;
  }
  if (previous) await supabase.storage.from('profile-media').remove([previous]);
  await refreshBookingPage();
}

export async function addWork(uri: string, caption: string): Promise<void> {
  if (!supabase) return;
  const id = await uid();
  const path = await upload(uri, 1600);
  const { error } = await supabase.from('portfolio_items').insert({ detailer_id: id, path, caption: caption.trim() });
  if (error) {
    await supabase.storage.from('profile-media').remove([path]);
    throw error;
  }
  await refreshBookingPage();
}

export async function setWorkCaption(id: string, caption: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('portfolio_items').update({ caption: caption.trim().slice(0, 80) }).eq('id', id);
  if (error) throw error;
  await refreshBookingPage();
}

export async function removeWork(item: WorkItem): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
  if (error) throw error;
  await supabase.storage.from('profile-media').remove([item.path]);
  await refreshBookingPage();
}
