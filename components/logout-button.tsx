"use client";

import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button className="button secondary" type="button" onClick={logout}>
      로그아웃
    </button>
  );
}
