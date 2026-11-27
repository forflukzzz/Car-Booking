import { supabase } from "./supabase";

const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const decodeKey = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));

export const registerPushSubscription = async (userUid: string) => {
  if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(vapidPublicKey) });
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_uid: userUid, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh || "", auth: json.keys?.auth || "", enabled: true,
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
};

export const removePushSubscriptions = async (userUid: string) => {
  if (userUid) await supabase.from("push_subscriptions").update({ enabled: false }).eq("user_uid", userUid);
};

export const notifyPushActivity = async (activity: { type: "borrow" | "return"; requester: string; model?: string; plate?: string; requesterUid?: string }) => {
  await supabase.functions.invoke("notify-activity", { body: activity });
};
