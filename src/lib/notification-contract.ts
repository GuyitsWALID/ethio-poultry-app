export const notificationSeverities = ["high", "medium", "low"] as const;
export const inAppThresholds = ["low", "medium", "high", "off"] as const;

export type NotificationSeverity = (typeof notificationSeverities)[number];
export type InAppThreshold = (typeof inAppThresholds)[number];

export type NotificationPreference = {
  inAppMinimumSeverity: InAppThreshold;
  emailEnabled: boolean;
  emailMinimumSeverity: NotificationSeverity;
};

export type NotificationItem = {
  id: string;
  actionId: string;
  eventType: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  actorName: string | null;
  actorRole: string | null;
  actionContext: string | null;
  dueAt: string | null;
  route: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCenter = {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreference;
  email: {
    available: boolean;
    enabled: boolean;
    reason: string | null;
  };
};
