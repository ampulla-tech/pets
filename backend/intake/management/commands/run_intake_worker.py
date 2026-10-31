"""The worker that reads card photos, beside the API (compose service `worker`)."""

import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from intake.process import claim_next, fail_stuck, process


class Command(BaseCommand):
    help = "Read pending card photos, one at a time, until stopped."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="drain the queue and exit")
        parser.add_argument("--interval", type=float, default=2.0)

    def handle(self, *args, **options):
        while True:
            close_old_connections()
            fail_stuck()
            extraction = claim_next()
            if extraction is not None:
                process(extraction)
                continue
            if options["once"]:
                return
            time.sleep(options["interval"])
