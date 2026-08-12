import { SiteLogo } from "@/components/site-logo";

export default function AdminPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <SiteLogo />
        <h1 className="page-title">관리자</h1>
      </header>
      <main className="admin-main">
        <section className="admin-panel">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>관리자 페이지</h2>
          </div>
          <p>정적 배포본에서는 서버 권한 확인과 관리 기능을 제공하지 않습니다.</p>
        </section>
      </main>
    </div>
  );
}
