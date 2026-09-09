import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persist, setWriteFailureReporter } from './persist';

describe('persist', () => {
  let reported: Array<[string, string]>;

  beforeEach(() => {
    reported = [];
    setWriteFailureReporter((action, message) => reported.push([action, message]));
  });

  it('keeps the optimistic update when the write succeeds', async () => {
    const rollback = vi.fn();

    const ok = await persist('delete company', async () => ({ error: null }), rollback);

    expect(ok).toBe(true);
    expect(rollback).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
  });

  // The behaviour the stores were missing. The row vanished from the screen, the
  // delete failed, and the user believed it had worked until they reloaded.
  it('rolls back and reports when the database rejects the write', async () => {
    const rollback = vi.fn();

    const ok = await persist(
      'delete company',
      async () => ({ error: { message: 'violates foreign key constraint' } }),
      rollback,
    );

    expect(ok).toBe(false);
    expect(rollback).toHaveBeenCalledOnce();
    expect(reported).toEqual([['delete company', 'violates foreign key constraint']]);
  });

  it('rolls back and reports when the request never completes', async () => {
    const rollback = vi.fn();

    const ok = await persist(
      'add employee',
      () => Promise.reject(new Error('Failed to fetch')),
      rollback,
    );

    expect(ok).toBe(false);
    expect(rollback).toHaveBeenCalledOnce();
    expect(reported).toEqual([['add employee', 'Failed to fetch']]);
  });

  it('describes a non-Error rejection rather than showing undefined', async () => {
    await persist('add floor', () => Promise.reject('nope'), vi.fn());

    expect(reported[0][1]).toBe('Network error');
  });

  it('rolls back exactly once per failure', async () => {
    const rollback = vi.fn();

    await persist('a', async () => ({ error: { message: 'x' } }), rollback);
    await persist('b', async () => ({ error: { message: 'y' } }), rollback);

    expect(rollback).toHaveBeenCalledTimes(2);
  });
});
