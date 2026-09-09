"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { getReadingProgress, getReadingStatus, legacyPublicReadingLogSelect, PublicReadingLogDetail, publicReadingLogSelect, type PublicReadingLog } from "@/components/public-reading-log-detail";
import { SiteLogo } from "@/components/site-logo";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";

type Group = { id: string; name: string; kind: "group" | "class" };

export function GroupsPageContent() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [logs, setLogs] = useState<PublicReadingLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<PublicReadingLog | null>(null);
  const [authorIds, setAuthorIds] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("그룹을 불러오는 중입니다.");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("그룹방을 이용하려면 로그인해 주세요.");
        return;
      }
      setDisplayName(user.user_metadata?.name ?? user.email ?? "로그인됨");
      setEmail(user.email ?? null);
      const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "group_admin");
      setIsAdmin(isAdminEmail(user.email) || Boolean(count));
      const { data, error } = await supabase.from("groups").select("id,name,kind").order("name");
      if (error) {
        setMessage("그룹을 불러오지 못했습니다. 데이터베이스 설정을 확인해 주세요.");
        return;
      }
      const nextGroups = (data ?? []) as Group[];
      setGroups(nextGroups);
      setSelectedGroupId(nextGroups[0]?.id ?? null);
      setMessage(nextGroups.length === 0 ? "참여 중인 그룹이 없습니다." : "");
    })();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    const supabase = createClient();
    void (async () => {
      const primaryResult = await supabase.from("reading_logs").select(publicReadingLogSelect).eq("group_id", selectedGroupId).order("updated_at", { ascending: false });
      let data = primaryResult.data as PublicReadingLog[] | null;
      let error = primaryResult.error;

      if (error?.code === "42703") {
        const legacyResult = await supabase.from("reading_logs").select(legacyPublicReadingLogSelect).eq("group_id", selectedGroupId).order("updated_at", { ascending: false });
        data = legacyResult.data as PublicReadingLog[] | null;
        error = legacyResult.error;
      }

      if (error) {
        setMessage("그룹 독서 기록장을 불러오지 못했습니다.");
        return;
      }
      const nextLogs = (data ?? []) as PublicReadingLog[];
      setLogs(nextLogs);
      setSelectedLog(null);
      const userIds = [...new Set(nextLogs.map((log) => log.user_id))];
      const { data: profiles } = userIds.length > 0 ? await supabase.from("profiles").select("id,username").in("id", userIds) : { data: [] };
      setAuthorIds(Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile.username])));
      setMessage(nextLogs.length === 0 ? "이 그룹에 작성된 독서 기록장이 없습니다." : "");
    })();
  }, [selectedGroupId]);

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">그룹방</h1>
        {displayName ? <AccountProfile displayName={displayName} email={email} isAdmin={isAdmin} /> : <AuthActions />}
      </header>
      <main className="main main-search-results">
        {groups.length > 0 ? <section className="library-search" aria-label="그룹 선택"><label className="main-search-label" htmlFor="group-select">내 그룹</label><select id="group-select" value={selectedGroupId ?? ""} onChange={(event) => setSelectedGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.kind === "class" ? "학급 · " : "그룹 · "}{group.name}</option>)}</select></section> : null}
        {message ? <p className="library-empty-state">{message}</p> : null}
        <section className="public-search-results" aria-label="그룹 독서 기록장">
          {logs.map((log) => {
            const currentPage = (log.reading_log_entries ?? []).reduce((maximum, entry) => Math.max(maximum, entry.current_page), 0);
            const progress = getReadingProgress(currentPage, log.total_pages);
            const isSelected = selectedLog?.id === log.id;
            return <div className="public-search-result-group" key={log.id}><button className={`public-search-result${isSelected ? " active" : ""}`} type="button" aria-expanded={isSelected} onClick={() => setSelectedLog((current) => current?.id === log.id ? null : log)}><span><strong>{log.title}</strong><span className="search-result-author">작성자 {authorIds[log.user_id] ?? "익명"}</span><span className="search-result-status">{getReadingStatus(log)}</span></span><span className="public-search-progress">읽은 쪽수 {currentPage} / {log.total_pages} ({progress}%)</span></button>{isSelected ? <PublicReadingLogDetail log={log} authorId={authorIds[log.user_id]} /> : null}</div>;
          })}
        </section>
      </main>
    </div>
  );
}
