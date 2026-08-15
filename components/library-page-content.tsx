"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { AuthActions } from "@/components/auth-actions";
import { LibraryContent, type Group, type ReadingLog } from "@/components/library-content";
import { SiteLogo } from "@/components/site-logo";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

type ReadingEntryRow = {
  id: string;
  entry_date: string;
  note: string;
  current_page: number;
  position: number;
};

type ReadingLogRow = {
  id: string;
  title: string;
  total_pages: number;
  is_public: boolean;
  group_id?: string | null;
  final_summary: string | null;
  final_review: string | null;
  favorite_scene: string | null;
  favorite_scene_image: string | null;
  reading_log_entries: ReadingEntryRow[] | null;
};

function mapReadingLog(log: ReadingLogRow): ReadingLog {
  return {
    id: log.id,
    title: log.title,
    totalPages: log.total_pages,
    isPublic: log.is_public,
    groupId: log.group_id ?? null,
    finalSummary: log.final_summary ?? "",
    finalReview: log.final_review ?? "",
    favoriteScene: log.favorite_scene ?? "",
    favoriteSceneImage: log.favorite_scene_image ?? "",
    entries: [...(log.reading_log_entries ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((entry) => ({ id: entry.id, date: entry.entry_date, note: entry.note, currentPage: entry.current_page })),
  };
}

export function LibraryPageContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isActive) return;
      if (!user) {
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      setDisplayName(user.user_metadata?.name ?? user.email ?? "로그인됨");
      setEmail(user.email ?? null);
      const isGlobalAdmin = isAdminEmail(user.email);
      const readingLogsQuery = () => supabase
        .from("reading_logs")
        .select("id,title,total_pages,is_public,group_id,final_summary,final_review,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const readingLogsResult = await readingLogsQuery();
      let data = readingLogsResult.data as ReadingLogRow[] | null;
      let loadError = readingLogsResult.error;

      // 학급 기능 마이그레이션 전에는 기존 컬럼만 조회해 서재를 계속 사용할 수 있게 한다.
      if (loadError?.code === "42703") {
        const legacyReadingLogsResult = await supabase
          .from("reading_logs")
          .select("id,title,total_pages,is_public,final_summary,final_review,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        data = legacyReadingLogsResult.data as ReadingLogRow[] | null;
        loadError = legacyReadingLogsResult.error;
      }

      const [{ data: classroomData }, { count: classAdminCount }] = await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "group_admin"),
      ]);

      if (!isActive) return;
      setIsAdmin(isGlobalAdmin || Boolean(classAdminCount));
      setReadingLogs(((data ?? []) as ReadingLogRow[]).map(mapReadingLog));
      setGroups((classroomData ?? []) as Group[]);
      setError(loadError ? "독서 기록장을 불러오지 못했습니다." : "");
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">서재</h1>
        {groups.length > 0 ? <a className="button secondary" href={sitePath("groups/")}>그룹방</a> : null}
        {userId ? <AccountProfile displayName={displayName} email={email} isAdmin={isAdmin} /> : <AuthActions />}
      </header>
      {isLoading ? <main className="library-main"><p className="library-empty-state">기록을 불러오는 중입니다.</p></main> : null}
      {!isLoading && !userId ? <main className="library-main"><p className="library-empty-state">서재를 사용하려면 로그인해 주세요.</p></main> : null}
      {!isLoading && userId && error ? <main className="library-main"><p className="library-error-state">{error}</p></main> : null}
      {!isLoading && userId && !error ? <LibraryContent initialReadingLogs={readingLogs} userId={userId} groups={groups} /> : null}
    </div>
  );
}
