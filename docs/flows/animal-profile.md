# The animal's profile

What the profile shows, by the viewer's role and by what the animal has
recorded. Every empty part leads to what fills it, for whoever can use it. The
history is not here: it lives in the card (`docs/agents/domain.md`,
Carteirinha). Registrar, Carteirinha and Pessoas or Tutores sit under the
header in every branch below.

```mermaid
flowchart TD
  A["Opens the animal's profile"] --> B{"Is the animal active?"}
  B -->|"no, archived"| R["No Registrar: Carteirinha and Pessoas or Tutores only"]
  B -->|"yes"| C{"The viewer's role"}
  C -->|"tutor"| T["Registrar, Carteirinha and Pessoas"]
  C -->|"guest"| G["Registrar, Carteirinha and Tutores"]
  T --> D{"Anything recorded?"}
  G --> D
  D -->|"nothing"| E1{"Role"}
  E1 -->|"tutor"| E2["One block: read the paper card's photos"]
  E1 -->|"guest"| E3["One block: register a weight"]
  D -->|"something"| F["Reminders, current weight and the animal's data"]
  F --> H{"An open reminder?"}
  H -->|"no, tutor"| H1["Dashed card: register a vaccine"]
  H -->|"no, guest"| H2["Dashed card with the text, no button"]
  H -->|"yes"| H3["The reminders' lines"]
  F --> P{"Weighings"}
  P -->|"none"| P1["Dashed card: register a weight"]
  P -->|"one"| P2["The number, with no curve and no change"]
  P -->|"two or more"| P3["The number, the change and the curve"]
```

Registrar opens a sheet: for a tutor, reading the paper card's photos first and
the five kinds by hand below; for a guest, weight and note.
