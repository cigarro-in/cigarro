// Module-level guard for automatic page reloads (chunk-recovery and
// service-worker updates). A reload while the login dialog is open wipes the
// in-flight OTP state, so the dialog sets this flag while it is open.
let reloadBlocked = false;

export function setReloadBlocked(blocked: boolean): void {
  reloadBlocked = blocked;
}

export function isReloadBlocked(): boolean {
  return reloadBlocked;
}
