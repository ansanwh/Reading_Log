"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { SiteLogo } from "@/components/site-logo";
import { isSuperAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [managedGroupNames, setManagedGroupNames] = useState<string[]>([]);
  const [managedGroups, setManagedGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [freeUsers, setFreeUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [temporaryAccountMessage, setTemporaryAccountMessage] = useState("");
  const [groupAdminMessage, setGroupAdminMessage] = useState("");
  const [groupCreationMessage, setGroupCreationMessage] = useState("");
  const [isAdminManagementOpen, setIsAdminManagementOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; isTemporary: boolean }>>([]);
  const [userManagementMessage, setUserManagementMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace(sitePath("main/"));
        return;
      }

      const hasGlobalAdminRole = isSuperAdminEmail(user.email);
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("role", "group_admin");
      const groupIds = (memberships ?? []).map((membership) => membership.group_id);
      if (!hasGlobalAdminRole && groupIds.length === 0) {
        window.location.replace(sitePath("main/"));
        return;
      }

      if (hasGlobalAdminRole || groupIds.length > 0) {
        let groupsQuery = supabase.from("groups").select("id,name").order("name");
        if (!hasGlobalAdminRole) groupsQuery = groupsQuery.in("id", groupIds);
        const { data: groups } = await groupsQuery;
        setManagedGroupNames((groups ?? []).map((group) => group.name));
        setManagedGroups((groups ?? []) as Array<{ id: string; name: string }>);
      }
      if (hasGlobalAdminRole) {
        const [{ data: profiles }, { data: allMemberships }] = await Promise.all([
          supabase.from("profiles").select("id,username").order("username"),
          supabase.from("group_members").select("user_id"),
        ]);
        const groupedUserIds = new Set((allMemberships ?? []).map((membership) => membership.user_id));
        setFreeUsers(((profiles ?? []) as Array<{ id: string; username: string }>).filter((profile) => !groupedUserIds.has(profile.id)));
      }
      setEmail(user.email ?? null);
      setDisplayName(user.user_metadata?.name ?? user.email ?? "관리자");
      setIsGlobalAdmin(hasGlobalAdminRole);
      setIsLoading(false);
    })();
  }, []);

  async function createTemporaryAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemporaryAccountMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(sitePath("api/temporary-accounts/"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: formData.get("group-id"), code: formData.get("code"), years: Number(formData.get("years")) }) });
    const result = await response.json() as { code?: string; expiresAt?: string; message?: string };
    setTemporaryAccountMessage(response.ok && result.code ? `임시 계정 코드: ${result.code} · 만료일 ${new Date(result.expiresAt!).toLocaleDateString("ko-KR")}` : result.message ?? "임시 계정을 만들지 못했습니다.");
  }

  async function setGroupAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupAdminMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(sitePath("api/group-admins/"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: formData.get("group-id"), publicId: formData.get("public-id") }) });
    const result = await response.json() as { message?: string };
    setGroupAdminMessage(result.message ?? "그룹 관리자 설정에 실패했습니다.");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupCreationMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(sitePath("api/groups/"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), kind: formData.get("kind") }) });
    const responseText = await response.text();
    const result = responseText ? JSON.parse(responseText) as { message?: string } : {};
    setGroupCreationMessage(result.message ?? "그룹을 만들지 못했습니다.");
    if (response.ok) window.setTimeout(() => window.location.reload(), 600);
  }

  async function loadUsers() {
    setUserManagementMessage("");
    const response = await fetch(sitePath("api/users/"));
    const result = await response.json() as { users?: Array<{ id: string; email: string; name: string; isTemporary: boolean }>; message?: string };
    if (!response.ok) {
      setUserManagementMessage(result.message ?? "사용자 목록을 불러오지 못했습니다.");
      return;
    }
    setUsers(result.users ?? []);
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("이 계정을 삭제할까요? 독서 기록과 그룹 소속 정보도 함께 삭제됩니다.")) return;
    const response = await fetch(sitePath("api/users/"), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const result = await response.json() as { message?: string };
    setUserManagementMessage(result.message ?? "계정을 삭제하지 못했습니다.");
    if (response.ok) setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
  }

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
          <p>{isGlobalAdmin ? "최고 관리자 권한으로 접근했습니다." : `그룹 관리자 권한으로 접근했습니다. 담당 그룹: ${managedGroupNames.join(", ")}`}</p>
        </section>
        <section className="admin-grid" aria-label="관리 항목">
          <article className="admin-card"><h3>검색 관리</h3><p>공개 독서 기록과 검색 노출 상태를 점검합니다.</p></article>
          <button className="admin-card admin-card-button" type="button" aria-expanded={isAdminManagementOpen} aria-controls="administrator-management" onClick={() => setIsAdminManagementOpen((isOpen) => !isOpen)}><h3>관리자 관리</h3><p>그룹 관리자와 최고 관리자 권한을 관리합니다.</p></button>
          {isGlobalAdmin ? <button className="admin-card admin-card-button" type="button" aria-expanded={isUserManagementOpen} aria-controls="user-management" onClick={() => { setIsUserManagementOpen((isOpen) => !isOpen); if (!isUserManagementOpen) void loadUsers(); }}><h3>사용자 관리</h3><p>사용자 계정을 조회하고 삭제합니다.</p></button> : <article className="admin-card"><h3>그룹 독서 기록 관리</h3><p>담당 그룹에 연결된 독서 기록장만 조회하고 관리할 수 있습니다.</p></article>}
        </section>
        {isGlobalAdmin && isUserManagementOpen ? <section id="user-management" className="admin-panel admin-actions">
          <div><p className="eyebrow">User management</p><h2>계정 삭제</h2></div>
          {userManagementMessage ? <p className={`auth-message${userManagementMessage === "계정을 삭제했습니다." ? " success" : ""}`}>{userManagementMessage}</p> : null}
          <div className="admin-user-list">{users.map((user) => <div className="admin-user-row" key={user.id}><span><strong>{user.isTemporary ? "임시 계정" : user.name || "사용자"}</strong><small>{user.email}</small></span><button className="delete-log-button" type="button" onClick={() => void deleteUser(user.id)}>계정 삭제</button></div>)}</div>
        </section> : null}
        {isAdminManagementOpen ? <div id="administrator-management">
        {isGlobalAdmin ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Administrator management</p><h2>그룹 만들기</h2></div>
          <form className="form" onSubmit={createGroup}>
            <label className="field"><span>그룹 이름</span><input name="name" required maxLength={80} placeholder="예: 1학년 3반" /></label>
            <label className="field"><span>유형</span><select name="kind" defaultValue="group"><option value="group">일반 그룹</option><option value="class">학급</option></select></label>
            {groupCreationMessage ? <p className={`auth-message${groupCreationMessage === "그룹을 만들었습니다." ? " success" : ""}`}>{groupCreationMessage}</p> : null}
            <button className="button" type="submit">그룹 만들기</button>
          </form>
        </section> : null}
        {managedGroups.length > 0 ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Temporary account</p><h2>임시 계정 만들기</h2></div>
          <form className="form" onSubmit={createTemporaryAccount}>
            <label className="field"><span>그룹</span><select name="group-id" required>{managedGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="field"><span>로그인 코드</span><input name="code" required inputMode="numeric" pattern="\d{1,5}" maxLength={5} placeholder="숫자 5자리 이하" /></label>
            <label className="field"><span>유지 기간</span><select name="years" defaultValue="1"><option value="1">1년</option><option value="2">2년</option><option value="3">3년</option></select></label>
            {temporaryAccountMessage ? <p className={`auth-message${temporaryAccountMessage.startsWith("임시 계정 코드") ? " success" : ""}`}>{temporaryAccountMessage}</p> : null}
            <button className="button" type="submit">코드 만들기</button>
          </form>
        </section> : null}
        {!isGlobalAdmin ? <p className="library-empty-state">그룹 관리자 권한은 임시 계정 만들기에서 사용할 수 있습니다.</p> : null}
        {isGlobalAdmin ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Administrator management</p><h2>그룹 관리자 임명</h2></div>
          {managedGroups.length > 0 ? <form className="form" onSubmit={setGroupAdmin}>
            <label className="field"><span>그룹</span><select name="group-id" required>{managedGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="field"><span>프리 유저</span><select name="public-id" required defaultValue=""><option value="" disabled>프리 유저 선택</option>{freeUsers.map((user) => <option key={user.id} value={user.username}>@{user.username}</option>)}</select></label>
            {groupAdminMessage ? <p className={`auth-message${groupAdminMessage === "그룹 관리자를 설정했습니다." ? " success" : ""}`}>{groupAdminMessage}</p> : null}
            <p className="account-public-id-help">공개 ID를 설정한 프리 유저만 임명할 수 있습니다. 임명되면 해당 그룹의 그룹 유저가 됩니다.</p>
            <button className="button" type="submit" disabled={freeUsers.length === 0}>그룹 관리자 임명</button>
          </form> : <p>임명할 그룹이 없습니다. 먼저 그룹을 만들어 주세요.</p>}
        </section> : null}
        </div> : null}
      </main>
    </div>
  );
}
