# The notification on one device, in the Avisos tab

What the web app (`web/src/components/DevicePush.tsx`) and the native app
decide on their own about the notification of the device they run on. The
states and the banner rule are shared (`packages/core/src/domain/push.ts`);
each app works out its own state. What the server sends is drawn in
[`notice.md`](./notice.md).

```mermaid
flowchart TD
  A["Opens the Avisos tab"] --> B{"Notification state on this device"}
  B -->|"active"| L["Only the list"]
  B -->|"blocked or unsupported"| L
  B -->|"askable"| C{"Agora não kept on this device?"}
  B -->|"ios-install"| C2{"Agora não kept on this device?"}
  C -->|"yes"| L
  C2 -->|"yes"| L
  C -->|"no"| D["Banner: Ativar notificações and Agora não"]
  C2 -->|"no"| E["Banner: steps to install and Agora não"]
  D -->|"Agora não"| M["Kept on the device"]
  E -->|"Agora não"| M
  M --> L
  D -->|"Ativar"| F["The system's permission prompt"]
  F -->|"allowed"| G["Registers the device with the server"]
  G -->|"registered"| L
  G -->|"failed"| X1["Could not switch on: try again"]
  F -->|"refused"| X2["Becomes blocked"]
  X2 --> L
  L --> N["Menu: Ativar notificações, unless active or unsupported"]
  N -->|"askable"| F
  N -->|"blocked"| O["Sheet with the steps to unblock in the settings"]
  N -->|"ios-install"| P["Sheet with the steps to install"]
  Q["App opens with the permission taken away and a registration kept"] --> R["Removes the registration from the server and forgets it here"]
```
