# Saving a vaccine

What happens when a tutor saves a vaccine, by hand or by confirming a line of a
reading, in the web or the native app (ADR-0011). The five fields of the label
and the stamp are brand, lot, lot expiry, vet and CRMV.

```mermaid
flowchart TD
  A["The tutor taps Save, or Confirm on a reading's line"] --> B{"Are the date, the diseases and the five filled in?"}
  B -->|"no"| C["Nothing is sent: a message under each empty field"]
  C --> A
  B -->|"yes"| D{"Is the lot expiry a valid month?"}
  D -->|"no"| E["Nothing is sent: Use mês e ano, por exemplo 09/2027"]
  E --> A
  D -->|"yes"| F["The app sends the vaccine to the API"]
  F --> G{"Does the API accept it?"}
  G -->|"yes"| H["The vaccine is saved and the reminders recomputed"]
  G -->|"no: a field empty, blank or out of format"| I["422 with the error on that field"]
  I --> J["The app says Algo deu errado. Tente de novo."]
```

The apps check the same rules as the API, so the 422 is met only by a client
that does not, or by an app older than ADR-0011.
