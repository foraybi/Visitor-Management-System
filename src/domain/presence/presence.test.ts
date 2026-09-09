import { describe, expect, it } from 'vitest';
import { presenceIndex, type PresenceVisit } from './presence';

/** A visit carrying only the fields presence actually reads. */
function visit(over: Partial<PresenceVisit> = {}): PresenceVisit {
  return {
    visitorType: 'employee',
    nationalityIdNumber: '1234567890',
    status: 'active',
    date: '2026-09-09',
    entryTime: '2026-09-09T08:00:00.000Z',
    exitTime: null,
    ...over,
  };
}

describe('presenceIndex', () => {
  it('reports an employee with an active visit as inside', () => {
    const index = presenceIndex([visit({ nationalityIdNumber: '1111111111' })]);
    expect(index.isInside({ nationalityIdNumber: '1111111111' })).toBe(true);
  });

  it('reports an employee who has checked out as not inside', () => {
    const index = presenceIndex([
      visit({ status: 'completed', exitTime: '2026-09-09T17:00:00.000Z' }),
    ]);
    expect(index.isInside({ nationalityIdNumber: '1234567890' })).toBe(false);
  });

  it('reports an employee with no visit at all as not inside', () => {
    const index = presenceIndex([]);
    expect(index.isInside({ nationalityIdNumber: '9999999999' })).toBe(false);
  });

  it('ignores visits by non-employees', () => {
    const index = presenceIndex([
      visit({ visitorType: 'visitor', nationalityIdNumber: '1111111111' }),
    ]);
    expect(index.isInside({ nationalityIdNumber: '1111111111' })).toBe(false);
    expect(index.stateFor({ nationalityIdNumber: '1111111111' }).everVisited).toBe(false);
  });

  describe('the join key', () => {
    // The whole reason this module exists. Two of the three previous copies
    // built their index on the identity number and then looked it up by the
    // employee number, so the lookup could never match and every employee
    // showed as never having visited.
    it('matches on the identity number the visit was recorded under', () => {
      const index = presenceIndex([visit({ nationalityIdNumber: '1029384756' })]);

      expect(index.isInside({ nationalityIdNumber: '1029384756' })).toBe(true);
      // An employee number is a different field and must not resolve.
      expect(index.isInside({ nationalityIdNumber: '0007' })).toBe(false);
    });
  });

  describe('stateFor', () => {
    it('describes an employee who has never visited', () => {
      expect(presenceIndex([]).stateFor({ nationalityIdNumber: '5555555555' })).toEqual({
        inside: false,
        everVisited: false,
        lastVisitDate: null,
        lastEntry: null,
        lastExit: null,
      });
    });

    it('reports the most recent visit when several exist', () => {
      const index = presenceIndex([
        visit({
          date: '2026-09-01',
          entryTime: '2026-09-01T08:00:00.000Z',
          exitTime: '2026-09-01T17:00:00.000Z',
          status: 'completed',
        }),
        visit({
          date: '2026-09-08',
          entryTime: '2026-09-08T09:00:00.000Z',
          exitTime: '2026-09-08T18:00:00.000Z',
          status: 'completed',
        }),
      ]);

      expect(index.stateFor({ nationalityIdNumber: '1234567890' })).toEqual({
        inside: false,
        everVisited: true,
        lastVisitDate: '2026-09-08',
        lastEntry: '2026-09-08T09:00:00.000Z',
        lastExit: '2026-09-08T18:00:00.000Z',
      });
    });

    it('does not let an older visit overwrite a newer one, whatever the input order', () => {
      const newest = visit({ date: '2026-09-08', entryTime: '2026-09-08T09:00:00.000Z' });
      const oldest = visit({
        date: '2026-09-01',
        entryTime: '2026-09-01T08:00:00.000Z',
        status: 'completed',
      });

      // An older visit arriving last must not win, and an active newer visit
      // must still report the employee as inside.
      expect(presenceIndex([newest, oldest]).stateFor({ nationalityIdNumber: '1234567890' }))
        .toMatchObject({ lastVisitDate: '2026-09-08', inside: true });
      expect(presenceIndex([oldest, newest]).stateFor({ nationalityIdNumber: '1234567890' }))
        .toMatchObject({ lastVisitDate: '2026-09-08', inside: true });
    });
  });

  describe('normalisation', () => {
    // Historic rows were written before identity numbers were normalised on the
    // way in, so the index has to tolerate stray spacing on either side.
    it('matches across incidental whitespace', () => {
      const index = presenceIndex([visit({ nationalityIdNumber: ' 1234567890 ' })]);
      expect(index.isInside({ nationalityIdNumber: '1234567890' })).toBe(true);
    });

    it('ignores a visit with no identity number rather than indexing an empty key', () => {
      const index = presenceIndex([visit({ nationalityIdNumber: '' })]);
      expect(index.stateFor({ nationalityIdNumber: '' }).everVisited).toBe(false);
    });
  });

  it('counts everyone currently inside', () => {
    const index = presenceIndex([
      visit({ nationalityIdNumber: '1111111111', status: 'active' }),
      visit({ nationalityIdNumber: '2222222222', status: 'active' }),
      visit({ nationalityIdNumber: '3333333333', status: 'completed' }),
    ]);
    expect(index.insideCount()).toBe(2);
  });
});
