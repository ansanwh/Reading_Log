"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

type AccountProfileProps = {
  displayName: string;
  email?: string | null;
  isAdmin?: boolean;
};

function getPasswordChangeErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("password should be at least") || normalizedMessage.includes("weak password")) {
    return "비밀번호는 6자 이상으로 입력해 주세요.";
  }

  if (normalizedMessage.includes("same password") || normalizedMessage.includes("different from the old password")) {
    return "이전 비밀번호와 다른 새 비밀번호를 입력해 주세요.";
  }

  if (normalizedMessage.includes("reauth") || normalizedMessage.includes("recent")) {
    return "보안을 위해 다시 로그인한 뒤 비밀번호를 변경해 주세요.";
  }

  if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return "비밀번호를 변경하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
}

export function AccountProfile({ displayName, email, isAdmin = false }: AccountProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [openSetting, setOpenSetting] = useState<"public-id" | "password" | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isPasswordMessagePositive, setIsPasswordMessagePositive] = useState(false);
  const [isKakaoAccount, setIsKakaoAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState(email ?? null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [publicIdDraft, setPublicIdDraft] = useState("");
  const [publicIdMessage, setPublicIdMessage] = useState("");
  const [isSavingPublicId, setIsSavingPublicId] = useState(false);
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isActive) {
        return;
      }

      const providers = user.app_metadata?.providers as string[] | undefined;
      setIsKakaoAccount(Boolean(user.identities?.some((identity) => identity.provider === "kakao") || providers?.includes("kakao")));
      setAccountEmail(user.email ?? null);

      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      if (isActive) {
        const username = data?.username ?? "";
        setPublicId(username);
        setPublicIdDraft(username);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setOpenSetting(null);
    setPasswordMessage("");
    setIsPasswordMessagePositive(false);
    setEmailMessage("");
    setPublicIdMessage("");
  }

  async function saveLoginEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedEmail = emailDraft.trim().toLowerCase();
    setIsSavingEmail(true);
    setEmailMessage("");

    const { error } = await createClient().auth.updateUser(
      { email: requestedEmail },
      { emailRedirectTo: new URL(sitePath("auth/callback/"), document.baseURI).toString() },
    );
    setIsSavingEmail(false);

    if (error) {
      setEmailMessage("이메일을 등록하지 못했습니다. 주소를 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    setEmailMessage("인증 메일을 보냈습니다. 메일에서 확인한 뒤 다시 로그인해 비밀번호를 설정해 주세요.");
  }

  async function savePublicId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftUsername = publicIdDraft.trim().normalize("NFC");
    const username = draftUsername === "익명" ? "" : draftUsername;

    if (username && !/^[가-힣a-zA-Z0-9_]{2,24}$/.test(username)) {
      setPublicIdMessage("공개 ID는 한글, 영문, 숫자, 밑줄 2~24자로 입력해 주세요.");
      return;
    }

    setIsSavingPublicId(true);
    setPublicIdMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsSavingPublicId(false);
      setPublicIdMessage("로그인 정보를 확인하지 못했습니다.");
      return;
    }

    const { error } = username
      ? await supabase.from("profiles").upsert({ id: user.id, username })
      : await supabase.from("profiles").delete().eq("id", user.id);
    setIsSavingPublicId(false);
    if (error) {
      setPublicIdMessage(error.code === "23505" ? "이미 사용 중인 공개 ID입니다." : "공개 ID를 저장하지 못했습니다. 데이터베이스 설정을 확인해 주세요.");
      return;
    }

    setPublicId(username);
    setPublicIdDraft(username);
    setPublicIdMessage(username ? "공개 ID가 저장되었습니다." : "공개 ID를 익명으로 변경했습니다.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setIsPasswordMessagePositive(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("new-password") ?? "");
    const confirmPassword = String(formData.get("confirm-password") ?? "");

    if (newPassword.length < 6) {
      setPasswordMessage("비밀번호는 6자 이상으로 입력해 주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setIsChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);

    if (error) {
      setPasswordMessage(getPasswordChangeErrorMessage(error.message));
      return;
    }

    form.reset();
    setPasswordMessage(isKakaoAccount ? "이메일 로그인이 설정되었습니다. 이제 표시된 이메일과 새 비밀번호로 로그인할 수 있습니다." : "비밀번호가 변경되었습니다.");
    setIsPasswordMessagePositive(true);
  }

  const modal =
    isOpen && isMounted
      ? createPortal(
          <div className="modal-backdrop" role="presentation" onMouseDown={close}>
            <div
              className="modal account-modal"
              role="dialog"
              aria-modal="true"
              aria-label="계정 프로필"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <h2>계정 프로필</h2>
                <button className="icon-button" type="button" aria-label="닫기" onClick={close}>
                  ×
                </button>
              </div>

              <div className="account-profile-card">
                <div className="account-avatar" aria-hidden="true">
                  {initial}
                </div>
                <div className="account-profile-info">
                  <strong>{displayName}</strong>
                  {accountEmail ? <span>{accountEmail}</span> : null}
                  <span>공개 ID {publicId || "익명"}</span>
                  {isAdmin ? <span className="admin-badge">관리자</span> : null}
                </div>
              </div>

              <div className="account-profile-actions">
                <div className="account-profile-primary-actions">
                  <a className="button secondary" href={sitePath("library/")} onClick={close}>
                    서재
                  </a>
                  <a className="button secondary account-main-link" href={sitePath("main/")} onClick={close}>
                    검색
                  </a>
                  <LogoutButton />
                </div>
                {isAdmin ? (
                  <div className="account-profile-admin-actions">
                    <a className="button secondary" href={sitePath("admin/")} onClick={close}>
                      관리자 페이지
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="account-setting-actions" aria-label="계정 설정">
                <button
                  className="button secondary"
                  type="button"
                  aria-expanded={openSetting === "public-id"}
                  aria-controls="public-id-setting"
                  onClick={() => setOpenSetting((current) => (current === "public-id" ? null : "public-id"))}
                >
                  공개 ID 설정
                </button>
                <button
                  className="button secondary"
                  type="button"
                  aria-expanded={openSetting === "password"}
                  aria-controls="password-setting"
                  onClick={() => setOpenSetting((current) => (current === "password" ? null : "password"))}
                >
                  {isKakaoAccount ? "이메일 로그인 설정" : "비밀번호 변경"}
                </button>
              </div>

              {openSetting === "public-id" ? (
                <form id="public-id-setting" className="account-public-id-form account-setting-detail" onSubmit={savePublicId}>
                  <label className="field">
                    <span>공개 ID</span>
                    <input
                      value={publicIdDraft}
                      onChange={(event) => setPublicIdDraft(event.target.value)}
                      placeholder="미설정 시 익명"
                      minLength={2}
                      maxLength={24}
                      autoComplete="nickname"
                    />
                  </label>
                  <p className="account-public-id-help">공개 검색 결과에 작성자로 표시됩니다. “익명”을 입력하거나 비워두고 저장하면 익명으로 표시됩니다.</p>
                  {publicIdMessage ? <p className={`auth-message${publicIdMessage.includes("저장되었습니다") || publicIdMessage.includes("익명으로 변경") ? " success" : ""}`}>{publicIdMessage}</p> : null}
                  <button className="button secondary" type="submit" disabled={isSavingPublicId}>
                    {isSavingPublicId ? "저장 중..." : "공개 ID 저장"}
                  </button>
                </form>
              ) : null}

              {openSetting === "password" ? (
                <div id="password-setting" className="account-setting-detail">
                  {isKakaoAccount ? <p className="account-public-id-help">카카오 계정으로 로그인한 상태에서 비밀번호를 설정하면 같은 이메일로도 로그인할 수 있습니다.</p> : null}
                  {isKakaoAccount && !accountEmail ? (
                    <form className="account-password-form" onSubmit={saveLoginEmail}>
                      <p className="account-public-id-help">카카오에서 이메일을 받지 못했습니다. 이메일을 등록하고 인증한 뒤 비밀번호를 설정해 주세요.</p>
                      <label className="field">
                        <span>로그인에 사용할 이메일</span>
                        <input type="email" required value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} autoComplete="email" placeholder="you@example.com" />
                      </label>
                      {emailMessage ? <p className="auth-message">{emailMessage}</p> : null}
                      <button className="button secondary" type="submit" disabled={isSavingEmail}>{isSavingEmail ? "등록 중..." : "이메일 인증 보내기"}</button>
                    </form>
                  ) : (
                    <form className="account-password-form" onSubmit={changePassword}>
                      <label className="field">
                        <span>새 비밀번호</span>
                        <input name="new-password" type="password" minLength={6} required autoComplete="new-password" placeholder="6자 이상" />
                      </label>

                      <label className="field">
                        <span>새 비밀번호 확인</span>
                        <input name="confirm-password" type="password" minLength={6} required autoComplete="new-password" placeholder="새 비밀번호 다시 입력" />
                      </label>

                      {passwordMessage ? <p className={`auth-message${isPasswordMessagePositive ? " success" : ""}`}>{passwordMessage}</p> : null}

                      <button className="button secondary" type="submit" disabled={isChangingPassword}>
                        {isChangingPassword ? "설정 중..." : isKakaoAccount ? "이메일 로그인 비밀번호 설정" : "비밀번호 변경"}
                      </button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button className="account-profile-trigger" type="button" aria-label="계정 프로필 열기" onClick={() => setIsOpen(true)}>
        <span className="account-avatar compact" aria-hidden="true">
          {initial}
        </span>
        <span className="account-trigger-name">{displayName}</span>
      </button>
      {modal}
    </>
  );
}
