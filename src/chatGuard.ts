// Detects bank account numbers typed into a negotiation chat.
// Accounts that share one are suspended automatically. Phone numbers and emails are allowed here;
// the no-calls-before-payment rule is shown as a warning and enforced by admin review.
const spokenDigits: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };

function looksLikePhone(digits: string): boolean {
  return (digits.length === 11 && /^0[789]\d{9}$/.test(digits)) || (digits.length === 13 && /^234[789]\d{9}$/.test(digits));
}

export function detectContactInfo(input: string): { found: boolean; kind?: 'account number' } {
  const text = String(input || '').normalize('NFKC').toLowerCase();
  // Turn spelled-out digits into digits, then look for a run of 10 or more digits split by spaces or punctuation.
  const spoken = text.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (word) => ` ${spokenDigits[word]} `);
  const runs = spoken.match(/\+?\d(?:[\s.,\-_/()*#|:]*\d){9,}/g) || [];
  for (const run of runs) {
    if (/^\d{1,3}(,\d{3})+$/.test(run.trim())) continue; // money such as 1,500,000
    const digits = run.replace(/\D/g, '');
    if (digits.length >= 10 && !looksLikePhone(digits)) return { found: true, kind: 'account number' };
  }
  return { found: false };
}
