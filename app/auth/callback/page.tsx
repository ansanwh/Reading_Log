"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("로그인을 처리하고 있습니다.");

  useEffect(() => {
    void createClient().auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) {
        setMessage("로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      window.location.replace(new URL(sitePath("main/"), document.baseURI).toString());
    });
  }, []);

  return <main className="library-main"><p className="library-empty-state">{message}</p></main>;
}
