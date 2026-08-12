const ADMIN_EMAILS = new Set(["admin1@seojae.kr"]);

export function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}
