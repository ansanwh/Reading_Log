"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { getReadingProgress, getReadingStatus, legacyPublicReadingLogSelect, PublicReadingLogDetail, publicReadingLogSelect, type PublicReadingLog } from "@/components/public-reading-log-detail";
import { SiteLogo } from "@/components/site-logo";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";

function getSearchTerm(value: string) {
  return value.trim().replace(/[,%_()]/g, " ");
}

export function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [excludeTitle, setExcludeTitle] = useState(false);
  const [excludeGenre, setExcludeGenre] = useState(false);
  const [excludeAuthor, setExcludeAuthor] = useState(false);
  const [readingLogs, setReadingLogs] = useState<PublicReadingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<PublicReadingLog | null>(null);
  const [authorIds, setAuthorIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q")?.trim() ?? "";
    setSearchQuery(query);
    setSubmittedQuery(query);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isActive) return;
      if (!user) {
        setIsAuthChecked(true);
        return;
      }

      setUserName(user.user_metadata?.name ?? user.email ?? "로그인됨");
      setUserEmail(user.email ?? null);
      setIsAuthChecked(true);

      const isGlobalAdmin = isAdminEmail(user.email);
      const { count: classAdminCount } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", "group_admin");
      if (!isActive) return;

      setIsAdmin(isGlobalAdmin || Boolean(classAdminCount));
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const searchTerm = getSearchTerm(submittedQuery);
    let isActive = true;
    setIsLoading(true);
    setLoadError("");

    void (async () => {
      const { error: ratingColumnError } = await supabase.from("reading_logs").select("final_rating").limit(1);
      const selectFields = ratingColumnError?.code === "42703" ? legacyPublicReadingLogSelect : publicReadingLogSelect;

      const createPublicLogsQuery = () => {
        let query = supabase.from("reading_logs").select(selectFields).eq("is_public", true).order("updated_at", { ascending: false });
        return query;
      };

      if (!searchTerm) {
        const { data, error } = await createPublicLogsQuery();
        if (!isActive) return;
        const logs = (data ?? []) as unknown as PublicReadingLog[];
        setReadingLogs(logs);
        await loadAuthorIds(logs);
        setLoadError(error ? "공개 독서 기록장을 불러오지 못했습니다." : "");
        setIsLoading(false);
        return;
      }

      const pattern = `%${searchTerm}%`;
      const searchableLogFields = [!excludeTitle ? `title.ilike.${pattern}` : "", !excludeGenre ? `genre.ilike.${pattern}` : ""].filter(Boolean);
      const logMatches = searchableLogFields.length > 0
        ? await createPublicLogsQuery().or(searchableLogFields.join(","))
        : { data: [], error: null };
      const authorMatches = !excludeAuthor
        ? await supabase.from("profiles").select("id").ilike("username", pattern)
        : { data: [], error: null };
      const matchingAuthorIds = [...new Set((authorMatches.data ?? []).map((profile) => profile.id))];
      const authorLogMatches = matchingAuthorIds.length > 0
        ? await createPublicLogsQuery().in("user_id", matchingAuthorIds)
        : { data: [], error: null };

      if (!isActive) return;
      const combinedLogs = [...(logMatches.data ?? []), ...(authorLogMatches.data ?? [])] as unknown as PublicReadingLog[];
      const uniqueLogs = [...new Map(combinedLogs.map((log) => [log.id, log])).values()];
      setReadingLogs(uniqueLogs);
      await loadAuthorIds(uniqueLogs);
      setLoadError(logMatches.error || authorMatches.error || authorLogMatches.error ? "검색 결과를 불러오지 못했습니다." : "");
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [submittedQuery, excludeTitle, excludeGenre, excludeAuthor]);

  async function loadAuthorIds(logs: PublicReadingLog[]) {
    const userIds = [...new Set(logs.map((log) => log.user_id))];
    if (userIds.length === 0) {
      setAuthorIds({});
      return;
    }

    const { data } = await createClient().from("profiles").select("id,username").in("id", userIds);
    setAuthorIds(Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.username])));
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchQuery.trim();
    const url = new URL(window.location.href);
    if (nextQuery) url.searchParams.set("q", nextQuery);
    else url.searchParams.delete("q");
    url.searchParams.delete("status");
    window.history.replaceState(null, "", url);
    setSubmittedQuery(nextQuery);
    setSelectedLog(null);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">검색</h1>
        <form className="main-search" role="search" onSubmit={submitSearch}>
          <label className="main-search-label" htmlFor="main-book-search">공개 독서 기록장 검색</label>
          <div className="main-search-row">
            <input id="main-book-search" name="q" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="제목, 장르, 작성자로 검색" />
            <button className="button" type="submit">검색</button>
          </div>
          <details className="advanced-search">
            <summary>상세 검색</summary>
            <div className="advanced-search-options">
              <label><input type="checkbox" checked={excludeTitle} onChange={(event) => { setExcludeTitle(event.target.checked); setSelectedLog(null); }} /> 제목 제외</label>
              <label><input type="checkbox" checked={excludeGenre} onChange={(event) => { setExcludeGenre(event.target.checked); setSelectedLog(null); }} /> 장르 제외</label>
              <label><input type="checkbox" checked={excludeAuthor} onChange={(event) => { setExcludeAuthor(event.target.checked); setSelectedLog(null); }} /> 작성자 제외</label>
            </div>
          </details>
        </form>
        {userName ? <AccountProfile displayName={userName} email={userEmail} isAdmin={isAdmin} /> : isAuthChecked ? <AuthActions openOnMount afterLogin="library" introText="로그인하면 바로 서재로 이동해 첫 기록을 시작할 수 있어요." /> : null}
      </header>

      <main className="main main-search-results">
        <section className="public-search-results" aria-label="공개 독서 기록장 검색 결과">
          {isLoading ? <p className="library-empty-state">기록을 불러오는 중입니다.</p> : null}
          {loadError ? <p className="library-error-state">{loadError}</p> : null}
          {!isLoading && !loadError && readingLogs.map((log) => {
            const currentPage = (log.reading_log_entries ?? []).reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);
            const progress = getReadingProgress(currentPage, log.total_pages);
            const isSelected = selectedLog?.id === log.id;
            return (
              <div className="public-search-result-group" key={log.id}>
                <button
                  className={`public-search-result${isSelected ? " active" : ""}`}
                  type="button"
                  aria-expanded={isSelected}
                  onClick={() => setSelectedLog((currentLog) => (currentLog?.id === log.id ? null : log))}
                >
                  <span>
                    <strong>{log.title}</strong>
                    <span className="search-result-author">작성자 {authorIds[log.user_id] ?? "익명"}</span>
                    {log.genre ? <span className="search-result-author">장르 {log.genre}</span> : null}
                    <span className="search-result-status">{getReadingStatus(log)}</span>
                    {log.final_summary ? <span>{log.final_summary}</span> : null}
                  </span>
                  <span className="public-search-progress">읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)</span>
                </button>
                {isSelected ? <PublicReadingLogDetail log={log} authorId={authorIds[log.user_id]} /> : null}
              </div>
            );
          })}
          {!isLoading && !loadError && readingLogs.length === 0 ? <p className="library-empty-state">{submittedQuery ? "검색 결과가 없습니다." : "공개된 독서 기록장이 아직 없습니다."}</p> : null}
        </section>

      </main>
    </div>
  );
}
