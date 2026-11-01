"""How the API knows who is calling (ADR-0002).

Two transports, one account:

- the native app sends allauth's session token as ``X-Session-Token`` (the
  "app" client), read by allauth's own ``XSessionTokenAuth``;
- the web app sends allauth's session cookie (the "browser" client), and the
  API reads the Django session behind it. An unsafe call made this way must
  also pass Django's CSRF check: the ``X-CSRFToken`` header matching the
  cookie, from a trusted origin.

A call that names a token is judged by the token alone, so a native call with a
dead token answers 401 (sign in again), never a CSRF 403.
"""

from allauth.headless.contrib.ninja.security import x_session_token_auth
from django.http import HttpRequest
from ninja.errors import HttpError
from ninja.security import APIKeyCookie
from ninja.utils import check_csrf


class SessionCookieAuth(APIKeyCookie):
    """The web's session cookie, with CSRF on unsafe methods."""

    def __init__(self) -> None:
        from django.conf import settings

        self.param_name = settings.SESSION_COOKIE_NAME
        super().__init__(csrf=False)

    def _get_key(self, request: HttpRequest) -> str | None:
        if request.headers.get("X-Session-Token"):
            return None
        return request.COOKIES.get(self.param_name)

    def authenticate(self, request: HttpRequest, key: str | None):
        if not key or not request.user.is_authenticated:
            return None
        if check_csrf(request):
            raise HttpError(403, "CSRF check failed")
        return request.user


class Anonymous:
    """Lets a caller with no session through, as no one (``request.auth`` is True)."""

    def __call__(self, request: HttpRequest):
        return True


session_cookie_auth = SessionCookieAuth()

# Every route: the token (native) or the cookie (web).
signed_in = [x_session_token_auth, session_cookie_auth]
# A route open to anyone that reads differently for a signed-in caller.
signed_in_or_anonymous = [*signed_in, Anonymous()]


def caller(request: HttpRequest):
    """The signed-in account behind ``request.auth``, or None for an anonymous caller."""
    user = getattr(request, "auth", None)
    return user if getattr(user, "is_authenticated", False) else None
