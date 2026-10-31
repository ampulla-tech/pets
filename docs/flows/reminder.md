# The reminder of one disease of one animal

The life of the reminder for one subject (a disease, or an antiparasitic kind)
of one animal (ADR-0003). It is derived from the doses, never typed; the daily
job sends a notice at each milestone (ADR-0004): seven days before (entering
`Upcoming`), on the day (`Due`), and every seven days while `Overdue`.

```mermaid
stateDiagram-v2
  [*] --> NoDate: "dose without repeat on"
  NoDate --> Scheduled: "tutor sets the date"
  [*] --> Scheduled: "dose with repeat on"
  Scheduled --> Upcoming: "7 days left"
  Upcoming --> Due: "the day arrives"
  Due --> Overdue: "the day passes with no new dose"
  Overdue --> Overdue: "weekly notice"
  Scheduled --> Closed: "new dose of the same disease"
  Upcoming --> Closed: "new dose of the same disease"
  Due --> Closed: "new dose of the same disease"
  Overdue --> Closed: "new dose of the same disease"
  Scheduled --> Suspended: "animal archived"
  Upcoming --> Suspended: "animal archived"
  Due --> Suspended: "animal archived"
  Overdue --> Suspended: "animal archived"
  Closed --> [*]
```
