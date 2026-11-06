/*
 * The Pets service worker: it shows the notice pushes the backend sends
 * (ADR-0004, ADR-0009) and opens the animal when one is tapped, with the
 * notice's id as ?aviso= so the app marks it read. It caches nothing; the app
 * needs the API to be useful.
 *
 * Payload: {title, body, url, animal_id, notice_id}.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Pets";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.animal_id ? `animal-${payload.animal_id}` : undefined,
      data: { url: payload.url || "/", notice_id: payload.notice_id },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "/", self.location.origin);
  if (data.notice_id) target.searchParams.set("aviso", data.notice_id);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target.href);
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
