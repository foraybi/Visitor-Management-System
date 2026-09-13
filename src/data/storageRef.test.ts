import { describe, expect, it } from 'vitest';
import { parseStorageRef, storagePathFor } from './storageRef';

describe('parseStorageRef', () => {
  it('reads a stored object path', () => {
    expect(parseStorageRef('employee-photos', 'a1b2.jpg')).toEqual({
      kind: 'object',
      bucket: 'employee-photos',
      path: 'a1b2.jpg',
    });
  });

  it('strips a leading slash from a path', () => {
    expect(parseStorageRef('document-logos', '/logo.png')).toMatchObject({ path: 'logo.png' });
  });

  it('treats empty and missing values as no file', () => {
    expect(parseStorageRef('employee-photos', '')).toEqual({ kind: 'none' });
    expect(parseStorageRef('employee-photos', '   ')).toEqual({ kind: 'none' });
    expect(parseStorageRef('employee-photos', null)).toEqual({ kind: 'none' });
    expect(parseStorageRef('employee-photos', undefined)).toEqual({ kind: 'none' });
  });

  // The migration case. Rows written before the change hold URLs that name the
  // old cloud project. The path must be recovered so the file resolves against
  // whichever server the app is now pointed at.
  describe('legacy URLs from before the move', () => {
    it('recovers the path from a cloud public URL', () => {
      const url =
        'https://oldproject.supabase.co/storage/v1/object/public/document-logos/logo.png';
      expect(parseStorageRef('document-logos', url)).toEqual({
        kind: 'object',
        bucket: 'document-logos',
        path: 'logo.png',
      });
    });

    it('recovers the path from a self-hosted URL on another host and port', () => {
      const url = 'http://10.0.0.5:8000/storage/v1/object/public/employee-photos/x/y.jpg';
      expect(parseStorageRef('employee-photos', url)).toMatchObject({ path: 'x/y.jpg' });
    });

    it('recovers the path from a signed URL and drops the token', () => {
      const url =
        'https://oldproject.supabase.co/storage/v1/object/sign/employee-photos/a.jpg?token=abc';
      expect(parseStorageRef('employee-photos', url)).toMatchObject({ path: 'a.jpg' });
    });

    it('decodes an encoded path', () => {
      const url = 'https://h/storage/v1/object/public/employee-photos/photo%20one.jpg';
      expect(parseStorageRef('employee-photos', url)).toMatchObject({ path: 'photo one.jpg' });
    });

    it('does not claim a URL from a different bucket', () => {
      const url = 'https://h/storage/v1/object/public/document-logos/logo.png';
      expect(parseStorageRef('employee-photos', url)).toEqual({ kind: 'inline', src: url });
    });
  });

  it('passes an unrelated external URL through untouched', () => {
    const url = 'https://example.com/logo.png';
    expect(parseStorageRef('document-logos', url)).toEqual({ kind: 'inline', src: url });
  });

  it('passes a data URL through, as older employee photos were stored inline', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    expect(parseStorageRef('employee-photos', data)).toEqual({ kind: 'inline', src: data });
  });
});

describe('storagePathFor', () => {
  it('stores the path, never a URL, for an object', () => {
    expect(
      storagePathFor(
        parseStorageRef('document-logos', 'https://old.supabase.co/storage/v1/object/public/document-logos/l.png'),
      ),
    ).toBe('l.png');
  });
});
