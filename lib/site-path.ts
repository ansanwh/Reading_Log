export function sitePath(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");

  return `/${normalizedPath}`;
}
