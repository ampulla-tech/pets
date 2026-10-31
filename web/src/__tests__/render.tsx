import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createQueryClient } from "@/lib/api";
import { session } from "@/lib/session";
import { routes } from "@/router";

/** The whole app at one address, signed in as `as` unless it is null. */
export function renderApp(
  path: string,
  { as = "ana@example.com" }: { as?: string | null } = {},
) {
  if (as) session.set({ token: "token-1", email: as });
  else session.clear();
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: 0 },
    mutations: { retry: false },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, user, queryClient };
}
