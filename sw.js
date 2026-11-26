// Caches only the app shell (so it opens instantly); answers and data always come from the network.
const CACHE = "jarvis-shell-91698432";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); });
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Timer / reminder alerts: show a notification (even with the app closed) and tell an open app to speak it.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification("J.A.R.V.I.S. · " + (d.title || "Alert"), {
      body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag || "jarvis",
      vibrate: [250, 120, 250, 120, 400], requireInteraction: true, renotify: true, data: { url: d.url || "./" } });
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) c.postMessage({ type: "alarm", body: d.body });
  })());
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    // briefing / recap notifications carry ./?brief=1 or ./?recap=1: the app reads it out when opened
    const url = (e.notification.data && e.notification.data.url) || "./";
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) { await all[0].focus(); all[0].postMessage({ type: "open", url }); return; }
    return self.clients.openWindow(url);
  })());
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  // Something shared to Jarvis from another app (Cookbook): keep the text for the page, then open the app on ?share=1.
  if (e.request.method === "POST" && u.origin === location.origin && u.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      let text = "";
      try { const f = await e.request.formData(); text = ["title", "text", "url"].map((k) => f.get(k)).filter((v) => typeof v === "string" && v.trim()).join(String.fromCharCode(10, 10)); } catch {}
      const c = await caches.open("jarvis-share");
      await c.put(new URL("share", self.registration.scope).href, new Response(JSON.stringify({ text, at: Date.now() }), { headers: { "content-type": "application/json" } }));
      return Response.redirect(new URL("./?share=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // never touch API calls
  // Always ask the network for the newest copy (cache: "no-cache" revalidates past GitHub Pages'
  // 10-minute caching), and fall back to the saved copy only when offline. Before this, phones kept
  // showing an old version after an update (2026-11-15: no Alerts button).
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
