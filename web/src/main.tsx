import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { createQueryClient, setUpApi } from "@/lib/api";
import { registerServiceWorker } from "@/lib/push";
import { routes } from "@/router";

setUpApi();
registerServiceWorker();

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
