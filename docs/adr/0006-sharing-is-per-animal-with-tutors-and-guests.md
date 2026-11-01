# 0006. Sharing is per animal, with tutors and guests

- Status: accepted
- Date: 2026-10-31

## Context

More than one person looks after an animal: someone who shares the care, and
now and then someone who looks after it for a while (a pet sitter during a
trip). An animal can also change owner, and its history should go with it.

## Decision

- **Access is per animal**: a person, an animal and a role. There is no
  household or any other grouping.
- **Tutor** can do everything: record, edit, invite, remove, archive, delete.
- **Guest** reads everything about the animal and writes only weights and notes
  (and edits only the ones they wrote). A guest receives no reminder. A guest's
  access may have a last day; from the day after, the access no longer holds,
  with no job involved, because every access check reads the end.
- Authorization is applied **in the backend on every route**
  (`backend/animals/access.py`). An animal the caller has no access to answers
  404, so its existence does not leak; an action the role does not allow
  answers 403.
- **An invite is a link**: single-use, valid for 3 days, carrying the role and,
  for a guest, the access's last day. Opening it shows who invited, the animal
  and the role; someone with no account creates one and comes back to accept
  (`docs/flows/invite-accept.md`).
- **Every active animal keeps a tutor.** The last tutor can neither leave nor
  be removed; the app asks to invite another tutor or delete the animal
  (`docs/flows/leave-animal.md`). Giving an animal away is inviting the new
  owner as a tutor and leaving.
- There is no public link to an animal and no QR code.

## Consequences

- A person who cares for three animals has three accesses, and an invite is
  sent per animal.
