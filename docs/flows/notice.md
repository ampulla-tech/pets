# The daily notice run

What `send_reminders` does once a day (`reminders/dispatch.py`, ADR-0004 and
ADR-0009). A notice is written once per person, animal and day with its words
frozen; each channel then only delivers it. The words come from
`reminders/wording.py`.

```mermaid
flowchart TD
  A["Daily run: each active animal"] --> B{"Did an open reminder reach a milestone?"}
  B -->|"no"| S0["Nothing to tell"]
  B -->|"yes"| C["For each tutor of the animal"]
  C --> D{"Are the milestones already in a notice of this person?"}
  D -->|"all of them"| G["Recent notices not yet delivered on some channel"]
  D -->|"some are not"| F["Write one notice: title, second line, link"]
  F --> G
  G --> H{"Does the channel have a destination?"}
  H -->|"no"| S1["Skip the channel, log nothing"]
  H -->|"yes"| I["Deliver the notice"]
  I -->|"reached"| J["Log the delivery (notice, channel)"]
  I -->|"failed"| K["Log nothing: the next day's run tries the same notice"]
  I -->|"destination gone: DeviceNotRegistered, 404, 410"| L["Delete the destination"]
  K --> M{"Is the notice older than a day by then?"}
  M -->|"yes"| S2["Given up: the notice stays in the app's list"]
  M -->|"no"| G
```
