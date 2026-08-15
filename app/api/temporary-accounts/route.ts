import { createHash, randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { groupId, code, years = 1 } = await request.json() as { groupId?: string; code?: string; years?: number };
  const normalizedCode = code?.trim();
  if (!groupId || !normalizedCode || !/^\d{1,5}$/.test(normalizedCode)) return NextResponse.json({ message: "그룹과 5자리 이하 숫자 코드를 입력해 주세요." }, { status: 400 });
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const admin = createAdminClient();
  const { data: membership } = await admin.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (!isSuperAdminEmail(user.email) && membership?.role !== "group_admin") return NextResponse.json({ message: "이 그룹의 임시 계정을 만들 권한이 없습니다." }, { status: 403 });

  const safeYears = Math.min(3, Math.max(1, Math.floor(Number(years) || 1)));
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + safeYears);
  const email = `temp-${randomUUID()}@temporary.reading-log.local`;
  const password = randomBytes(32).toString("base64url");
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { is_temporary_account: true } });
  if (createUserError || !createdUser.user) return NextResponse.json({ message: "임시 계정을 만들지 못했습니다." }, { status: 500 });

  const { error: memberError } = await admin.from("group_members").insert({ group_id: groupId, user_id: createdUser.user.id, role: "member", can_publish: true });
  const { error: accountError } = memberError ? { error: memberError } : await admin.from("temporary_accounts").insert({ user_id: createdUser.user.id, group_id: groupId, code_hash: hashCode(normalizedCode), expires_at: expiresAt.toISOString(), created_by: user.id });
  if (accountError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    if ((accountError as { code?: string }).code === "23505") return NextResponse.json({ message: "이 그룹에서 이미 사용 중인 코드입니다." }, { status: 409 });
    return NextResponse.json({ message: "임시 계정 정보를 저장하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ code: normalizedCode, expiresAt: expiresAt.toISOString() });
}
