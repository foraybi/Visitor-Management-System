import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseStorageRef, type StorageBucket } from './storageRef';

/**
 * Uploading and displaying stored files.
 *
 * Files are referenced by object path, and URLs are built at read time from the
 * configured server, so the same rows work against the cloud project today and
 * a self-hosted server later. See storageRef.ts.
 *
 * `employee-photos` is a private bucket, so its images need signed URLs. That
 * was missing: the bucket was made private while the code still stored and
 * displayed public URLs, which a private bucket refuses.
 */

const PRIVATE_BUCKETS: ReadonlySet<StorageBucket> = new Set(['employee-photos']);
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Refresh a signed URL five minutes before it expires. */
const SIGNED_URL_MARGIN_MS = 5 * 60 * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** Upload a file and return the path to store. Throws on failure. */
export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

/** Best effort: a leftover file is untidy, not harmful, so failure is ignored. */
export async function removeFromStorage(bucket: StorageBucket, value: string | null | undefined) {
  const ref = parseStorageRef(bucket, value);
  if (ref.kind !== 'object') return;
  await supabase.storage.from(bucket).remove([ref.path]);
}

/** A displayable URL for a stored reference, or '' when there is none. */
export async function resolveStorageUrl(
  bucket: StorageBucket,
  value: string | null | undefined,
): Promise<string> {
  const ref = parseStorageRef(bucket, value);
  if (ref.kind === 'none') return '';
  if (ref.kind === 'inline') return ref.src;

  if (!PRIVATE_BUCKETS.has(bucket)) {
    return supabase.storage.from(bucket).getPublicUrl(ref.path).data.publicUrl;
  }

  const key = `${bucket}/${ref.path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return '';

  signedUrlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_MARGIN_MS,
  });
  return data.signedUrl;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * A stored file as a data URL, for jsPDF.
 *
 * Downloads through the storage API rather than fetching a URL, so it works for
 * private buckets and does not depend on the public hostname.
 */
export async function storageObjectAsDataUrl(
  bucket: StorageBucket,
  value: string | null | undefined,
): Promise<string> {
  const ref = parseStorageRef(bucket, value);
  try {
    if (ref.kind === 'none') return '';
    if (ref.kind === 'inline') {
      if (ref.src.startsWith('data:')) return ref.src;
      const response = await fetch(ref.src);
      return response.ok ? await blobToDataUrl(await response.blob()) : '';
    }
    const { data, error } = await supabase.storage.from(bucket).download(ref.path);
    return error || !data ? '' : await blobToDataUrl(data);
  } catch {
    return '';
  }
}

/** Resolve a stored reference to a URL for rendering. '' while loading or absent. */
export function useStorageUrl(bucket: StorageBucket, value: string | null | undefined): string {
  const key = `${bucket}|${value ?? ''}`;
  const [resolved, setResolved] = useState<{ key: string; url: string }>({ key: '', url: '' });

  useEffect(() => {
    let cancelled = false;
    void resolveStorageUrl(bucket, value).then((url) => {
      if (!cancelled) setResolved({ key, url });
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, value, key]);

  return resolved.key === key ? resolved.url : '';
}
