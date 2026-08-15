import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { name, kind = "group" } = await request.json() as { name?: string; kind?: "group" | "class" };
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user || !isSuperAdminEmail(user.email)) return NextResponse.json({ message: "최고 관리자만 그룹을 만들 수 있습니다." }, { status: 403 });
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
