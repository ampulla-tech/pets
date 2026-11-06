import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { readNotice } from "@pets/core/api/generated";
import { forgetIfRevoked } from "@/lib/push";
import { TabBar } from "./TabBar";

/** The query parameter the service worker adds to a push's link: the notice it showed. */
export const NOTICE_PARAM = "aviso";

/**
 * The screens with the tab bar: the three tabs, an animal and the archived
 * list. It also marks read the notice a push was opened from, and forgets
 * this browser on the server when its permission was taken away.
 */
export function TabsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    void forgetIfRevoked();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get(NOTICE_PARAM);
    if (!id) return;
    params.delete(NOTICE_PARAM);
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
    void readNotice({ path: { notice_id: id } }).then(() =>
      queryClient.invalidateQueries(),
    );
  }, [location.pathname, location.search, navigate, queryClient]);

  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}
