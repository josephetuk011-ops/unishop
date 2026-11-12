// Detects contact and payment details typed into a negotiation chat.
// Accounts that share them are suspended automatically, so this errs on the side of catching more.
const spokenDigits: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };

export function detectContactInfo(input: string): { found: boolean; kind?: 'email' | 'phone or account number' } {
  const text = String(input || '').normalize('NFKC').toLowerCase();
  if (/[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\{at\})\s*[a-z0-9-]+/.test(text)) return { found: true, kind: 'email' };
  if (/[a-z0-9-]+\s+at\s+[a-z0-9-]+\s+(dot|\.)\s*[a-z]{2,}/.test(text) || /\b[a-z0-9-]{2,}\s*(\(dot\)|\[dot\]|\sdot\s)\s*(com|net|org|ng|co)\b/.test(text)) return { found: true, kind: 'email' };
  // Turn spelled-out digits into digits, then look for a run of 10 or more digits split by spaces or punctuation.
  const spoken = text.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (word) => ` ${spokenDigits[word]} `);
  const runs = spoken.match(/\+?\d(?:[\s.,\-_/()*#|:]*\d){9,}/g) || [];
  for (const run of runs) {
    const moneyFormat = /^\d{1,3}(,\d{3})+$/.test(run.trim());
    if (!moneyFormat && run.replace(/\D/g, '').length >= 10) return { found: true, kind: 'phone or account number' };
  }
  return { found: false };
}
