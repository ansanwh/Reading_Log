"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인을 처리하고 있습니다.");
  const [hasError, setHasError] = useState(false);
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get("code");
    const afterLogin = sessionStorage.getItem("reading-log:auth-next");
    sessionStorage.removeItem("reading-log:auth-next");
    const destination = afterLogin === "library" ? sitePath("library/") : sitePath("main/");
    const providerError = callbackUrl.searchParams.get("error_description");

    if (providerError) {
      setMessage("카카오 로그인이 취소되었거나 승인되지 않았습니다. 다시 시도해 주세요.");
      setHasError(true);
      return;
    }

    if (!code) {
      setMessage("로그인 인증 코드가 없습니다. 처음부터 다시 로그인해 주세요.");
      setHasError(true);
      return;
    }

    // createBrowserClient는 PKCE 콜백의 code를 초기화 과정에서 자동으로 교환한다.
    // 초기화가 끝난 세션을 확인해 같은 code를 두 번 교환하지 않도록 한다.
    void createClient().auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setMessage("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        setHasError(true);
        return;
      }
      window.location.replace(destination);
    });
  }, []);

  return (
    <main className="library-main">
      <p className="library-empty-state">{message}</p>
      {hasError ? (
        <div className="library-actions">
          <a className="button secondary" href={sitePath("main/")}>메인 페이지로 이동</a>
        </div>
      ) : null}
    </main>
  );
}
