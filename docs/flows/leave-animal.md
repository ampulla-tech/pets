# A tutor leaves an animal

Every active animal keeps at least one tutor (ADR-0006). The backend refuses
the last tutor's leaving, and removing the last tutor in any other way, with
`409 last_tutor`.

```mermaid
flowchart TD
  A["Tutor taps leave the animal"] --> B{"Is there another tutor?"}
  B -->|"yes"| C["Access removed"]
  B -->|"no"| D["Blocked: invite another tutor or delete the animal"]
  D -->|"invite"| E["Creates a tutor invite"]
  D -->|"delete"| F["Confirm the permanent deletion"]
  F --> G["Animal, records and attachments deleted"]
```
