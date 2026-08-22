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
  if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 공개 독서 기록을 관리할 수 있습니다." }, { status: 403 });

  const admin = createAdminClient();
  const { data: logs, error } = await admin
    .from("reading_logs")
    .select("id,user_id,title,updated_at")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ message: "공개 독서 기록을 불러오지 못했습니다." }, { status: 500 });

  const userIds = [...new Set((logs ?? []).map((log) => log.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await admin.from("profiles").select("id,username").in("id", userIds)
    : { data: [] };
  const usernames = new Map((profiles ?? []).map((profile) => [profile.id, profile.username]));

  return NextResponse.json({
    logs: (logs ?? []).map((log) => ({
      id: log.id,
      title: log.title,
      author: usernames.get(log.user_id) ?? "익명",
      updatedAt: log.updated_at,
    })),
  });
}

export async function PATCH(request: Request) {
  if (!await requireSuperAdmin()) return NextResponse.json({ message: "최고 관리자만 공개 독서 기록을 관리할 수 있습니다." }, { status: 403 });
  const { logId } = await request.json() as { logId?: string };
  if (!logId) return NextResponse.json({ message: "비공개로 전환할 독서 기록을 선택해 주세요." }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("reading_logs")
    .update({ is_public: false })
    .eq("id", logId)
    .eq("is_public", true)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ message: "독서 기록을 비공개로 전환하지 못했습니다." }, { status: 500 });
  if (!data) return NextResponse.json({ message: "공개된 독서 기록을 찾지 못했습니다." }, { status: 404 });
  return NextResponse.json({ message: "독서 기록을 비공개로 전환했습니다." });
}
