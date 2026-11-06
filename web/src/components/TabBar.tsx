import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, PawPrint, UserRound } from "lucide-react";
import { getUnreadOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: strings.tabs.pets, Icon: PawPrint },
  { to: "/avisos", label: strings.tabs.notices, Icon: Bell },
  { to: "/perfil", label: strings.tabs.profile, Icon: UserRound },
] as const;

/** The tab a path belongs to: an animal is under Pets, the archived list under Perfil. */
function tabOf(pathname: string) {
  if (pathname.startsWith("/avisos")) return "/avisos";
  if (pathname.startsWith("/perfil") || pathname.startsWith("/arquivados"))
    return "/perfil";
  return "/";
}

/**
 * The bar at the bottom: Pets, Avisos and Perfil, fixed above the iPhone's
 * home indicator. Avisos carries a dot, never a count, while a notice is unread.
 */
export function TabBar() {
  const unread = useQuery({ ...getUnreadOptions(), refetchOnWindowFocus: true });
  const current = tabOf(useLocation().pathname);
  return (
    <nav
      aria-label={strings.tabs.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <ul className="mx-auto flex h-16 max-w-xl items-start justify-around pt-2">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={current === to ? "page" : undefined}
              className={cn(
                "relative flex w-20 flex-col items-center gap-0.5 text-[0.7rem] text-muted-foreground",
                current === to && "font-semibold text-primary",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
              {to === "/avisos" && unread.data?.unread ? (
                <span
                  role="status"
                  aria-label={strings.tabs.unread}
                  className="absolute top-[-1px] left-[47px] size-2.5 rounded-full bg-destructive ring-2 ring-background"
                />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
