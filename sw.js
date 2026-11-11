/* El sitio se mudó a /clubes-tdm/spin-tdm/. Este service worker reemplaza al de la app vieja:
   borra sus cachés ("spin-v…") y se da de baja. La redirección la hace index.html (conserva la sección #/…).
   No toca las cachés de la app nueva ("spin-tdm-…"), que comparten el dominio. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => /^spin-v\d+$/.test(k)).map((k) => caches.delete(k)));
    await self.registration.unregister();
  })());
});
