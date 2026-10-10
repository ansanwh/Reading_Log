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

export async function fetchBookByIsbn(isbn: string, signal: AbortSignal) {
  const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Library request failed: ${response.status}`);

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Open Library response");
  }

  const book = data as Record<string, unknown>;
  return {
    title: typeof book.title === "string" ? book.title.trim() : "",
    totalPages: typeof book.number_of_pages === "number" && Number.isSafeInteger(book.number_of_pages) && book.number_of_pages > 0
      ? book.number_of_pages
      : null,
  };
}
