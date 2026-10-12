import { useContext } from "react";
import { NotificationContext } from "../../context/notifications/notificationContextStore.js";
export function useNotifications() {
  const notifications = useContext(NotificationContext);
  if (!notifications)
    throw new Error("useNotifications requires NotificationProvider.");
  return notifications;
}
