import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  return user && isSuperAdminEmail(user.email) ? user : null;
}

export async function POST(request: Request) {
  try {
    if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 그룹을 만들 수 있습니다." }, { status: 403 });
    const { name, kind = "group" } = await request.json() as { name?: string; kind?: "group" | "class" };
    const trimmedName = name?.trim();
    if (!trimmedName || trimmedName.length > 80 || !["group", "class"].includes(kind)) return NextResponse.json({ message: "그룹 이름과 유형을 확인해 주세요." }, { status: 400 });
    const { error } = await createAdminClient().from("groups").insert({ name: trimmedName, kind });
    if (error?.code === "23505") return NextResponse.json({ message: "이미 같은 이름의 그룹이 있습니다." }, { status: 409 });
    if (error) return NextResponse.json({ message: "그룹을 만들지 못했습니다." }, { status: 500 });
    return NextResponse.json({ message: "그룹을 만들었습니다." });
  } catch (error) {
    console.error("Group creation failed", error);
    return NextResponse.json({ message: "그룹 생성 서버 설정을 확인해 주세요." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 그룹을 삭제할 수 있습니다." }, { status: 403 });
    const { groupId } = await request.json() as { groupId?: string };
    if (!groupId) return NextResponse.json({ message: "삭제할 그룹을 선택해 주세요." }, { status: 400 });

    const admin = createAdminClient();
    const { data: group, error: groupLookupError } = await admin.from("groups").select("id").eq("id", groupId).maybeSingle();
    if (groupLookupError) return NextResponse.json({ message: "그룹 정보를 확인하지 못했습니다." }, { status: 500 });
    if (!group) return NextResponse.json({ message: "삭제할 그룹을 찾지 못했습니다." }, { status: 404 });

    const { data: temporaryAccounts, error: temporaryAccountError } = await admin.from("temporary_accounts").select("user_id").eq("group_id", groupId);
    if (temporaryAccountError) return NextResponse.json({ message: "그룹의 임시 계정을 확인하지 못했습니다." }, { status: 500 });

    for (const account of temporaryAccounts ?? []) {
      const { error } = await admin.auth.admin.deleteUser(account.user_id);
      if (error) return NextResponse.json({ message: "그룹의 임시 계정을 삭제하지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
    }

    const { error: deleteError } = await admin.from("groups").delete().eq("id", groupId);
    if (deleteError) return NextResponse.json({ message: "그룹을 삭제하지 못했습니다." }, { status: 500 });
    return NextResponse.json({ message: "그룹을 삭제했습니다." });
  } catch (error) {
    console.error("Group deletion failed", error);
    return NextResponse.json({ message: "그룹 삭제 서버 설정을 확인해 주세요." }, { status: 500 });
  }
}
