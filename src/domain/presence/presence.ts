/**
 * Who is currently inside the building.
 *
 * This existed in three places and two of them were silently broken: they built
 * the index on the identity number a visit was recorded under, then looked it up
 * by the employee number, so the lookup could never match and every employee
 * showed as never having visited.
 *
 * The interface is shaped so that mistake cannot be written again. Lookups take
 * an object with a `nationalityIdNumber` and nothing else, so passing an
 * employee number is a type error rather than a silent miss.
 */

/** The fields of a visit that presence actually reads. */
export interface PresenceVisit {
  visitorType: string;
  nationalityIdNumber: string;
  status: string;
  date: string;
  entryTime: string;
  exitTime: string | null;
}

/**
 * Anything identified by the identity number a visit is recorded under.
 * Deliberately narrow: an `Employee` satisfies it, an employee number does not.
 */
export interface IdentifiedByNumber {
  nationalityIdNumber: string;
}

export interface PresenceState {
  inside: boolean;
  everVisited: boolean;
  lastVisitDate: string | null;
  lastEntry: string | null;
  lastExit: string | null;
}

export interface PresenceIndex {
  isInside(who: IdentifiedByNumber): boolean;
  stateFor(who: IdentifiedByNumber): PresenceState;
  insideCount(): number;
}

const NEVER_VISITED: PresenceState = {
  inside: false,
  everVisited: false,
  lastVisitDate: null,
  lastEntry: null,
  lastExit: null,
};

/**
 * Historic rows predate identity normalisation on the way in, so both sides of
 * the comparison are trimmed rather than trusting stored spacing.
 */
function key(value: string): string {
  return (value ?? '').trim();
}

/**
 * Build the index once from a list of visits, then query it many times.
 *
 * Callers previously ran a linear scan per table row, which made a visitor
 * table O(rows × visits). One pass here, constant-time lookups after.
 */
export function presenceIndex(visits: readonly PresenceVisit[]): PresenceIndex {
  const states = new Map<string, PresenceState>();

  for (const visit of visits) {
    if (visit.visitorType !== 'employee') continue;

    const id = key(visit.nationalityIdNumber);
    if (id.length === 0) continue;

    const previous = states.get(id);
    // Entry times are ISO 8601, so lexicographic order is chronological order.
    if (previous && (previous.lastEntry ?? '') >= visit.entryTime) continue;

    states.set(id, {
      inside: visit.status === 'active',
      everVisited: true,
      lastVisitDate: visit.date,
      lastEntry: visit.entryTime,
      lastExit: visit.exitTime,
    });
  }

  let inside: number | null = null;

  return {
    isInside(who) {
      return states.get(key(who.nationalityIdNumber))?.inside ?? false;
    },

    stateFor(who) {
      return states.get(key(who.nationalityIdNumber)) ?? NEVER_VISITED;
    },

    insideCount() {
      if (inside === null) {
        inside = 0;
        for (const state of states.values()) {
          if (state.inside) inside += 1;
        }
      }
      return inside;
    },
  };
}
