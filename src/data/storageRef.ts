/**
 * What a stored file reference points at.
 *
 * The database used to store full public URLs for employee photos and the
 * document logo. A URL carries the server's hostname, so moving to a
 * self-hosted database would leave every row pointing at the old cloud project.
 * References are now object paths inside a bucket, and the URL is built at read
 * time from whichever server the app is configured for.
 *
 * Rows written before that change still hold URLs. This recognises a storage
 * URL from any host and recovers the path, so old data keeps working after the
 * move without a backfill.
 *
 * Pure on purpose: no Supabase client, so it is testable and safe to import
 * anywhere.
 */

export type StorageBucket = 'employee-photos' | 'document-logos';

export type StorageRef =
  | { kind: 'none' }
  /** A data URL, a blob URL, or a URL that is not one of our storage objects. */
  | { kind: 'inline'; src: string }
  | { kind: 'object'; bucket: StorageBucket; path: string };

/** Matches public, signed and authenticated object URLs on any host. */
const STORAGE_OBJECT_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseStorageRef(
  bucket: StorageBucket,
  value: string | null | undefined,
): StorageRef {
  const raw = (value ?? '').trim();
  if (raw.length === 0) return { kind: 'none' };

  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return { kind: 'inline', src: raw };
  }

  if (/^https?:\/\//i.test(raw)) {
    const match = STORAGE_OBJECT_URL.exec(raw);
    if (match && safeDecode(match[1]) === bucket) {
      return { kind: 'object', bucket, path: safeDecode(match[2]) };
    }
    return { kind: 'inline', src: raw };
  }

  return { kind: 'object', bucket, path: raw.replace(/^\/+/, '') };
}

/** The value to store for a newly uploaded object. */
export function storagePathFor(ref: StorageRef): string {
  switch (ref.kind) {
    case 'none':
      return '';
    case 'inline':
      return ref.src;
    case 'object':
      return ref.path;
  }
}
