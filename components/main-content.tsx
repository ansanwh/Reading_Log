"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { getReadingProgress, getReadingStatus, PublicReadingLogDetail, publicReadingLogSelect, type PublicReadingLog } from "@/components/public-reading-log-detail";
import { SiteLogo } from "@/components/site-logo";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";

type ReadingStatus = "reading" | "finished";

function getSearchTerm(value: string) {
  return value.trim().replace(/[,%_()]/g, " ");
}

export function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReadingStatus>("all");
  const [readingLogs, setReadingLogs] = useState<PublicReadingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<PublicReadingLog | null>(null);
  const [authorIds, setAuthorIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q")?.trim() ?? "";
    const status = params.get("status");
    setSearchQuery(query);
    setSubmittedQuery(query);
    if (status === "reading" || status === "finished") {
      setStatusFilter(status);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isActive || !user) return;

      const isGlobalAdmin = isAdminEmail(user.email);
      const { count: classAdminCount } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("role", "group_admin");
      if (!isActive) return;

      setUserName(user.user_metadata?.name ?? user.email ?? "로그인됨");
      setUserEmail(user.email ?? null);
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
      const createPublicLogsQuery = () => {
        let query = supabase.from("reading_logs").select(publicReadingLogSelect).eq("is_public", true).order("updated_at", { ascending: false });
        return query;
      };

      if (!searchTerm) {
        const { data, error } = await createPublicLogsQuery();
        if (!isActive) return;
        const logs = ((data ?? []) as PublicReadingLog[]).filter((log) => statusFilter === "all" || (getReadingStatus(log) === "완독" ? "finished" : "reading") === statusFilter);
        setReadingLogs(logs);
        await loadAuthorIds(logs);
        setLoadError(error ? "공개 독서 기록장을 불러오지 못했습니다." : "");
        setIsLoading(false);
        return;
      }

      const pattern = `%${searchTerm}%`;
      const [logMatches, entryMatches] = await Promise.all([
        createPublicLogsQuery().or(`title.ilike.${pattern},final_summary.ilike.${pattern},final_review.ilike.${pattern},favorite_scene.ilike.${pattern}`),
        supabase.from("reading_log_entries").select("reading_log_id").ilike("note", pattern),
      ]);
      const matchingEntryLogIds = [...new Set((entryMatches.data ?? []).map((entry) => entry.reading_log_id))];
      const entryLogMatches = matchingEntryLogIds.length > 0
        ? await createPublicLogsQuery().in("id", matchingEntryLogIds)
        : { data: [], error: null };

      if (!isActive) return;
      const combinedLogs = [...(logMatches.data ?? []), ...(entryLogMatches.data ?? [])] as PublicReadingLog[];
      const uniqueLogs = [...new Map(combinedLogs.map((log) => [log.id, log])).values()];
      const logs = uniqueLogs.filter((log) => statusFilter === "all" || (getReadingStatus(log) === "완독" ? "finished" : "reading") === statusFilter);
      setReadingLogs(logs);
      await loadAuthorIds(logs);
      setLoadError(logMatches.error || entryMatches.error || entryLogMatches.error ? "검색 결과를 불러오지 못했습니다." : "");
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [submittedQuery, statusFilter]);

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
    if (statusFilter === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", statusFilter);
    window.history.replaceState(null, "", url);
    setSubmittedQuery(nextQuery);
    setSelectedLog(null);
  }

  function changeStatusFilter(nextStatus: "all" | ReadingStatus) {
    setStatusFilter(nextStatus);
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
            <input id="main-book-search" name="q" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="제목, 메모, 요약, 감상으로 검색" />
            <button className="button" type="submit">검색</button>
          </div>
          <select className="search-status-filter" aria-label="공개 독서 기록 상태 필터" value={statusFilter} onChange={(event) => changeStatusFilter(event.target.value as "all" | ReadingStatus)}>
            <option value="all">전체 상태</option>
            <option value="reading">읽는 중</option>
            <option value="finished">완독</option>
          </select>
        </form>
        {userName ? <AccountProfile displayName={userName} email={userEmail} isAdmin={isAdmin} /> : <AuthActions />}
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
                    <span className="search-result-status">{getReadingStatus(log)}</span>
                    {log.final_summary ? <span>{log.final_summary}</span> : null}
                  </span>
                  <span className="public-search-progress">읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)</span>
                </button>
                {isSelected ? <PublicReadingLogDetail log={log} authorId={authorIds[log.user_id]} /> : null}
              </div>
            );
          })}
          {!isLoading && !loadError && readingLogs.length === 0 ? <p className="library-empty-state">{submittedQuery || statusFilter !== "all" ? "검색 결과가 없습니다." : "공개된 독서 기록장이 아직 없습니다."}</p> : null}
        </section>

      </main>
    </div>
  );
}
