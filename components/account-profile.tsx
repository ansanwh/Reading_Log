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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
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
    setPasswordMessage("");
    setPublicIdMessage("");
  }

  async function savePublicId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = publicIdDraft.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setPublicIdMessage("공개 ID는 영문 소문자, 숫자, 밑줄 3~24자로 입력해 주세요.");
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

    const { error } = await supabase.from("profiles").upsert({ id: user.id, username });
    setIsSavingPublicId(false);
    if (error) {
      setPublicIdMessage(error.code === "23505" ? "이미 사용 중인 공개 ID입니다." : "공개 ID를 저장하지 못했습니다. 데이터베이스 설정을 확인해 주세요.");
      return;
    }

    setPublicId(username);
    setPublicIdDraft(username);
    setPublicIdMessage("공개 ID가 저장되었습니다.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");

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
    setPasswordMessage("비밀번호가 변경되었습니다.");
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
                  {email ? <span>{email}</span> : null}
                  {publicId ? <span>공개 ID @{publicId}</span> : null}
                  {isAdmin ? <span className="admin-badge">관리자</span> : null}
                </div>
              </div>

              <form className="account-public-id-form" onSubmit={savePublicId}>
                <label className="field">
                  <span>공개 ID</span>
                  <input
                    value={publicIdDraft}
                    onChange={(event) => setPublicIdDraft(event.target.value)}
                    placeholder="예: reading_albert"
                    minLength={3}
                    maxLength={24}
                    autoComplete="nickname"
                  />
                </label>
                <p className="account-public-id-help">공개 검색 결과에 작성자로 표시됩니다.</p>
                {publicIdMessage ? <p className="auth-message">{publicIdMessage}</p> : null}
                <button className="button secondary" type="submit" disabled={isSavingPublicId}>
                  {isSavingPublicId ? "저장 중..." : "공개 ID 저장"}
                </button>
              </form>

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

              <form className="account-password-form" onSubmit={changePassword}>
                <label className="field">
                  <span>새 비밀번호</span>
                  <input
                    name="new-password"
                    type="password"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    placeholder="6자 이상"
                  />
                </label>

                <label className="field">
                  <span>새 비밀번호 확인</span>
                  <input
                    name="confirm-password"
                    type="password"
                    minLength={6}
                    required
                    autoComplete="new-password"
                    placeholder="새 비밀번호 다시 입력"
                  />
                </label>

                {passwordMessage ? <p className="auth-message">{passwordMessage}</p> : null}

                <button className="button secondary" type="submit" disabled={isChangingPassword}>
                  {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
                </button>
              </form>
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
