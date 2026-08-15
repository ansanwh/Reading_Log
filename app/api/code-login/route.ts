import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function POST(request: Request) {
  const { groupName, code } = await request.json() as { groupName?: string; code?: string };
  const normalizedGroupName = groupName?.trim();
  const normalizedCode = code?.trim();
  if (!normalizedGroupName || !normalizedCode || !/^\d{1,5}$/.test(normalizedCode)) return NextResponse.json({ message: "그룹명과 5자리 이하 숫자 코드를 입력해 주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: group } = await admin.from("groups").select("id").eq("name", normalizedGroupName).maybeSingle();
  if (!group) return NextResponse.json({ message: "그룹명 또는 코드가 올바르지 않습니다." }, { status: 401 });
  const { data: account } = await admin.from("temporary_accounts").select("user_id,expires_at").eq("group_id", group.id).eq("code_hash", hashCode(normalizedCode)).maybeSingle();
  if (!account || new Date(account.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ message: "유효하지 않거나 만료된 임시 계정 코드입니다." }, { status: 401 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(account.user_id);
  if (userError || !userData.user?.email) return NextResponse.json({ message: "임시 계정을 찾지 못했습니다." }, { status: 404 });
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: userData.user.email });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) return NextResponse.json({ message: "코드 로그인 토큰을 만들지 못했습니다." }, { status: 500 });

  return NextResponse.json({ tokenHash });
}
