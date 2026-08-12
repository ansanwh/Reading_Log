import { MainContent } from "@/components/main-content";

type MainPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function MainPage({ searchParams }: MainPageProps) {
  const { q } = await searchParams;
  const searchQuery = typeof q === "string" ? q : "";

  return <MainContent searchQuery={searchQuery} />;
}
