// Preferences are optional: blocked storage must not prevent the app loading.
export function readStoredPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The current React state still works; the preference won't survive reload.
  }
}
