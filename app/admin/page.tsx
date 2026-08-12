import { redirect } from "next/navigation";
import { AccountProfile } from "@/components/account-profile";
import { SiteLogo } from "@/components/site-logo";
import { isAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);

  if (!user || !isAdmin) {
    redirect("/main");
  }

  const displayName = user.user_metadata?.name ?? user.email ?? "관리자";

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">관리자</h1>
        <AccountProfile displayName={displayName} email={user.email} isAdmin={isAdmin} />
      </header>

      <main className="admin-main">
        <section className="admin-panel">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>관리자 페이지</h2>
          </div>
          <p>
            공개된 독서 기록장, 검색 노출 상태, 사용자 기록 관리 기능을 이 페이지에서 확장할 예정입니다.
          </p>
        </section>

        <section className="admin-grid" aria-label="관리 항목">
          <article className="admin-card">
            <h3>책 공개 관리</h3>
            <p>메인 검색 결과에 노출되는 책과 비공개 책을 확인하고 관리합니다.</p>
          </article>
          <article className="admin-card">
            <h3>검색 관리</h3>
            <p>공개 책 검색 결과와 검색 대상 필드를 점검합니다.</p>
          </article>
          <article className="admin-card">
            <h3>사용자 기록 관리</h3>
            <p>사용자별 독서 기록 저장과 접근 정책을 확인합니다.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
