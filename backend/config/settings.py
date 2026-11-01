"""Django settings for the pets backend.

The backend owns its own identity (ADR-0002): accounts with e-mail and password
through allauth headless, and nothing shared with any other app. Configuration
is environment-driven; the defaults let `docker compose up` work as is.
"""

import os
from pathlib import Path

from corsheaders.defaults import default_headers as cors_default_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_bool(key: str, default: bool) -> bool:
    return os.environ.get(key, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str) -> list[str]:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-pets-dev-only")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "ninja",
    "allauth",
    "allauth.account",
    "allauth.headless",
    "accounts",
    "animals",
    "reminders",
    "intake",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "pets"),
        "USER": os.environ.get("POSTGRES_USER", "pets"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "pets"),
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5435"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# The dates the app reasons about (a vaccine's day, "today" for a reminder) are
# the tutor's calendar days, in Brazil.
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Media: animal photos, the photos of the vaccination cards and the files
# attached to a visit. On disk under MEDIA_ROOT locally and in tests; a private
# S3-compatible bucket whenever AWS_STORAGE_BUCKET_NAME is set (production).
# Files are never served by the bucket's own URLs: the API hands out links to
# its own signed, expiring file endpoint, identical on disk and on S3.
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "uploads"))

AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
if AWS_STORAGE_BUCKET_NAME:
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "auto")
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_FILE_OVERWRITE = False
    _s3_endpoint = os.environ.get("AWS_S3_ENDPOINT_URL")
    if _s3_endpoint:
        AWS_S3_ENDPOINT_URL = _s3_endpoint
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}

# How long a signed file link stays valid.
FILE_LINK_MAX_AGE = int(os.environ.get("FILE_LINK_MAX_AGE", str(6 * 3600)))
# Largest single upload the API accepts.
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_BYTES
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "standard",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

# ── Identity: allauth headless, the app's own accounts (ADR-0002) ───────────
# E-mail is the login; there is no username. Both clients (web and native) use
# allauth's "app" client: the session token travels in the X-Session-Token
# header, and the API authenticates every call with that same header.
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_USER_MODEL_EMAIL_FIELD = "email"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_PRESERVE_USERNAME_CASING = False
# The e-mail is confirmed before the account is usable, by a short code typed
# into the app, which a phone with no link to open can finish too. Signing in
# to an account not yet confirmed sends a fresh code.
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_ENABLED = True
ACCOUNT_EMAIL_VERIFICATION_BY_CODE_TIMEOUT = 900
ACCOUNT_EMAIL_VERIFICATION_SUPPORTS_RESEND = True
# The reset is a short code typed into the app as well, for the same reason.
ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED = True
ACCOUNT_PASSWORD_RESET_BY_CODE_TIMEOUT = 900
ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_EMAIL_SUBJECT_PREFIX = "Pets: "
if env_bool("ACCOUNT_RATE_LIMITS_DISABLED", False):
    ACCOUNT_RATE_LIMITS = False

HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("app",)
WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:5180").rstrip("/")
HEADLESS_FRONTEND_URLS = {
    "account_reset_password_from_key": f"{WEB_APP_URL}/recuperar/{{key}}",
    "account_signup": f"{WEB_APP_URL}/cadastro",
}

# ── Mail ────────────────────────────────────────────────────────────────────
# Transactional mail (the reset code and the reminders) leaves through
# Resend's HTTP API whenever its key is set; without it, mail is printed.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
if RESEND_API_KEY:
    EMAIL_BACKEND = "anymail.backends.resend.EmailBackend"
    ANYMAIL = {"RESEND_API_KEY": RESEND_API_KEY}
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "pets@ampulla.tech")

# ── CORS ────────────────────────────────────────────────────────────────────
# The web app calls the API from its own origin with the session token header;
# no cookie crosses, so no credentials are allowed.
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5180,http://127.0.0.1:5180"
)
CORS_ALLOW_HEADERS = (*cors_default_headers, "x-session-token")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "")

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ── Photo reading (ADR-0005) ────────────────────────────────────────────────
# The model is chosen by the benchmark and set here, never in the code. With no
# key or no model the reading is reported unconfigured and the manual forms
# still work.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
INTAKE_MODEL = os.environ.get("INTAKE_MODEL", "")
INTAKE_TIMEOUT_SECONDS = int(os.environ.get("INTAKE_TIMEOUT_SECONDS", "120"))

# ── Push (ADR-0004) ─────────────────────────────────────────────────────────
# Web push signs with VAPID; the key pair comes from the environment. The
# public half is also served to the web app, which subscribes with it.
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "").replace(r"\n", "\n")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:pets@ampulla.tech")
# An Expo access token is optional (only needed when the project enables
# enhanced push security).
EXPO_ACCESS_TOKEN = os.environ.get("EXPO_ACCESS_TOKEN", "")
