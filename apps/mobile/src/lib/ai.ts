import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { api, ApiError } from './data';
import { supabase } from './supabase';

// AI photo quotes (rules.md sections 3 and 5): system photo picker only (no
// full library access), photos re-encoded on the phone (which drops EXIF and
// GPS), uploaded to the detailer's private folder, and sent to the AI only
// after the detailer's explicit consent.

export const MAX_PHOTOS = 6;
const LONG_EDGE = 1568; // larger images are downscaled by the AI provider anyway

export type AiSuggestion = {
  quoteId: string | null;
  mock: boolean;
  vehicleSize: 'sedan' | 'suv' | 'truck';
  vehicleDescription: string;
  conditions: { label: string; area: string; severity: 'light' | 'moderate' | 'heavy' }[];
  serviceId: string | null;
  addOnIds: string[];
  note: string;
  confidence: 'low' | 'medium' | 'high';
};

export type AiProviderId = 'openai' | 'anthropic';

/** How the provider is named to the detailer (consent screen, Settings). */
export const AI_PROVIDER_LABEL: Record<AiProviderId, { name: string; long: string }> = {
  openai: { name: 'OpenAI', long: 'OpenAI, the company that makes ChatGPT' },
  anthropic: { name: 'Anthropic', long: 'Anthropic, the company that makes the Claude AI model' },
};

/** Which provider photos go to, and whether this detailer agreed to that provider. */
export async function aiConsentStatus(): Promise<{ provider: AiProviderId; consented: boolean }> {
  if (!supabase) return { provider: 'openai', consented: true };
  const { data, error } = await supabase.rpc('ai_consent_status');
  if (error || !data) return { provider: 'openai', consented: false };
  const d = data as { provider: string; consented: boolean };
  return { provider: d.provider === 'anthropic' ? 'anthropic' : 'openai', consented: d.consented };
}

export async function hasAiConsent(): Promise<boolean> {
  return (await aiConsentStatus()).consented;
}

export async function giveAiConsent(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_ai_consent');
  if (error) throw error;
}

export async function withdrawAiConsent(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('revoke_ai_consent');
  if (error) throw error;
}

/** System photo picker: the user grants access only to the photos they pick. */
export async function pickPhotos(remaining: number): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, remaining),
    quality: 1,
    exif: false,
  });
  return res.canceled ? [] : res.assets.slice(0, remaining).map((a) => a.uri);
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

/** Downscale and re-encode as JPEG. Re-encoding writes a fresh file with no EXIF/GPS. */
async function prepare(uri: string): Promise<Uint8Array> {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const scale = Math.min(1, LONG_EDGE / Math.max(probe.width, probe.height));
  const image =
    scale < 1
      ? await ImageManipulator.manipulate(uri)
          .resize({ width: Math.round(probe.width * scale), height: Math.round(probe.height * scale) })
          .renderAsync()
      : probe;
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return new File(saved.uri).bytes();
}

function randomName(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Uploads prepared photos to quote-photos/<detailer id>/... and returns their paths. */
export async function uploadPhotos(uris: string[]): Promise<string[]> {
  if (!supabase) return uris.map(() => `preview/${randomName()}.jpg`);
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('signed out');
  return Promise.all(
    uris.map(async (uri) => {
      const bytes = await prepare(uri);
      const path = `${uid}/${randomName()}.jpg`;
      const { error } = await supabase!.storage.from('quote-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return path;
    }),
  );
}

export type AiError = 'consent_required' | 'not_a_vehicle' | 'ai_declined' | 'rate_limited' | 'unavailable';

export async function suggestFromPhotos(paths: string[], note: string): Promise<AiSuggestion> {
  if (!supabase) {
    return {
      quoteId: null,
      mock: true,
      vehicleSize: 'suv',
      vehicleDescription: 'Mid-size SUV (preview)',
      conditions: [{ label: 'Pet hair', area: 'rear seats', severity: 'moderate' }],
      serviceId: 's2',
      addOnIds: ['a1'],
      note: 'Preview suggestion. Connect the backend for real photo analysis.',
      confidence: 'low',
    };
  }
  try {
    return await api<AiSuggestion>('/api/quotes/ai', { method: 'POST', body: JSON.stringify({ photoPaths: paths, note }) });
  } catch (e) {
    throw e instanceof ApiError ? e : new ApiError(0, null);
  }
}
