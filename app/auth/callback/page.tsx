"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인을 처리하고 있습니다.");
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get("code");
    const providerError = callbackUrl.searchParams.get("error_description");

    if (providerError) {
      setMessage("카카오 로그인이 취소되었거나 승인되지 않았습니다. 다시 시도해 주세요.");
      return;
    }

    if (!code) {
      setMessage("로그인 인증 코드가 없습니다. 처음부터 다시 로그인해 주세요.");
      return;
    }

    void createClient().auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.replace(new URL(sitePath("main/"), document.baseURI).toString());
    });
  }, []);

  return <main className="library-main"><p className="library-empty-state">{message}</p></main>;
}
