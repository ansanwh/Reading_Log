export function normalizeIsbn(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn(isbn: string) {
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const checksum = [...isbn].reduce((sum, digit, index) =>
      sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
    return checksum % 11 === 0;
  }

  if (/^97[89]\d{10}$/.test(isbn)) {
    const checksum = [...isbn].reduce((sum, digit, index) =>
      sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return checksum % 10 === 0;
  }

  return false;
}

export function toIsbn13(isbn: string) {
  if (isbn.length === 13) return isbn;
  const prefix = `978${isbn.slice(0, 9)}`;
  const checksum = [...prefix].reduce((sum, digit, index) =>
    sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${prefix}${(10 - checksum % 10) % 10}`;
}
