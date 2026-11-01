"""Run the card-reading candidates against the answer key and write the report.

    uv run python manage.py benchmark_intake \
        --key /path/to/gabarito.json --photos /path/to/photos \
        --models anthropic/x,google/y,openai/z,qwen/w --runs 3

The key and the photos hold third-party personal data and never enter the
repository: they are read from the paths given (or PETS_BENCHMARK_KEY and
PETS_BENCHMARK_PHOTOS). The report holds aggregate scores only. Needs
OPENROUTER_API_KEY; every call is paid.
"""

import json
import os
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from animals.attachments import normalise_image
from intake.benchmark import ModelResult, RunScore, choose, load_key, report, score_card
from intake.reading import Photo, read_card

# Out of credit (402) or over the workspace budget (403): every later call
# would fail the same way, so the run stops instead of scoring zeros.
CREDIT_ERRORS = {402, 403}

EXTENSIONS = (".HEIC", ".heic", ".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG")


def find_photo(folder: Path, stem: str) -> Path:
    for extension in EXTENSIONS:
        candidate = folder / f"{stem}{extension}"
        if candidate.exists():
            return candidate
    raise CommandError(f"no photo named {stem} in {folder}")


class Command(BaseCommand):
    help = "Benchmark the card-reading models against the answer key."

    def add_arguments(self, parser):
        parser.add_argument("--key", default=os.environ.get("PETS_BENCHMARK_KEY"))
        parser.add_argument("--photos", default=os.environ.get("PETS_BENCHMARK_PHOTOS"))
        parser.add_argument("--models", required=True, help="comma-separated OpenRouter ids")
        parser.add_argument("--runs", type=int, default=3)
        parser.add_argument(
            "--output",
            default=str(Path(settings.BASE_DIR).parent / "docs" / "benchmark" / "card-reading.md"),
        )

    def handle(self, *args, **options):
        if not options["key"] or not options["photos"]:
            raise CommandError("give --key and --photos (or PETS_BENCHMARK_KEY/_PHOTOS)")
        if not settings.OPENROUTER_API_KEY:
            raise CommandError("OPENROUTER_API_KEY is not set")
        cards = load_key(json.loads(Path(options["key"]).read_text()))
        folder = Path(options["photos"]).expanduser()
        photos = {
            card.name: [
                Photo(normalise_image(find_photo(folder, stem).read_bytes()))
                for stem in card.photos
            ]
            for card in cards
        }
        results = []
        for model in [m.strip() for m in options["models"].split(",") if m.strip()]:
            result = ModelResult(model=model, runs=[])
            for run in range(options["runs"]):
                score = RunScore()
                for card in cards:
                    score.cards += 1
                    try:
                        read = read_card(
                            photos[card.name],
                            card.species,
                            model,
                            settings.OPENROUTER_API_KEY,
                            timeout=settings.INTAKE_TIMEOUT_SECONDS,
                        )
                    except Exception as error:
                        if getattr(error, "status_code", None) in CREDIT_ERRORS:
                            raise CommandError(
                                f"OpenRouter refused for credit or budget: {error}"
                            ) from error
                        self.stderr.write(f"{model} run {run + 1}: a card failed: {error!r}")
                        result.errors += 1
                        score.cost_known = False
                        score_card(score, card.records, [])
                        continue
                    score.seconds.append(read.seconds)
                    if read.cost is None:
                        score.cost_known = False
                    else:
                        score.cost += float(read.cost)
                    score_card(score, card.records, read.proposals)
                result.runs.append(score)
                self.stdout.write(
                    f"{model} run {run + 1}: {score.matched}/{score.expected} records, "
                    f"+{score.extra} extra"
                )
            results.append(result)
        text = report(results, options["runs"], date.today().isoformat())
        output = Path(options["output"])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text)
        self.stdout.write(text)
        chosen = choose(results)
        self.stdout.write(
            f"chosen: {chosen.model}" if chosen else "no model passed; none is configured"
        )
