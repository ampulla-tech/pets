"""The daily evaluation of every reminder (crontab: once a day)."""

from datetime import date

from django.core.management.base import BaseCommand

from reminders import dispatch


class Command(BaseCommand):
    help = "Evaluate every reminder and send what reached a milestone today."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=date.fromisoformat, help="evaluate as of this day")

    def handle(self, *args, **options):
        sent = dispatch.run(options.get("date"))
        self.stdout.write(f"{sent} message(s) sent")
