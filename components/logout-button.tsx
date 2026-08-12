"use client";

import { createClient } from "@/lib/supabase/browser";
import { sitePath } from "@/lib/site-path";

export function LogoutButton() {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = sitePath("main/");
  }

  return (
    <button className="button secondary" type="button" onClick={logout}>
      로그아웃
    </button>
  );
}
