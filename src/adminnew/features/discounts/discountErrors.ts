import { toActionError, type ActionError } from '../../ui/Button';

const MESSAGES: Record<string, string> = {
  CODE_TAKEN: 'Another discount already uses this code. Pick a different code.',
  NOT_DISCOUNT_ADMIN: 'Only store admins can manage discounts.',
  NOT_FOUND: 'This discount no longer exists. It may have been deleted.',
  DISCOUNT_NOT_FOR_CUSTOMER: 'This discount is only for selected customers.',
};

/** Plain-English error for discount mutations; keeps the Convex code visible. */
export function discountError(err: unknown): ActionError {
  const e = toActionError(err);
  return { message: (e.code && MESSAGES[e.code]) || e.message, code: e.code };
}
