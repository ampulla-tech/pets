# Photo intake

A tutor loads a card page into an animal's history by photo. The model only
proposes; nothing is written until the tutor confirms a line (ADR-0005). The
reading runs outside the request, in the worker, and the client follows its
state.

```mermaid
flowchart TD
  A["Tutor opens the animal and taps add by photo"] --> B["Takes or picks one or more photos"]
  B --> C["Photos upload"]
  C -->|"network failure"| CF["Upload failed: try again"]
  CF --> C
  C --> D["Reading in progress"]
  D -->|"provider failed, nothing read or not configured"| DF["Reading failed: try again or fill in by hand"]
  DF -->|"try again"| D
  DF -->|"fill in by hand"| M["Manual form with the photo attached"]
  D --> E["List of proposed records"]
  E --> F{"For each line"}
  F -->|"unread field"| G["Field empty and marked: tutor fills it in"]
  G --> F
  F -->|"discard"| H["Line discarded, nothing written"]
  F -->|"confirm"| I["Record written with the whole photos attached"]
  I --> J["The animal's reminders recomputed"]
  M --> I
```
