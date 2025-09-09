const CACHE_NAME = 'bs-edu-feedback-v4';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 즉시 활성화하여 기존 서비스 워커를 대체
        self.postMessage({ type: 'SKIP_WAITING' });
        return self.skipWaiting();
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시된 버전이 있으면 반환, 없으면 네트워크에서 가져오기
        return response || fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // 모든 클라이언트에서 즉시 새 서비스 워커가 제어하도록 함
        return self.clients.claim();
      });
    })
  );
});