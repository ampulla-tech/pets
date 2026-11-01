from django.apps import AppConfig


class AnimalsConfig(AppConfig):
    name = "animals"

    def ready(self):
        from animals import signals  # noqa: F401
