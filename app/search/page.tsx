import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const searchQuery = typeof q === "string" ? q.trim() : "";
  const target = searchQuery ? `/main?q=${encodeURIComponent(searchQuery)}` : "/main";

  redirect(target);
}
