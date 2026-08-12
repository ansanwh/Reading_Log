"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

type LoginButtonProps = {
  compact?: boolean;
  initialMode?: "login" | "signup";
};

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 메일함에서 인증 메일을 확인해 주세요.";
  }

  if (normalizedMessage.includes("user already registered") || normalizedMessage.includes("already registered")) {
    return "이미 가입된 이메일입니다. 로그인으로 다시 시도해 주세요.";
  }

  if (normalizedMessage.includes("password should be at least") || normalizedMessage.includes("weak password")) {
    return "비밀번호는 6자 이상으로 입력해 주세요.";
  }

  if (normalizedMessage.includes("invalid email")) {
    return "이메일 형식이 올바르지 않습니다.";
  }

  if (normalizedMessage.includes("signup is disabled")) {
    return "현재 회원가입이 비활성화되어 있습니다.";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  }

  if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return "인증 처리 중 문제가 발생했습니다. 잠시 뒤 다시 시도해 주세요.";
}

export function LoginButton({ compact = false, initialMode = "login" }: LoginButtonProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: new URL(sitePath("auth/callback/"), document.baseURI).toString(),
            },
          });

    setIsLoading(false);

    if (error) {
      setMessage(getAuthErrorMessage(error.message));
      return;
    }

    if (mode === "signup") {
      setMessage("가입이 완료되었습니다. 이메일 확인이 필요한 경우 메일함을 확인해 주세요.");
      return;
    }

    if (!data.session) {
      setMessage("로그인은 처리되었지만 세션을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      return;
    }

    window.location.assign(sitePath("main/"));
  }

  async function loginWithKakao() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: new URL(sitePath("auth/callback/"), document.baseURI).toString(),
      },
    });
  }

  return (
    <div className={compact ? "auth-box auth-box-compact" : "auth-box"}>
      <div className="auth-tabs" aria-label="인증 방식">
        <button
          className={mode === "login" ? "active" : ""}
          type="button"
          onClick={() => {
            setMode("login");
            setMessage("");
          }}
        >
          로그인
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          type="button"
          onClick={() => {
            setMode("signup");
            setMessage("");
          }}
        >
          회원가입
        </button>
      </div>

      <form className="form auth-form" onSubmit={handlePasswordAuth}>
        <label className="field">
          <span>아이디</span>
          <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <span className="password-input-wrap">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="6자 이상"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <button
              className={`password-visibility-button${showPassword ? " active" : ""}`}
              type="button"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              <span aria-hidden="true" />
            </button>
          </span>
        </label>

        {message ? <p className="auth-message">{message}</p> : null}

        <button className="button" type="submit" disabled={isLoading}>
          {isLoading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>

      <div className="auth-divider">
        <span>또는</span>
      </div>

      <button className="button kakao" type="button" onClick={loginWithKakao}>
        카카오로 로그인
      </button>
    </div>
  );
}
