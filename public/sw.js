self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Sem cache de APIs, tokens ou papeletas. Registro exige conex?o.
