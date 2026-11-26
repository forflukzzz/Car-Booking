import iconUrl from "../assets/img/icon.ico";

export const requestBrowserNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  return Notification.permission === "granted";
};

export const showBrowserNotification = (title: string, body: string) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: iconUrl,
    tag: "car-booking-request",
  });
};
