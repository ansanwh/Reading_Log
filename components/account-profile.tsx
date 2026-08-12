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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  function close() {
    setIsOpen(false);
    setPasswordMessage("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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

              <form className="account-password-form" onSubmit={changePassword}>
                <label className="field">
                  <span>새 비밀번호</span>
                  <span className="password-input-wrap">
                    <input
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      minLength={6}
                      required
                      autoComplete="new-password"
                      placeholder="6자 이상"
                    />
                    <button
                      className={`password-visibility-button${showNewPassword ? " active" : ""}`}
                      type="button"
                      aria-label={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                      aria-pressed={showNewPassword}
                      onClick={() => setShowNewPassword((value) => !value)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </span>
                </label>

                <label className="field">
                  <span>새 비밀번호 확인</span>
                  <span className="password-input-wrap">
                    <input
                      name="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      minLength={6}
                      required
                      autoComplete="new-password"
                      placeholder="새 비밀번호 다시 입력"
                    />
                    <button
                      className={`password-visibility-button${showConfirmPassword ? " active" : ""}`}
                      type="button"
                      aria-label={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                      aria-pressed={showConfirmPassword}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                    >
                      <span aria-hidden="true" />
                    </button>
                  </span>
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
