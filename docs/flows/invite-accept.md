# Accepting an invite

Someone opens an invite link (ADR-0006). The link is single-use and valid for
3 days; it carries the role and, for a guest, the access's last day. It is sent
to no address, so it does not confirm anyone's e-mail (ADR-0002): a new
account types its e-mailed code before it can accept.

```mermaid
flowchart TD
  A["Person opens the invite link"] --> B{"Invite valid?"}
  B -->|"expired"| X1["Invite expired: ask for a new link"]
  B -->|"already used"| X2["Invite already used: ask for a new link"]
  B -->|"yes"| C["Invite screen: who invited, the animal and the role"]
  C --> D{"Signed in?"}
  D -->|"no"| E["Create an account or sign in"]
  E --> V{"E-mail confirmed?"}
  V -->|"yes"| C
  V -->|"no"| W["Type the code e-mailed to the address"]
  W --> C
  D -->|"yes"| F{"Already has access to the animal?"}
  F -->|"yes"| X3["You already have access to this animal"]
  F -->|"no"| G["Accept"]
  G --> H["Access created with the invite's role and end; invite spent"]
  H --> I["Opens the animal"]
```
