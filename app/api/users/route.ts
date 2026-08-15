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

export async function GET() {
  if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 사용자를 관리할 수 있습니다." }, { status: 403 });
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ message: "사용자 목록을 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ users: data.users.map((user) => ({ id: user.id, email: user.email ?? "", name: user.user_metadata?.name ?? "", isTemporary: user.user_metadata?.is_temporary_account === true })) });
}

export async function DELETE(request: Request) {
  const currentUser = await requireSuperAdmin();
  const { userId } = await request.json() as { userId?: string };
  if (!currentUser) return NextResponse.json({ message: "최고 관리자만 계정을 삭제할 수 있습니다." }, { status: 403 });
  if (!userId || userId === currentUser.id) return NextResponse.json({ message: "현재 로그인한 최고 관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ message: "계정을 삭제하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ message: "계정을 삭제했습니다." });
}
