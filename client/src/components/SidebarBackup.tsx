import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Lock, Settings, Home, BarChart, LineChart, History, Youtube, Instagram, MessageCircle, LogOut, UserCog, ChartNoAxesCombined } from "lucide-react";
import { clearLocalStorage, clearSessionStorage } from "@/lib/sessionStorageUtils";
import { apiRequest } from "@/lib/queryClient";

export default function Sidebar() {
  const { user, signout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const location = window.location.pathname;



  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.email) {
        try {
          const response = await apiRequest<{ message: string; is_admin: boolean; name?: string }>(
            "GET",
            `/api/admin/is-admin?email=${encodeURIComponent(user.email)}`
          );

          if (response?.is_admin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      }
    };

    checkAdminStatus();
  }, [user]);


  // Handle logout functionality
  const handleLogout = async () => {
    try {
      await signout();

      // Clear any additional storage if needed
      localStorage.removeItem('broker_name');
      localStorage.removeItem('api_verified');
      clearSessionStorage();
      clearLocalStorage();

      // Redirect to sign-in page after logout
      window.location.href = '/signin';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };



  const navItems = [
    { name: "Home", path: "/", icon: <Home className="w-5 h-5 mr-2" /> },
    { name: "Strategies", path: "/strategies", icon: <BarChart className="w-5 h-5 mr-2" /> },
    { name: "Positions", path: "/positions", icon: <LineChart className="w-5 h-5 mr-2" /> },
    { name: "History", path: "https://coindcx.com/stats/futures/positions", icon: <History className="w-5 h-5 mr-2" /> },

    // Only show admin-notification-page if user is admin
    ...(isAdmin ? [{ name: "Notifications", path: "/admin/notifications", icon: <Settings className="w-5 h-5 mr-2" /> }] : []),

    ...(isAdmin ? [{ name: "Approvals", path: "/admin/approvals", icon: <UserCog className="w-5 h-5 mr-2" /> }] : []),
    ...(isAdmin ? [{ name: "Analytics", path: "/admin/analytics", icon: <ChartNoAxesCombined className="w-5 h-5 mr-2" /> }] : []),
  ];

  const socialLinks = [
    { name: "YouTube Channel", icon: <Youtube className="w-5 h-5 mr-2 text-red-500" />, url: "https://m.youtube.com/@TheCryptoSnipers" },
    { name: "Join Telegram", icon: <MessageCircle className="w-5 h-5 mr-2 text-blue-500" />, url: "https://t.me/infocryptosnipers" },
    { name: "Follow on Instagram", icon: <Instagram className="w-5 h-5 mr-2 text-pink-500" />, url: "https://www.instagram.com/thecryptosnipers?igsh=dmg1Z3Vlb2xjbjNx" },
  ];

  const footerLinks = [
    { name: "Terms & Conditions", icon: <Lock className="w-5 h-5 mr-2" />, path: "/terms" },
    { name: "LogOut", icon: <LogOut className="w-5 h-5 mr-2" /> },
  ];

  return (
    <aside className="w-[14rem] fixed inset-y-0 bg-white text-black hidden md:flex flex-col z-10">
      <div className="p-4">
        <Logo />
      </div>

      <div className="mt-6 px-4 text-sm text-gray-500">Overview</div>
      <nav className="mt-2 space-y-1 px-2">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={(e) => {
              if (item.name === "History") {
                // Allow default navigation for external link
                return;
              }
              e.preventDefault();
              window.location.href = item.path;
            }}
            className={`flex items-center px-3 py-2 rounded-lg ${location === item.path
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-100"
              }`}
            target={item.name === "History" ? "_blank" : undefined}
            rel={item.name === "History" ? "noopener noreferrer" : undefined}
          >
            {item.icon}
            {item.name}
          </a>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="px-4 text-sm text-gray-500 mb-2">Join Us</div>
        <div className="bg-gray-50 rounded-lg mx-2 p-4 space-y-3">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-gray-700 hover:text-blue-600"
            >
              {link.icon}
              {link.name}
            </a>
          ))}
        </div>

        <div className="mt-4 px-4 space-y-3 mb-4">
          {footerLinks.map((link) => (
            <a
              key={link.name}
              href={link.path || "#"}
              onClick={link.name === "LogOut" ? (e) => {
                e.preventDefault();
                handleLogout();
              } : undefined}
              className="flex items-center text-sm text-gray-700 hover:text-blue-600"
            >
              {link.icon}
              {link.name}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
