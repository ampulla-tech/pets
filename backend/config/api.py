"""The API: every route requires the allauth session token unless it says otherwise."""

from allauth.headless.contrib.ninja.security import x_session_token_auth
from ninja import NinjaAPI, Schema

from animals.api import router as animals_router
from animals.errors import ApiError
from intake.api import router as intake_router
from reminders.api import router as reminders_router


class PetsAPI(NinjaAPI):
    def get_openapi_operation_id(self, operation) -> str:
        # The function name, stable from one export to the next: the generated
        # client's names follow it.
        return operation.view_func.__name__


api = PetsAPI(
    title="Pets API",
    version="1.0.0",
    auth=x_session_token_auth,
    urls_namespace="api",
)


@api.exception_handler(ApiError)
def api_error(request, error: ApiError):
    return api.create_response(
        request, {"code": error.code, "detail": error.detail}, status=error.status
    )


class HealthOut(Schema):
    status: str


@api.get("/health", response=HealthOut, auth=None, tags=["health"])
def health(request):
    return {"status": "ok"}


class MeOut(Schema):
    id: str
    email: str


@api.get("/me", response=MeOut, tags=["account"])
def get_me(request):
    return {"id": str(request.auth.id), "email": request.auth.email}


api.add_router("", animals_router)
api.add_router("", reminders_router)
api.add_router("", intake_router)
