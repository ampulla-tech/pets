from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path
from ninja.errors import HttpError

from animals.attachments import resolve_signed
from config.api import api


def serve_file(request, token: str):
    """A stored file behind a signed, expiring link (animals.attachments)."""
    try:
        attachment = resolve_signed(token)
    except HttpError as error:
        raise Http404 from error
    response = FileResponse(attachment.file.open("rb"), content_type=attachment.content_type)
    response["Cache-Control"] = "private, max-age=3600"
    return response


urlpatterns = [
    path("admin/", admin.site.urls),
    path("_allauth/", include("allauth.headless.urls")),
    path("files/<str:token>", serve_file, name="file"),
    path("", api.urls),
]
