# The lot expiry migration

What `animals/0002_lot_expiry_is_a_month` does to the vaccines already stored
(ADR-0010). It runs inside one transaction, in the one-off `migrate` container
that `deploy.sh` starts before it swaps the release.

```mermaid
flowchart TD
  A["Each vaccine with a lot expiry"] --> B{"Is it YYYY-MM already?"}
  B -->|"yes"| C["Keep it"]
  B -->|"no"| D{"Is it M/AAAA, MM/AAAA or AAAA-M, with a month from 1 to 12?"}
  D -->|"yes"| E["Convert it to YYYY-MM"]
  D -->|"no"| F["Add it to the unconvertible list"]
  C --> G{"Is the list empty?"}
  E --> G
  F --> G
  G -->|"yes"| H["Save the conversions: the deploy goes on"]
  G -->|"no"| I["Fail with the id and value of each one: the transaction is undone"]
  I --> J["The deploy stops: the running release keeps serving"]
  J --> K["The maintainer fixes those vaccines by hand and runs the deploy again"]
```
