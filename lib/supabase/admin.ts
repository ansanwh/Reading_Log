import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error("Supabase 관리자 키가 설정되지 않았습니다. SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY를 확인해 주세요.");
  }

  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function hasAdminClientConfiguration() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function adminConfigurationResponse() {
  return hasAdminClientConfiguration()
    ? null
    : NextResponse.json({ message: "서버에 Supabase 관리자 키가 없습니다. SUPABASE_SECRET_KEY를 설정해 주세요." }, { status: 503 });
}
