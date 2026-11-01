import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { createQueryClient, setUpApi } from "@/lib/api";
import { identity } from "@/lib/identity";
import { registerServiceWorker } from "@/lib/push";
import { session } from "@/lib/session";
import { routes } from "@/router";

setUpApi();
registerServiceWorker();
// The cookie decides who is signed in; this answer also sets the CSRF cookie.
void session.sync(() => identity.current());

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
