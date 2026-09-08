export function validateApiOrigin(value: string, development: boolean): string {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('API URL must be an origin');
  if (url.protocol !== 'https:' && !(development && url.protocol === 'http:')) throw new Error('HTTPS is required');
  return url.origin;
}
export function apiPath(path: string): string {
  if (!/^\/(api|actions)\//.test(path) || /[\\?#\s]/.test(path) || path.includes('..') || path.includes('%')) throw new Error('Invalid API path');
  return path;
}
export function resourceId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid resource ID');
  return value;
}
