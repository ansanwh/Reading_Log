type UserLike = {
  email?: string | null;
};

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: UserLike | null) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email);
}
