import iconUrl from "../assets/img/icon.ico";

export const requestBrowserNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  return Notification.permission === "granted";
};

export const showBrowserNotification = async (title: string, body: string) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, { body, icon: iconUrl, tag: "car-booking-activity" });
      return;
    }
    new Notification(title, { body, icon: iconUrl, tag: "car-booking-activity" });
  } catch {
    new Notification(title, { body, icon: iconUrl, tag: "car-booking-activity" });
  }
};
