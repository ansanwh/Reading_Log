import { MainContent } from "@/components/main-content";

type HomeProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const searchQuery = typeof q === "string" ? q : "";

  return <MainContent searchQuery={searchQuery} />;
}
