const SUPER_ADMIN_EMAILS = new Set(["admin1@seojae.kr"]);

export function isSuperAdminEmail(email?: string | null) {
  return Boolean(email && SUPER_ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

// 기존 호출부와의 호환성을 유지한다. 최고 관리자는 모든 관리자 화면에 접근할 수 있다.
export const isAdminEmail = isSuperAdminEmail;
