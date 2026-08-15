import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { groupId, publicId } = await request.json() as { groupId?: string; publicId?: string };
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || !isSuperAdminEmail(user.email)) return NextResponse.json({ message: "최고 관리자만 그룹 관리자를 설정할 수 있습니다." }, { status: 403 });
  if (!groupId || !publicId?.trim()) return NextResponse.json({ message: "그룹과 공개 ID를 입력해 주세요." }, { status: 400 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").ilike("username", publicId.trim()).maybeSingle();
  if (!profile) return NextResponse.json({ message: "해당 공개 ID의 사용자를 찾지 못했습니다." }, { status: 404 });
  const { count: membershipCount } = await admin.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", profile.id);
  if (membershipCount && membershipCount > 0) {
    return NextResponse.json({ message: "그룹에 소속된 사용자는 그룹 관리자로 임명할 수 없습니다. 프리 유저만 선택해 주세요." }, { status: 409 });
  }
  const { error } = await admin.from("group_members").upsert({ group_id: groupId, user_id: profile.id, role: "group_admin", can_publish: true }, { onConflict: "group_id,user_id" });
  if (error) return NextResponse.json({ message: "그룹 관리자 설정에 실패했습니다." }, { status: 500 });
  return NextResponse.json({ message: "그룹 관리자를 설정했습니다." });
}
