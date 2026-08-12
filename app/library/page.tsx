import { redirect } from "next/navigation";
import { AccountProfile } from "@/components/account-profile";
import { LibraryContent, type ReadingLog } from "@/components/library-content";
import { SiteLogo } from "@/components/site-logo";
import { isAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

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
  final_summary: string | null;
  final_review: string | null;
  favorite_scene: string | null;
  favorite_scene_image: string | null;
  reading_log_entries: ReadingEntryRow[] | null;
};

function mapReadingLogRowToLog(log: ReadingLogRow): ReadingLog {
  return {
    id: log.id,
    title: log.title,
    totalPages: log.total_pages,
    isPublic: log.is_public,
    finalSummary: log.final_summary ?? "",
    finalReview: log.final_review ?? "",
    favoriteScene: log.favorite_scene ?? "",
    favoriteSceneImage: log.favorite_scene_image ?? "",
    entries: [...(log.reading_log_entries ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((entry) => ({
        id: entry.id,
        date: entry.entry_date,
        note: entry.note,
        currentPage: entry.current_page,
      })),
  };
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);
  if (!user) {
    redirect("/main");
  }

  const displayName = user.user_metadata?.name ?? user.email ?? "로그인됨";
  let initialReadingLogs: ReadingLog[] = [];

  const { data: logs } = await supabase
    .from("reading_logs")
    .select("id,title,total_pages,is_public,final_summary,final_review,favorite_scene,favorite_scene_image,reading_log_entries(id,entry_date,note,current_page,position)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  initialReadingLogs = ((logs ?? []) as ReadingLogRow[]).map(mapReadingLogRowToLog);

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">서재</h1>
        <AccountProfile displayName={displayName} email={user.email} isAdmin={isAdmin} />
      </header>

      <LibraryContent initialReadingLogs={initialReadingLogs} userId={user.id} />
    </div>
  );
}
