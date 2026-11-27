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

const invokeNotifyActivity = async (activity: { type: "issue"; requester: string; requesterUid?: string; model: string; plate: string; issueReport: string }) => {
  const result = await supabase.functions.invoke("notify-activity", { body: activity });
  if (result.error) {
    let details = result.error.message;
    const response = (result.error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json();
        if (payload?.error) details = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      } catch {
        // Keep the original Supabase error when the response is not JSON.
      }
    }
    throw new Error(details);
  }
  return result;
};

export const notifyPushActivity = async (activity: { type: "issue"; requester: string; requesterUid?: string; model: string; plate: string; issueReport: string }) => {
  const { data, error } = await invokeNotifyActivity(activity);
  if (error) throw new Error(`ส่งแจ้งเตือนไม่สำเร็จ: ${error.message}`);
  if (data?.sent === 0) throw new Error("ไม่พบอุปกรณ์ของ Manager ที่เปิดรับการแจ้งเตือน");
  return data;
};
