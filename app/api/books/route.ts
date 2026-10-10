import { NextRequest, NextResponse } from "next/server";
import { isValidIsbn, normalizeIsbn, toIsbn13 } from "@/lib/isbn";
import { parseNationalLibraryBook } from "@/lib/national-library";

export async function GET(request: NextRequest) {
  const isbn = normalizeIsbn(request.nextUrl.searchParams.get("isbn") ?? "");
  if (!isValidIsbn(isbn)) {
    return NextResponse.json({ error: "INVALID_ISBN" }, { status: 400 });
  }
  const apiKey = process.env.NATIONAL_LIBRARY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "BOOK_LOOKUP_UNAVAILABLE" }, { status: 503 });
  }

  const isbn13 = toIsbn13(isbn);
  const url = new URL("https://www.nl.go.kr/seoji/SearchApi.do");
  url.search = new URLSearchParams({
    cert_key: apiKey, result_style: "json", page_no: "1", page_size: "10", isbn: isbn13,
  }).toString();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    if (!response.ok) throw new Error("Book lookup failed");
    const data: { docs?: unknown; TOTAL_COUNT?: unknown; total_count?: unknown } = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray(data.docs)) {
      if (data && Number(data.TOTAL_COUNT ?? data.total_count) === 0) {
        return NextResponse.json({ book: null });
      }
      throw new Error("Invalid book lookup response");
    }
    const matchingBook = data.docs.find((item: unknown) =>
      item !== null && typeof item === "object" &&
      normalizeIsbn(String((item as Record<string, unknown>).EA_ISBN ?? "")) === isbn13);
    return NextResponse.json({ book: matchingBook ? parseNationalLibraryBook(matchingBook) : null });
  } catch {
    return NextResponse.json({ error: "BOOK_LOOKUP_FAILED" }, { status: 502 });
  }
}
