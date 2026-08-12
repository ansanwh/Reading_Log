"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { SiteLogo } from "@/components/site-logo";
import { createClient } from "@/lib/supabase/browser";

type ReadingStatus = "reading" | "finished";

type PublicReadingEntry = {
  id: string;
  entry_date: string;
  note: string;
  current_page: number;
  position: number;
};

type PublicReadingLog = {
  id: string;
  title: string;
  total_pages: number;
  final_summary: string | null;
  final_review: string | null;
  favorite_scene: string | null;
  favorite_scene_image: string | null;
  reading_log_entries: PublicReadingEntry[] | null;
};

const publicLogSelect = "id,title,total_pages,final_summary,final_review,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)";

function getProgress(currentPage: number, totalPages: number) {
  return totalPages > 0 ? Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100))) : 0;
}

function getStatusLabel(status: ReadingStatus) {
  return status === "finished" ? "완독" : "읽는 중";
}

function getReadingStatus(log: PublicReadingLog): ReadingStatus {
  const currentPage = (log.reading_log_entries ?? []).reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);

  return log.total_pages > 0 && currentPage >= log.total_pages ? "finished" : "reading";
}

function getSearchTerm(value: string) {
  return value.trim().replace(/[,%_()]/g, " ");
}

export function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReadingStatus>("all");
  const [readingLogs, setReadingLogs] = useState<PublicReadingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<PublicReadingLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (isActive && user) {
        setUserName(user.user_metadata?.name ?? user.email ?? "로그인됨");
        setUserEmail(user.email ?? null);
      }
    });

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
        let query = supabase.from("reading_logs").select(publicLogSelect).eq("is_public", true).order("updated_at", { ascending: false });
        return query;
      };

      if (!searchTerm) {
        const { data, error } = await createPublicLogsQuery();
        if (!isActive) return;
        setReadingLogs(((data ?? []) as PublicReadingLog[]).filter((log) => statusFilter === "all" || getReadingStatus(log) === statusFilter));
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
      setReadingLogs(uniqueLogs.filter((log) => statusFilter === "all" || getReadingStatus(log) === statusFilter));
      setLoadError(logMatches.error || entryMatches.error || entryLogMatches.error ? "검색 결과를 불러오지 못했습니다." : "");
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [submittedQuery, statusFilter]);

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

  const selectedEntries = [...(selectedLog?.reading_log_entries ?? [])].sort((a, b) => a.position - b.position);
  const selectedCurrentPage = selectedEntries.reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);

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
        {userName ? <AccountProfile displayName={userName} email={userEmail} /> : <AuthActions />}
      </header>

      <main className="main main-search-results">
        <section className="public-search-results" aria-label="공개 독서 기록장 검색 결과">
          {isLoading ? <p className="library-empty-state">기록을 불러오는 중입니다.</p> : null}
          {loadError ? <p className="library-error-state">{loadError}</p> : null}
          {!isLoading && !loadError && readingLogs.map((log) => {
            const currentPage = (log.reading_log_entries ?? []).reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);
            const progress = getProgress(currentPage, log.total_pages);
            return (
              <button className="public-search-result" type="button" key={log.id} onClick={() => setSelectedLog(log)}>
                <span>
                  <strong>{log.title}</strong>
                  <span className="search-result-status">{getStatusLabel(getReadingStatus(log))}</span>
                  {log.final_summary ? <span>{log.final_summary}</span> : null}
                </span>
                <span className="public-search-progress">읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)</span>
              </button>
            );
          })}
          {!isLoading && !loadError && readingLogs.length === 0 ? <p className="library-empty-state">{submittedQuery || statusFilter !== "all" ? "검색 결과가 없습니다." : "공개된 독서 기록장이 아직 없습니다."}</p> : null}
        </section>

        {selectedLog ? (
          <section className="public-log-detail" aria-label={`${selectedLog.title} 공개 독서 기록`}>
            <div className="public-log-detail-head">
              <div>
                <p className="eyebrow">공개 독서 기록</p>
                <h2>{selectedLog.title}</h2>
                <p>{getStatusLabel(getReadingStatus(selectedLog))} · 읽은 쪽수 {selectedCurrentPage} / {selectedLog.total_pages} ({getProgress(selectedCurrentPage, selectedLog.total_pages)}%)</p>
              </div>
              <button className="button compact secondary" type="button" onClick={() => setSelectedLog(null)}>닫기</button>
            </div>
            {selectedEntries.map((entry) => <article className="public-log-entry" key={entry.id}><h3>{entry.entry_date} · {entry.current_page}쪽</h3><p>{entry.note || "기록 없음"}</p></article>)}
            {selectedLog.final_summary ? <article className="public-log-entry"><h3>내용 간단 요약</h3><p>{selectedLog.final_summary}</p></article> : null}
            {selectedLog.final_review ? <article className="public-log-entry"><h3>최종 감상평</h3><p>{selectedLog.final_review}</p></article> : null}
            {selectedLog.favorite_scene ? <article className="public-log-entry"><h3>가장 좋아하는 장면</h3><p>{selectedLog.favorite_scene}</p></article> : null}
            {selectedLog.favorite_scene_image ? <img className="public-log-image" src={selectedLog.favorite_scene_image} alt={`${selectedLog.title}에서 좋아하는 장면`} /> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
