import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/admin";
import { adminConfigurationResponse, createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  return user && isSuperAdminEmail(user.email) ? user : null;
}

export async function POST(request: Request) {
  try {
    if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 그룹 관리자를 설정할 수 있습니다." }, { status: 403 });
    const configurationError = adminConfigurationResponse();
    if (configurationError) return configurationError;
    const { groupId, publicId } = await request.json() as { groupId?: string; publicId?: string };
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
    const { error: replacementError } = await admin.from("group_members").delete().eq("group_id", groupId).eq("role", "group_admin").neq("user_id", profile.id);
    if (replacementError) return NextResponse.json({ message: "새 관리자는 임명했지만 기존 관리자 해임에 실패했습니다." }, { status: 500 });
    return NextResponse.json({ message: "그룹 관리자를 설정했습니다." });
  } catch (error) {
    console.error("Group administrator assignment failed", error);
    return NextResponse.json({ message: "그룹 관리자 설정 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 그룹 관리자를 해임할 수 있습니다." }, { status: 403 });
    const configurationError = adminConfigurationResponse();
    if (configurationError) return configurationError;
    const { groupId, userId } = await request.json() as { groupId?: string; userId?: string };
    if (!groupId || !userId) return NextResponse.json({ message: "해임할 그룹 관리자를 선택해 주세요." }, { status: 400 });

    const { data, error } = await createAdminClient()
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("role", "group_admin")
      .select("user_id")
      .maybeSingle();
    if (error) return NextResponse.json({ message: "그룹 관리자를 해임하지 못했습니다." }, { status: 500 });
    if (!data) return NextResponse.json({ message: "해임할 그룹 관리자를 찾지 못했습니다." }, { status: 404 });
    return NextResponse.json({ message: "그룹 관리자를 해임했습니다." });
  } catch (error) {
    console.error("Group administrator dismissal failed", error);
    return NextResponse.json({ message: "그룹 관리자 해임 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
