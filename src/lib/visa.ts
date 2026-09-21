/** Minimal Visa/card helpers — never store full PAN. */

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function luhnOk(cardNumber: string) {
  const digits = digitsOnly(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Visa cards start with 4. */
export function isVisa(cardNumber: string) {
  const digits = digitsOnly(cardNumber);
  return digits.startsWith("4") && digits.length >= 13 && digits.length <= 19;
}

export function expiryValid(expiry: string) {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const end = new Date(year, month, 0, 23, 59, 59);
  return end.getTime() >= Date.now();
}

export function cardLast4(cardNumber: string) {
  const digits = digitsOnly(cardNumber);
  return digits.slice(-4);
}
