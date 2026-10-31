import { Navigate, Outlet, useLocation, type RouteObject } from "react-router";
import { useSession } from "@/lib/session";
import { returnTo } from "@/lib/returnTo";
import { SignIn } from "@/pages/auth/SignIn";
import { SignUp } from "@/pages/auth/SignUp";
import { Reset } from "@/pages/auth/Reset";
import { Home } from "@/pages/Home";
import { AnimalForm } from "@/pages/AnimalForm";
import { AnimalProfile } from "@/pages/AnimalProfile";
import { NewRecord, EditRecord } from "@/pages/RecordPage";
import { PhotoIntake } from "@/pages/PhotoIntake";
import { CardPage } from "@/pages/CardPage";
import { People } from "@/pages/People";
import { InvitePage } from "@/pages/InvitePage";
import { Archived } from "@/pages/Archived";
import { NotFound } from "@/pages/NotFound";

/** Signed-in only: anyone else goes to /entrar and comes back here after. */
function RequireAuth() {
  const account = useSession();
  const location = useLocation();
  if (!account) {
    const here = `${location.pathname}${location.search}`;
    const to = here === "/" ? "/entrar" : `/entrar?volta=${encodeURIComponent(here)}`;
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

/** Signed-out only: a signed-in visitor goes where they were headed. */
function SignedOut() {
  const account = useSession();
  const location = useLocation();
  if (account) return <Navigate to={returnTo(location.search)} replace />;
  return <Outlet />;
}

// The paths are the app's own words; the backend builds links to
// /animais/:id?assunto=… (reminder e-mails and pushes) and /convite/:token.
export const routes: RouteObject[] = [
  {
    element: <SignedOut />,
    children: [
      { path: "/entrar", element: <SignIn /> },
      { path: "/cadastro", element: <SignUp /> },
      { path: "/recuperar", element: <Reset /> },
    ],
  },
  // Open to anyone: the invite shows what it grants before asking for an account.
  { path: "/convite/:token", element: <InvitePage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/arquivados", element: <Archived /> },
      { path: "/animais/novo", element: <AnimalForm /> },
      { path: "/animais/:id", element: <AnimalProfile /> },
      { path: "/animais/:id/editar", element: <AnimalForm /> },
      { path: "/animais/:id/registrar/:tipo", element: <NewRecord /> },
      { path: "/animais/:id/registros/:recordId", element: <EditRecord /> },
      { path: "/animais/:id/foto", element: <PhotoIntake /> },
      { path: "/animais/:id/carteirinha", element: <CardPage /> },
      { path: "/animais/:id/pessoas", element: <People /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];
