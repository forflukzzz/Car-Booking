self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Car Booking", body: event.data?.text() || "มีรายการใหม่" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Car Booking", {
    body: data.body || "มีรายการใหม่", icon: data.icon || "/app-icon.png", badge: data.badge || "/app-icon.png",
    tag: data.tag || "car-booking-activity", data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const current = windows.find((window) => "focus" in window);
    return current ? current.focus() : clients.openWindow(event.notification.data?.url || "/");
  }));
});
