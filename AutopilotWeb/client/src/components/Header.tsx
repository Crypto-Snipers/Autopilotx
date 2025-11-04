import React, { useEffect, useState, useRef } from "react";
import { Menu, Phone, MessageSquare, Bell, X, Check, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSessionItem } from "@/lib/sessionStorageUtils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/context/ThemeContext";


type NotificationType = 'success' | 'warning' | 'info' | 'error';
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string; // ISO date string
  read: boolean;
}

const validTypes = ['success', 'warning', 'info', 'error'];


const useNotifications = (email: string | undefined) => {
  return useQuery<Notification[]>({
    queryKey: ['notifications', email],
    enabled: !!email,
    queryFn: async () => {
      const url = `/api/notifications?platform=WEB&user_type=ALL&user_email=${encodeURIComponent(email || '')}`;
      const data = await apiRequest("GET", url);

      if (!Array.isArray(data)) {
        throw new Error("Invalid response format");
      }

      return data.map((n: any) => ({
        id: n.id,
        type: validTypes.includes(n.type) ? n.type : 'info',
        title: n.title,
        message: n.message,
        time: n.time || '',
        read: n.read ?? false,
      }));
    },
    refetchInterval: 10000,           // 10 seconds polling
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1,
    staleTime: 30000,
  });
};


export default function Header() {
  const { user } = useAuth();
  // --- CHANGE: Get theme and toggle function from the global context ---
  const { theme, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState("User");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const { data: userNotifications, isLoading: notificationsLoading, error: notificationsError } = useNotifications(user?.email);

  useEffect(() => {
    if (userNotifications) {
      setNotifications(userNotifications); // or update state if needed elsewhere
    }
  }, [userNotifications]);


  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;



  // Toggle notifications and mark unread as read
  const toggleNotifications = async () => {
    setShowNotifications(!showNotifications);

    if (!showNotifications) {
      // Mark all unread notifications as read
      const unread = notifications.filter(n => !n.read);

      await Promise.all(
        unread.map(async (n) => {
          try {
            const res = await fetch(`/api/notifications/${n.id}/read?user_email=${encodeURIComponent(user?.email || '')}`, {
              method: "POST",
            });
            if (!res.ok) {
              console.error(`Failed to mark notification ${n.id} as read`);
            }
          } catch (err) {
            console.error("Error marking as read:", err);
          }
        })
      );

      // Update frontend state
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    }
  };


  // Get the appropriate icon based on notification type
  const getNotificationIcon = (type: NotificationType) => {
    const baseClass = "w-6 h-6 mt-1 rounded-full flex items-center justify-center";
    switch (type) {
      case 'success':
        return (
          <div className={`${baseClass} bg-green-100`}>
            <Check className="w-3 h-3 text-green-600" />
          </div>
        );
      case 'warning':
        return (
          <div className={`${baseClass} bg-yellow-100`}>
            <span className="text-yellow-600">!</span>
          </div>
        );
      case 'error':
        return (
          <div className={`${baseClass} bg-red-100`}>
            <X className="w-3 h-3 text-red-600" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className={`${baseClass} bg-blue-100`}>
            <span className="text-blue-600">i</span>
          </div>
        );
    }
  }

  useEffect(() => {
    const storedName = getSessionItem("signupName", "")
    if (storedName) {
      setUserName(storedName)
    }
  }, [])

  // Remove a notification by id
  const removeNotification = async (id: string) => {
    if (!user?.email) return;

    try {
      const res = await fetch(
        `/api/notifications/${id}/dismiss?user_email=${encodeURIComponent(user.email)}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        console.error(`Failed to dismiss notification ${id}`);
      } else {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error("Dismiss error:", err);
    }
  };

  // --- CHANGE: Removed incorrect local theme state ---

  return (
    // --- CHANGE: Applied theme-aware background and border ---
    <header className="bg-background border-b border-border sticky top-0 z-10">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center">
          <button
            className="text-muted-foreground hover:text-foreground md:hidden mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>


        <div className="flex items-center space-x-4">
          {/* --- CHANGE: Applied theme-aware styles to the button and icons --- */}
          <div className="bg-muted hover:bg-[#1a785f] w-7 h-7 rounded-full flex items-center justify-center">
            <button
              onClick={toggleTheme}
              className="text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="relative" ref={notificationRef}>
            <div className="bg-[#1a785f] w-7 h-7 rounded-full">
              <button
                className="relative text-white p-1"
                onClick={toggleNotifications}
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[10px] font-medium text-white bg-red-500 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
            {showNotifications && (
              // --- CHANGE: Applied theme-aware styles to notification panel ---
              <div className="bg-card fixed top-0 right-0 h-full w-80 shadow-lg z-50">
                <div className="flex justify-between items-center p-4 border-b border-border">
                  <h3 className="text-lg font-medium text-foreground">Notifications</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="h-[calc(100%-60px)] overflow-y-auto">
                  <div className="p-4">
                    {notificationsLoading ? (
                      <p className="text-sm text-muted-foreground text-center mt-4">Loading notifications...</p>
                    ) : notificationsError ? (
                      <div className="text-center mt-4">
                        <p className="text-sm text-red-500 mb-2">Error: {notificationsError.message}</p>
                        <button
                          onClick={() => window.location.reload()}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center mt-4">No notifications.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="flex items-start justify-between mb-4 border-b border-border pb-2">
                          <div className="flex items-start gap-2">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1">
                              <h4 className={`font-medium ${!notification.read ? "font-bold" : "font-normal"}`}>
                                {notification.title}</h4>
                              <p className="text-sm text-muted-foreground">{notification.message}</p>
                              <span className="text-xs text-muted-foreground">{notification.time}</span>
                            </div>
                          </div>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => removeNotification(notification.id)}
                            aria-label="Remove notification"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="flex items-center space-x-2">
              {user?.identities?.[0]?.identity_data?.avatar_url ? (
                <img
                  src={user.identities[0].identity_data.avatar_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {user?.identities?.[0]?.identity_data?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                </div>
              )}
              <div className="text-sm text-left hidden sm:block">
                <div className="font-medium text-foreground">{user?.identities?.[0]?.identity_data?.full_name || user?.user_metadata?.full_name || userName || "User"}</div>
                <div className="text-xs text-muted-foreground">
                  {user?.email || "user@example.com"}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - would be implemented in a real app */}
      {mobileMenuOpen && (
        // --- CHANGE: Applied theme-aware styles to mobile menu ---
        <div className="md:hidden bg-background border-b border-border px-4 py-2">
          {/* Mobile menu items */}
        </div>
      )}
    </header>
  );
}