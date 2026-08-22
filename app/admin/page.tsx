"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AccountProfile } from "@/components/account-profile";
import { SiteLogo } from "@/components/site-logo";
import { isSuperAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

type ManagementPanel = "search" | "admin" | "users";
type GroupAdmin = { groupId: string; userId: string; username: string };
type PublicReadingLog = { id: string; title: string; author: string; updatedAt: string };

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [managedGroupNames, setManagedGroupNames] = useState<string[]>([]);
  const [managedGroups, setManagedGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [freeUsers, setFreeUsers] = useState<Array<{ id: string; username: string }>>([]);
  const [groupAdmins, setGroupAdmins] = useState<GroupAdmin[]>([]);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [temporaryAccountMessage, setTemporaryAccountMessage] = useState("");
  const [groupAdminMessage, setGroupAdminMessage] = useState("");
  const [groupCreationMessage, setGroupCreationMessage] = useState("");
  const [groupDeletionMessage, setGroupDeletionMessage] = useState("");
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ManagementPanel | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; isTemporary: boolean }>>([]);
  const [userManagementMessage, setUserManagementMessage] = useState("");
  const [publicLogs, setPublicLogs] = useState<PublicReadingLog[]>([]);
  const [searchManagementMessage, setSearchManagementMessage] = useState("");
  const [isPublicLogsLoading, setIsPublicLogsLoading] = useState(false);
  const [hidingLogId, setHidingLogId] = useState<string | null>(null);

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
          supabase.from("group_members").select("group_id,user_id,role"),
        ]);
        const typedProfiles = (profiles ?? []) as Array<{ id: string; username: string }>;
        const usernames = new Map(typedProfiles.map((profile) => [profile.id, profile.username]));
        const groupedUserIds = new Set((allMemberships ?? []).map((membership) => membership.user_id));
        setFreeUsers(typedProfiles.filter((profile) => !groupedUserIds.has(profile.id)));
        setGroupAdmins((allMemberships ?? []).filter((membership) => membership.role === "group_admin").map((membership) => ({ groupId: membership.group_id, userId: membership.user_id, username: usernames.get(membership.user_id) ?? "사용자" })));
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
    if (response.ok) window.setTimeout(() => window.location.reload(), 600);
  }

  async function removeGroupAdmin(admin: GroupAdmin) {
    const groupName = managedGroups.find((group) => group.id === admin.groupId)?.name ?? "이 그룹";
    if (!window.confirm(`@${admin.username} 님을 '${groupName}' 그룹 관리자에서 해임할까요?\n계정과 개인 독서 기록은 유지됩니다.`)) return;
    setGroupAdminMessage("");
    const response = await fetch(sitePath("api/group-admins/"), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: admin.groupId, userId: admin.userId }) });
    const result = await response.json() as { message?: string };
    setGroupAdminMessage(result.message ?? "그룹 관리자를 해임하지 못했습니다.");
    if (response.ok) {
      setGroupAdmins((admins) => admins.filter((item) => item.groupId !== admin.groupId || item.userId !== admin.userId));
      setFreeUsers((users) => [...users, { id: admin.userId, username: admin.username }].sort((a, b) => a.username.localeCompare(b.username, "ko")));
    }
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

  async function deleteGroup(group: { id: string; name: string }) {
    if (!window.confirm(`'${group.name}' 그룹을 삭제할까요?\n\n그룹 소속은 해제되고, 이 그룹의 임시 계정과 해당 계정의 독서 기록은 함께 삭제됩니다.`)) return;
    setGroupDeletionMessage("");
    setDeletingGroupId(group.id);
    const response = await fetch(sitePath("api/groups/"), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: group.id }) });
    const result = await response.json() as { message?: string };
    setGroupDeletionMessage(result.message ?? "그룹을 삭제하지 못했습니다.");
    if (response.ok) {
      const releasedAdmins = groupAdmins.filter((admin) => admin.groupId === group.id);
      setManagedGroups((groups) => groups.filter((item) => item.id !== group.id));
      setManagedGroupNames((names) => names.filter((name) => name !== group.name));
      setGroupAdmins((admins) => admins.filter((admin) => admin.groupId !== group.id));
      setFreeUsers((users) => [...new Map([...users, ...releasedAdmins.map((admin) => ({ id: admin.userId, username: admin.username }))].map((user) => [user.id, user])).values()].sort((a, b) => a.username.localeCompare(b.username, "ko")));
    }
    setDeletingGroupId(null);
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

  async function loadPublicLogs() {
    setSearchManagementMessage("");
    setIsPublicLogsLoading(true);
    const response = await fetch(sitePath("api/public-reading-logs/"));
    const result = await response.json() as { logs?: PublicReadingLog[]; message?: string };
    if (!response.ok) {
      setSearchManagementMessage(result.message ?? "공개 독서 기록을 불러오지 못했습니다.");
      setIsPublicLogsLoading(false);
      return;
    }
    setPublicLogs(result.logs ?? []);
    setIsPublicLogsLoading(false);
  }

  async function makeLogPrivate(log: PublicReadingLog) {
    if (!window.confirm(`'${log.title}' 독서 기록을 검색에서 숨기고 비공개로 전환할까요?`)) return;
    setSearchManagementMessage("");
    setHidingLogId(log.id);
    const response = await fetch(sitePath("api/public-reading-logs/"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logId: log.id }) });
    const result = await response.json() as { message?: string };
    setSearchManagementMessage(result.message ?? "독서 기록을 비공개로 전환하지 못했습니다.");
    if (response.ok) setPublicLogs((logs) => logs.filter((item) => item.id !== log.id));
    setHidingLogId(null);
  }

  function togglePanel(panel: ManagementPanel) {
    const willOpen = activePanel !== panel;
    setActivePanel(willOpen ? panel : null);
    if (willOpen && panel === "users") void loadUsers();
    if (willOpen && panel === "search") void loadPublicLogs();
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("이 계정을 삭제할까요? 독서 기록과 그룹 소속 정보도 함께 삭제됩니다.")) return;
    const response = await fetch(sitePath("api/users/"), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const result = await response.json() as { message?: string };
    setUserManagementMessage(result.message ?? "계정을 삭제하지 못했습니다.");
    if (response.ok) {
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
      setGroupAdmins((admins) => admins.filter((admin) => admin.userId !== userId));
      setFreeUsers((freeUsers) => freeUsers.filter((user) => user.id !== userId));
    }
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
          {isGlobalAdmin ? <button className="admin-card admin-card-button" type="button" aria-expanded={activePanel === "search"} aria-controls="search-management" onClick={() => togglePanel("search")}><h3>검색 관리</h3><p>공개 독서 기록을 확인하고 비공개로 전환합니다.</p></button> : null}
          <button className="admin-card admin-card-button" type="button" aria-expanded={activePanel === "admin"} aria-controls="administrator-management" onClick={() => togglePanel("admin")}><h3>관리자 관리</h3><p>그룹, 임시 계정과 그룹 관리자를 통합 관리합니다.</p></button>
          {isGlobalAdmin ? <button className="admin-card admin-card-button" type="button" aria-expanded={activePanel === "users"} aria-controls="user-management" onClick={() => togglePanel("users")}><h3>사용자 관리</h3><p>사용자 계정을 조회하고 삭제합니다.</p></button> : null}
        </section>

        {isGlobalAdmin && activePanel === "search" ? <section id="search-management" className="admin-panel admin-actions">
          <div><p className="eyebrow">Search management</p><h2>공개 독서 기록 관리</h2></div>
          {searchManagementMessage ? <p className={`auth-message${searchManagementMessage === "독서 기록을 비공개로 전환했습니다." ? " success" : ""}`}>{searchManagementMessage}</p> : null}
          {isPublicLogsLoading ? <p className="library-empty-state">공개 독서 기록을 불러오는 중입니다.</p> : null}
          <div className="admin-user-list">{publicLogs.map((log) => <div className="admin-user-row" key={log.id}><span><strong>{log.title}</strong><small>작성자 @{log.author} · 최근 수정 {new Date(log.updatedAt).toLocaleDateString("ko-KR")}</small></span><button className="delete-log-button" type="button" disabled={hidingLogId !== null} onClick={() => void makeLogPrivate(log)}>{hidingLogId === log.id ? "전환 중..." : "비공개 전환"}</button></div>)}</div>
          {!isPublicLogsLoading && publicLogs.length === 0 && !searchManagementMessage ? <p className="library-empty-state">공개된 독서 기록이 없습니다.</p> : null}
        </section> : null}

        {isGlobalAdmin && activePanel === "users" ? <section id="user-management" className="admin-panel admin-actions">
          <div><p className="eyebrow">User management</p><h2>계정 삭제</h2></div>
          {userManagementMessage ? <p className={`auth-message${userManagementMessage === "계정을 삭제했습니다." ? " success" : ""}`}>{userManagementMessage}</p> : null}
          <div className="admin-user-list">{users.map((user) => <div className="admin-user-row" key={user.id}><span><strong>{user.isTemporary ? "임시 계정" : user.name || "사용자"}</strong><small>{user.email}</small></span><button className="delete-log-button" type="button" onClick={() => void deleteUser(user.id)}>계정 삭제</button></div>)}</div>
        </section> : null}

        {activePanel === "admin" ? <div id="administrator-management">
        {isGlobalAdmin ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Administrator management</p><h2>그룹 만들기</h2></div>
          <form className="form" onSubmit={createGroup}>
            <label className="field"><span>그룹 이름</span><input name="name" required maxLength={80} placeholder="예: 1학년 3반" /></label>
            <label className="field"><span>유형</span><select name="kind" defaultValue="group"><option value="group">일반 그룹</option><option value="class">학급</option></select></label>
            {groupCreationMessage ? <p className={`auth-message${groupCreationMessage === "그룹을 만들었습니다." ? " success" : ""}`}>{groupCreationMessage}</p> : null}
            <button className="button" type="submit">그룹 만들기</button>
          </form>
        </section> : null}
        {isGlobalAdmin ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Administrator management</p><h2>그룹 관리자 임명·교체·해임</h2></div>
          {managedGroups.length > 0 ? <form className="form" onSubmit={setGroupAdmin}>
            <label className="field"><span>그룹</span><select name="group-id" required>{managedGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <label className="field"><span>프리 유저</span><select name="public-id" required defaultValue=""><option value="" disabled>프리 유저 선택</option>{freeUsers.map((user) => <option key={user.id} value={user.username}>@{user.username}</option>)}</select></label>
            {groupAdminMessage ? <p className={`auth-message${groupAdminMessage === "그룹 관리자를 설정했습니다." ? " success" : ""}`}>{groupAdminMessage}</p> : null}
            <p className="account-public-id-help">이미 관리자가 있는 그룹을 선택하면 새 관리자로 교체됩니다.</p>
            <button className="button" type="submit" disabled={freeUsers.length === 0}>관리자 임명 또는 교체</button>
          </form> : <p>임명할 그룹이 없습니다. 먼저 그룹을 만들어 주세요.</p>}
          <div className="admin-user-list">{groupAdmins.map((admin) => <div className="admin-user-row" key={`${admin.groupId}-${admin.userId}`}><span><strong>{managedGroups.find((group) => group.id === admin.groupId)?.name ?? "그룹"}</strong><small>관리자 @{admin.username}</small></span><button className="delete-log-button" type="button" onClick={() => void removeGroupAdmin(admin)}>관리자 해임</button></div>)}</div>
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
        {isGlobalAdmin && managedGroups.length > 0 ? <section className="admin-panel admin-actions">
          <div><p className="eyebrow">Group management</p><h2>그룹 삭제</h2></div>
          {groupDeletionMessage ? <p className={`auth-message${groupDeletionMessage === "그룹을 삭제했습니다." ? " success" : ""}`}>{groupDeletionMessage}</p> : null}
          <div className="admin-user-list">{managedGroups.map((group) => <div className="admin-user-row" key={group.id}><span><strong>{group.name}</strong><small>그룹 구성원의 소속을 해제합니다.</small></span><button className="delete-log-button" type="button" disabled={deletingGroupId !== null} onClick={() => void deleteGroup(group)}>{deletingGroupId === group.id ? "삭제 중..." : "그룹 삭제"}</button></div>)}</div>
        </section> : null}
        </div> : null}
      </main>
    </div>
  );
}
