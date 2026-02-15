// notification services barrel

// notification
export {
  isQuietHours,
  shouldSendNotification,
  sendPushNotification,
  sendEmailNotification,
  getDefaultPreferences,
  notifyUser,
} from "./notification";
export type {
  NotificationType,
  NotificationChannel,
  NotificationPrefs,
  PushSubscriptionData,
  NotificationPayload,
} from "./notification";

// support-tickets
export {
  formatTicketNumber,
  getUrgencyWeight,
  sortTicketsByPriority,
  createTicket,
  getUserTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addTicketNote,
} from "./support-tickets";

// milestone-preferences
export {
  DEFAULT_LVR_THRESHOLDS,
  DEFAULT_EQUITY_THRESHOLDS,
  resolveThresholds,
} from "./milestone-preferences";
export type {
  ThresholdConfig,
  GlobalPrefs,
  PropertyOverride,
} from "./milestone-preferences";
