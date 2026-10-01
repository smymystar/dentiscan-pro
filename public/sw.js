self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // ปล่อยให้ผ่านไปตามปกติสำหรับการดึงข้อมูลทั่วไป
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
