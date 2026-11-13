// Overview greeting. Phrases are short and warm, chosen by time of day.
// The page shows `${phrase}, ${firstName}` (for example "Back at it, Ahad").
// Keep phrases free of commas, question marks and full stops so the name
// reads naturally after them. Each list has exactly 20 entries (100 total).

export type DayPart = 'earlyMorning' | 'morning' | 'afternoon' | 'evening' | 'lateNight';

export const GREETINGS: Record<DayPart, readonly string[]> = {
  // 05:00 to 07:59
  earlyMorning: [
    'Up before the shutters',
    'Early start, good start',
    'Rise and shine',
    'The day is still fresh',
    'Quiet hours, good coffee',
    'Good to see you this early',
    'First light, first orders',
    'Up early and on it',
    'A calm start to the day',
    'Before the rush begins',
    'Morning and a clean slate',
    'Coffee first, then the shop',
    'The store is just waking up',
    'Early bird hours',
    'A fresh day and a fresh count',
    'Nice and early',
    'Ready when you are',
    'Morning light, open doors',
    'Let us get the day going',
    'Early hours suit you',
  ],
  // 08:00 to 11:59
  morning: [
    'Good morning',
    'Morning, and welcome back',
    'Hope your morning is off to a good start',
    'Let us make today a good one',
    'Ready for another good morning',
    'Back at it',
    'Things are moving nicely',
    'Hope the morning is treating you well',
    'Let us get things moving',
    'Lovely to see you this morning',
    'Good to have you back',
    'A steady morning ahead',
    'Let us see what the morning brings',
    'Good to see you',
    'All set for the morning',
    'Here we go again',
    'A busy morning or a quiet one',
    'Morning, let us get to work',
    'Your store is ready',
    'Glad you are here this morning',
  ],
  // 12:00 to 16:59
  afternoon: [
    'Good afternoon',
    'Hope your afternoon is going well',
    'Afternoon, and welcome back',
    'Halfway through the day',
    'Keeping the afternoon steady',
    'Hope lunch was good',
    'Still going strong',
    'Nice to see you this afternoon',
    'Afternoon check-in time',
    'The afternoon is yours',
    'Good to be back at it',
    'Let us keep the momentum going',
    'A good afternoon to you',
    'Looking good this afternoon',
    'Here is the store this afternoon',
    'Steady as ever this afternoon',
    'Plenty of afternoon left',
    'Good to see you again',
    'Afternoon update time',
    'Keep it going this afternoon',
  ],
  // 17:00 to 20:59
  evening: [
    'Good evening',
    'Winding down the day',
    'Hope your day went well',
    'Evening, nice work today',
    'Almost time to rest',
    'A good evening to you',
    'Evening check-in',
    'Wrapping up the day',
    'Welcome back this evening',
    'Nice to see you this evening',
    'Let us close the day well',
    'A calm evening ahead',
    'Good work today',
    'Evening, and well done',
    'Nearly there for the day',
    'Time to take stock',
    'The day is almost done',
    'Glad to see you this evening',
    'Evening, here is where things stand',
    'Easy does it this evening',
  ],
  // 21:00 to 04:59
  lateNight: [
    'Burning the midnight oil',
    'Late one tonight',
    'Still up and at it',
    'Quiet hours, good work',
    'Working late and we see you',
    'The store is asleep and you are not',
    'Late night check-in',
    'Night owl mode',
    'Still at it this late',
    'A quiet night to catch up',
    'Late night, steady hands',
    'Good to see you this late',
    'Dim lights, clear head',
    'Late hours, clear head',
    'Almost midnight, nice work',
    'Still going, and we respect that',
    'The night shift has begun',
    'Late, but glad you are here',
    'A quiet hour to plan',
    'Night is calm, let us go',
  ],
};

export function dayPartFor(hour: number): DayPart {
  if (hour >= 5 && hour < 8) return 'earlyMorning';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'lateNight';
}

/** FNV-1a, 32-bit. Stable across reloads and devices. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function localDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * The phrase for this moment. Deterministic per local day and time-of-day bucket:
 * the same phrase all day (within a bucket), a different one tomorrow.
 */
export function pickGreeting(now: Date): string {
  const part = dayPartFor(now.getHours());
  const list = GREETINGS[part];
  const index = hash(`${localDayKey(now)}|${part}`) % list.length;
  return list[index];
}

/** First word of a display name, or '' when there is none. */
export function firstNameOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : '';
}

/** "Back at it, Ahad", or just the phrase when no name is known. */
export function greetingTitle(now: Date, name?: string | null): string {
  const phrase = pickGreeting(now);
  const first = firstNameOf(name);
  return first ? `${phrase}, ${first}` : phrase;
}
