// Focused check for the MSG91 OTP fix:
// 1. _headers connect-src must allow https://api.msg91.com (the widget POSTs
//    to https://api.msg91.com/api/v5/widget/sendOtp; without it the browser
//    blocks the call with "Http failure response ... 0 Unknown Error").
// 2. Send-OTP failures must stay on the phone step (no setStep in onFailed),
//    surface an actionable inline error with a Retry action, and keep
//    accessible title/description semantics on both dialog variants.
// Run: node scripts/check-otp-csp.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures.push(name);
};

const headers = readFileSync(join(root, '_headers'), 'utf8');
const csp = headers.split('\n').find((l) => l.includes('Content-Security-Policy:')) ?? '';
const connect = (csp.match(/connect-src[^;]*/)?.[0] ?? '');
check('connect-src allows https://api.msg91.com', connect.includes('https://api.msg91.com'));
check('connect-src still allows https://control.msg91.com', connect.includes('https://control.msg91.com'));

const src = readFileSync(join(root, 'src/components/auth/PhoneAuthDialog.tsx'), 'utf8');
const onFailedBlocks = [...src.matchAll(/onFailed:\s*\(msg\)\s*=>\s*\{([\s\S]*?)\n\s*\},/g)].map((m) => m[1]);
check('send onFailed handlers exist (send + resend)', onFailedBlocks.length >= 2);
check('send failures never advance step (no setStep in onFailed)', onFailedBlocks.every((b) => !b.includes('setStep')));
check('send failures map to actionable message', src.includes('friendlySendFailureMessage(msg)'));
check('CSP/unknown-error text mapped to plain language', /0 unknown error/.test(src.toLowerCase()));
check('phone step shows inline error with Retry', src.includes('InlineAuthError error={authError} onRetry={sendOtpNow} retryLabel="Retry"'));
check('global onError wired to step-aware handler', src.includes('onError: handleWidgetError'));
check('handler tracks current step for global failures', /stepRef\.current\s*=\s*step/.test(src));

// Global MSG91 widget failures (singleton dispatcher → onError) can carry a
// send failure while still on the phone step. That branch must stay on phone
// (early return, actionable message) instead of forcing setStep('otp').
const phoneBranch = src.match(/if \(stepRef\.current === 'phone'[\s\S]*?return;/);
check('phone-step global send failure stays phone (no forced otp step)', !!phoneBranch && !phoneBranch[0].includes('setStep'));
check('phone-step global failure uses actionable message', !!phoneBranch && phoneBranch[0].includes('friendlySendFailureMessage'));
check('verification errors still route to otp step', src.includes("setStep('otp')"));

// The global path lives in the widget singleton: failures forward through the
// claimed dispatcher to onError (not only sendOTP's local onFailed).
const widget = readFileSync(join(root, 'src/hooks/useOTPWidget.ts'), 'utf8');
check('widget dispatcher forwards global failures to onError', widget.includes('activeCallbacks?.failure') && widget.includes('onErrorRef'));
check('verify failures route via claimed dispatcher', widget.includes('claimed(err)') || (widget.includes('activeCallbacks?.failure') && widget.includes('verifyOtp')));
check('mobile drawer keeps Title + Description', src.includes('Drawer.Title') && src.includes('Drawer.Description'));
check('desktop dialog keeps Title + Description', src.includes('DialogTitle') && src.includes('DialogDescription'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll OTP CSP/UX checks passed');
