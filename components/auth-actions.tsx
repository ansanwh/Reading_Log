"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoginButton } from "@/components/login-button";

type AuthActionsProps = {
  openOnMount?: boolean;
  introText?: string;
  afterLogin?: "main" | "library";
};

export function AuthActions({ openOnMount = false, introText, afterLogin = "main" }: AuthActionsProps) {
  const [isOpen, setIsOpen] = useState(openOnMount);
  const [isMounted, setIsMounted] = useState(false);

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
  }

  const modal =
    isOpen && isMounted
      ? createPortal(
          <div className="modal-backdrop" role="presentation" onMouseDown={close}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="로그인 및 회원가입"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <h2>로그인</h2>
                <button className="icon-button" type="button" aria-label="닫기" onClick={close}>
                  ×
                </button>
              </div>
              {introText ? <p className="auth-intro">{introText}</p> : null}
              <LoginButton compact afterLogin={afterLogin} />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="auth-actions">
        <button className="profile-button" type="button" aria-label="로그인 및 회원가입" onClick={() => setIsOpen(true)}>
          <span aria-hidden="true" />
        </button>
      </div>
      {modal}
    </>
  );
}
