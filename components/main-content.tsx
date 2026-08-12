import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { SiteLogo } from "@/components/site-logo";
import { isAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

type MainContentProps = {
  searchQuery?: string;
};

type PublicReadingLogRow = {
  id: string;
  title: string;
  total_pages: number;
  final_summary: string;
  reading_log_entries: { current_page: number }[] | null;
};

function getProgress(currentPage: number, totalPages: number) {
  if (totalPages <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
}

export async function MainContent({ searchQuery = "" }: MainContentProps) {
  const normalizedSearchQuery = searchQuery.trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);
  const displayName = user?.user_metadata?.name ?? user?.email ?? "로그인됨";
  let query = supabase
    .from("reading_logs")
    .select("id,title,total_pages,final_summary,reading_log_entries(current_page)")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (normalizedSearchQuery) {
    query = query.ilike("title", `%${normalizedSearchQuery}%`);
  }

  const { data } = await query;
  const readingLogs = (data ?? []) as PublicReadingLogRow[];

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">검색</h1>
        <form className="main-search" role="search" action="/main">
          <label className="main-search-label" htmlFor="main-book-search">
            책 검색
          </label>
          <div className="main-search-row">
            <input
              id="main-book-search"
              name="q"
              type="search"
              defaultValue={normalizedSearchQuery}
              placeholder="공개된 독서 기록장 제목으로 검색"
            />
            <button className="button" type="submit">
              검색
            </button>
          </div>
        </form>
        {user ? (
          <AccountProfile displayName={displayName} email={user.email} isAdmin={isAdmin} />
        ) : (
          <AuthActions />
        )}
      </header>

      <main className="main main-search-results">
        <section className="public-search-results" aria-label="공개 독서 기록장 검색 결과">
          {readingLogs.length > 0 ? (
            readingLogs.map((log) => {
              const currentPage = (log.reading_log_entries ?? []).reduce(
                (maximum, entry) => Math.max(maximum, entry.current_page),
                0,
              );
              const progress = getProgress(currentPage, log.total_pages);

              return (
                <article className="public-search-result" key={log.id}>
                  <div>
                    <h2>{log.title}</h2>
                    {log.final_summary ? <p>{log.final_summary}</p> : null}
                  </div>
                  <p className="public-search-progress">
                    읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)
                  </p>
                </article>
              );
            })
          ) : (
            <p className="library-empty-state">
              {normalizedSearchQuery ? "검색 결과가 없습니다." : "공개된 독서 기록장이 아직 없습니다."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
