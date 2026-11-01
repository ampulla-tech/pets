# Domain glossary

The words this repository uses, what each means, and the identifier that
carries it in the code. On-screen text is pt-BR; identifiers are English.

| Term (pt-BR on screen) | Identifier | Meaning |
|---|---|---|
| Conta | `accounts.User` | A person's own account in this app, with e-mail and password (ADR-0002). Usable only once its e-mail is confirmed with the code e-mailed at sign-up (allauth's `verify_email`). |
| Código | code | Eight letters and digits, `XXXX-XXXX`, e-mailed by the API and typed into the app, valid for 15 minutes: one confirms a new account's e-mail, another sets a new password. |
| Animal | `Animal` | A dog or a cat (`species`: `dog`, `cat`) with its profile: name, photo, breed, sex, neutered, coat, microchip, birth and adoption. `active` or `archived`. |
| Nascimento | `birth_precision`, `birth_date` | The birth as far as it is known: `exact` (a day), `month` (a month and year), `year`, or `unknown`. A coarser birth is stored as the first day of its month or year. The **age** is computed from it and marked approximate when the birth is. |
| Adoção | `adopted_on` | The day the animal arrived, apart from its birth. |
| Arquivar | `archive`, `archived_reason`, `archived_on` | Taking an animal off the home screen with a reason (`died`, `rehomed`, `other`) and a day. Its history stays readable; its reminders are suspended. |
| Acesso | `Access` | A person's access to an animal, with a role. Every active animal has at least one tutor. |
| Tutor | `Role.TUTOR` | The role that can do everything to an animal, and the only one that receives reminders. |
| Convidado | `Role.GUEST` | The role that reads everything and writes only weights and notes. Its access may have a last day (`ends_on`), after which it no longer holds. |
| Convite | `Invite` | A single-use link, valid for 3 days, that grants a role on one animal (and, for a guest, an access end). |
| Registro | record (`Record`) | One thing that happened to an animal on a day: a vaccine, an antiparasitic, a weight, a note or a visit. It keeps its author, its last edit and its attachments. |
| Vacina | `Vaccine` | A record of a vaccine: brand, lot, lot expiry, the diseases it covers (one or more), "repeat on", vet and CRMV. |
| Doença coberta | disease code (`animals/diseases.py`) | What a vaccine protects against, from a closed list per species kept in the code. Dog: distemper, infectious hepatitis, parvovirus, parainfluenza, leptospirosis, coronavirus, rabies, kennel cough, canine influenza, giardia, leishmaniasis. Cat: rhinotracheitis, calicivirus, panleukopenia, chlamydiosis, FeLV, rabies. |
| Antiparasitário | `Antiparasitic` | A record of a dewormer (`internal`, worms) or a flea and tick treatment (`external`): product, dose, "repeat on", vet, and an optional weight taken in the same step, which becomes a Weight of its own. |
| Peso | `Weight` | A record of the animal's weight, in kg. |
| Observação | `Note` | A dated free-text note. |
| Consulta | `Visit` | A visit or exam: clinic, vet, reason and notes, with photos and PDFs attached as files only. |
| Anexo | `Attachment` | A photo or a PDF in the media storage, owned by one animal. One attachment can serve several records (the photo of a card page). Served through a signed link that expires. |
| Repetir em | `repeat_on`, `repeat_on_origin` | The day the vet wrote for the next dose. `written` in its box, or `inferred` from a lone future date on the line below. The only source of a reminder's date. |
| Assunto | subject | What a reminder is about: a disease code, or an antiparasitic kind (`internal`, `external`). |
| Lembrete | reminder (`reminders/logic.py`) | Derived, never typed: a dose with "repeat on" opens one for its subject; a later dose of the same subject closes it. States: `no_date`, `scheduled`, `upcoming`, `due`, `overdue`, `closed`, `suspended`. |
| Marco | milestone | When a reminder sends a notice: 7 days before (`early`), on the day (`due`), and every 7 days while overdue (`overdue-N`). |
| Envio | `Delivery` | The log of one notice sent: (reminder, milestone, person, channel). It keeps each to one send. |
| Canal | `Channel` | How a notice reaches a tutor: `email` (always), `expo` (each phone), `webpush` (each browser). |
| Próximos | upcoming | The home screen's list: what is overdue and what falls due within 30 days, across the caller's animals, by date. |
| Selo | badge | An animal card's one-glance state: `up_to_date`, `due_soon` (with the days), `overdue`, or `none`. |
| Leitura / extração | `Extraction` | One reading of a card's photos by the model, with its state (`processing`, `ready`, `failed`) and its proposals. |
| Registro proposto | proposal | One line the reading found, each field `{value, read}`; `pending` until the tutor confirms it (it becomes a record) or discards it. |
| Gabarito | answer key | The confirmed transcription of the evaluation cards the benchmark scores the models against. Kept out of the repository. |
| Carteirinha | card | The screen and the PDF for the vet: per subject, the last dose and the next one, with the label photo. |
