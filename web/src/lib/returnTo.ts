/** The `volta` parameter: where to go after signing in, inside this app only. */
export function returnTo(search: URLSearchParams | string): string {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const target = params.get("volta");
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

/** The same `volta`, carried on to another auth screen. */
export function withReturn(path: string, target: string): string {
  return target === "/" ? path : `${path}?volta=${encodeURIComponent(target)}`;
}
