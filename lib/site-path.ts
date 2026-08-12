export function sitePath(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");

  return process.env.NODE_ENV === "production" ? normalizedPath : `/${normalizedPath}`;
}
