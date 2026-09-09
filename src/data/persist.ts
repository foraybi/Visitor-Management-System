/**
 * Optimistic writes that roll back and are seen when they fail.
 *
 * Nine call sites across the stores did this:
 *
 *   set(state => ({ companies: state.companies.filter(c => c.id !== id) }));
 *   supabase.from('companies').delete().eq('id', id)
 *     .then(({ error }) => { if (error) console.error(error) });
 *
 * The row disappears from the screen, the delete fails, the error goes to a
 * console nobody is watching, and the user believes it worked until they reload
 * and the row is back. Deleting a company, adding an employee and closing a
 * visit all behaved this way.
 *
 * `persist` keeps the optimistic update, which is what makes the interface feel
 * quick, and adds the two things it was missing: the local state is restored
 * when the write fails, and the failure is shown.
 */

export interface WriteError {
  message: string;
}

export interface WriteResult {
  error: WriteError | null;
}

type FailureReporter = (action: string, message: string) => void;

/**
 * How a failure reaches the user.
 *
 * Injected rather than imported so this module stays free of UI dependencies
 * and can be exercised in tests without a renderer. Defaults to the console,
 * which is no worse than what it replaces.
 */
let report: FailureReporter = (action, message) => {
  console.error(`[write failed] ${action}: ${message}`);
};

export function setWriteFailureReporter(reporter: FailureReporter): void {
  report = reporter;
}

/**
 * Run a write, undoing the optimistic update if it fails.
 *
 * @param action  What was attempted, as an i18n key or a short phrase. Shown to
 *                the user, so it should read as something they recognise doing.
 * @param write   The database call. Anything shaped like a Supabase result.
 * @param rollback Restores the state captured before the optimistic update.
 * @returns true when the write landed.
 */
export async function persist(
  action: string,
  write: () => PromiseLike<WriteResult>,
  rollback: () => void,
): Promise<boolean> {
  let result: WriteResult;

  try {
    result = await write();
  } catch (cause) {
    // A thrown error means the request never completed: offline, aborted, or a
    // client fault. Indistinguishable from a rejection as far as the user's data
    // is concerned, so it is handled the same way.
    rollback();
    report(action, cause instanceof Error ? cause.message : 'Network error');
    return false;
  }

  if (result.error) {
    rollback();
    report(action, result.error.message);
    return false;
  }

  return true;
}
