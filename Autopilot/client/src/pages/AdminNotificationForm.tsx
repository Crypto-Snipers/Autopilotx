import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { UsersRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Send } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast";
import Lowheader from "@/components/Lowheader";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { apiRequest } from "@/lib/queryClient"
import { useLocation } from "wouter"

interface AdminUser {
  is_admin: boolean
  name: string
}

export default function AdminNotificationPage() {
  const [notification, setNotification] = useState({
    title: "",
    message: "",
    user_type: "ALL",
    start_time: new Date(),
    platform: "WEB",
    notification_type: "info",
  })

  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [_, navigate] = useLocation()
  const handleUserTypeChange = (value: string) => {
    setNotification({ ...notification, user_type: value })
  }


  // Check admin access if a user tried to access this page directly
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const email = sessionStorage.getItem('signupEmail') || '';
        const res = await apiRequest<{ success: boolean; email: string; role: string; }>(
          "GET",
          `/api/get-role?email=${encodeURIComponent(email)}`
        );

        if (res?.role !== "superadmin" && res?.role !== "admin") {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access the admin dashboard.",
            variant: "destructive",
          });
          navigate("/home");
          return;
        }

        setCurrentUser({
          is_admin: res.role === "admin" || res.role === "superadmin",
          name: res.email, // or use res.name if available
        });
      } catch (err) {
        console.error("Auth check failed:", err);
        setCurrentUser({ is_admin: true, name: "Admin" }); // fallback, remove if not intended
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAdminAccess();
  }, [navigate, toast]);


  const handleSendNotification = async () => {
    const notificationData = {
      ...notification,
      created_by: "upadhyaymanisha13@gmail.com",
      created_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    }

    try {
      const result = await apiRequest("POST", `/api/notifications`, notificationData);
      console.log("Notification created:", result);

      toast({
        title: "Success",
        description: "Notification sent successfully!",
        className: "bg-green-100 border-green-500 text-green-800",
      });
    } catch (error: any) {
      console.error("Error while sending notification:", error.message);
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    }

  }
  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-[#2d3139]">
      <Sidebar />

      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />
        <div>
          <div className="container mx-auto p-6 space-y-6">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold text-start">Notification Dashboard</h1>
            </div>
            <Card>
              <CardHeader>
                <div className="flex justify-between">
                  <CardTitle>Notification Details</CardTitle>
                  <div className="flex items-center space-x-2">
                    <UsersRound className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-gray-500">All the users will receive this notification</p>
                  </div>
                </div>
                <CardDescription>Configure your notification settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={notification.title}
                    onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                    placeholder="Enter notification title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={notification.message}
                    onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                    placeholder="Enter notification message"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notification Post On</Label>
                  <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded p-2">
                    <CalendarIcon className="h-4 w-4" />
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {format(new Date(), "PPP")}
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>

            <div className="mt-6 flex justify-start">
              <Button
                onClick={handleSendNotification}
                disabled={!notification.title || !notification.message}
                className="min-w-32 cursor-pointer bg-[#1a785f] hover:bg-[#1e896d]"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


