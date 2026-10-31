import { Link } from "react-router";
import { strings } from "@pets/core/strings";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg">{strings.app.notFound}</p>
      <Button asChild size="lg">
        <Link to="/">{strings.app.goHome}</Link>
      </Button>
    </div>
  );
}
