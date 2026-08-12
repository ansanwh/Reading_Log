"use client";

import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { SiteLogo } from "@/components/site-logo";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    void createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user || !isAdminEmail(user.email)) {
        window.location.replace(sitePath("main/"));
        return;
      }

      setEmail(user.email ?? null);
      setDisplayName(user.user_metadata?.name ?? user.email ?? "관리자");
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return <main className="library-main"><p className="library-empty-state">관리자 권한을 확인하고 있습니다.</p></main>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">관리자</h1>
        <AccountProfile displayName={displayName} email={email} isAdmin />
      </header>
      <main className="admin-main">
        <section className="admin-panel">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>관리자 페이지</h2>
          </div>
          <p>admin1@seojae.kr 계정으로 관리자 접근이 확인되었습니다.</p>
        </section>
        <section className="admin-grid" aria-label="관리 항목">
          <article className="admin-card"><h3>책 공개 관리</h3><p>공개 독서 기록과 검색 노출 상태를 점검합니다.</p></article>
          <article className="admin-card"><h3>검색 관리</h3><p>공개 검색 결과와 노출 상태를 확인합니다.</p></article>
          <article className="admin-card"><h3>사용자 기록 관리</h3><p>사용자 기록 관리 범위를 확장할 수 있습니다.</p></article>
        </section>
      </main>
    </div>
  );
}
