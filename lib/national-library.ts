export type BookInfo = { title: string; totalPages: number | null };

export class BookLookupError extends Error {}

export async function fetchBookByIsbn(isbn: string, signal: AbortSignal): Promise<BookInfo | null> {
  const response = await fetch(`/api/books?isbn=${encodeURIComponent(isbn)}`, { signal });
  if (!response.ok) {
    throw new BookLookupError(response.status === 503
      ? "국립중앙도서관 조회가 아직 설정되지 않았습니다. 제목과 전체 쪽수를 직접 입력해 주세요."
      : "국립중앙도서관에서 도서 정보를 가져오지 못했습니다. 다시 조회하거나 직접 입력해 주세요.");
  }
  const data: { book: BookInfo | null } = await response.json();
  return data.book;
}

export function parseNationalLibraryBook(value: unknown): BookInfo {
  const book = value as Record<string, unknown>;
  const page = typeof book.PAGE === "string" ? book.PAGE.trim() : String(book.PAGE ?? "");
  const match = /^(\d+)\s*(?:p\.?|쪽)?$/i.exec(page);
  const totalPages = match ? Number(match[1]) : null;
  return {
    title: typeof book.TITLE === "string" ? book.TITLE.trim() : "",
    totalPages: totalPages !== null && Number.isSafeInteger(totalPages) && totalPages > 0 ? totalPages : null,
  };
}
