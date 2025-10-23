import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Lock, Settings, Home, BarChart, LineChart, History, Youtube, Instagram, MessageCircle, LogOut, ChartNoAxesCombined, UserRoundCog, Shield, Layers, ChartColumnDecreasing } from "lucide-react";
import { clearLocalStorage, clearSessionStorage } from "@/lib/sessionStorageUtils";
import { apiRequest } from "@/lib/queryClient";

export default function Sidebar() {
  const { user, signout } = useAuth();
  const [role, setRole] = useState<string>("user");
  const location = window.location.pathname;


  // Check User role
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.email) {
        try {
          const response = await apiRequest<{ success: boolean; email: string; role: string; }>(
            "GET",
            `/api/get-role?email=${encodeURIComponent(user.email)}`
          );

          console.log("User role response:", response);
          if (response?.role === "superadmin" || response?.role === "admin") {
            setRole(response.role);
          } else {
            setRole("user");
          }
        } catch (error) {
          console.error("Error checking user role:", error);
          setRole("user");
        }
      }
    };
    checkAdminStatus();
  }, [user]);


  // Handle logout functionality
  const handleLogout = async () => {
    try {
      await signout();
      localStorage.removeItem('broker_name');
      localStorage.removeItem('api_verified');
      clearSessionStorage();
      clearLocalStorage();
      window.location.href = '/signin';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };



  const navItems = [
    { name: "Home", path: "/", icon: <Home className="w-5 h-5 mr-2" /> },
    { name: "Strategies", path: "/strategies", icon: <ChartColumnDecreasing className="w-5 h-5 mr-2" /> },
    { name: "Positions", path: "/positions", icon: <Layers className="w-5 h-5 mr-2" /> },
    { name: "History", path: "/history", icon: <History className="w-5 h-5 mr-2" /> },

    ...(role === "admin" || role === "superadmin" ? [{ name: "Notifications", path: "/admin/notifications", icon: <Settings className="w-5 h-5 mr-2" /> }] : []),
    ...(role === "admin" || role === "superadmin" ? [{ name: "Approvals", path: "/admin/approvals", icon: <UserRoundCog className="w-5 h-5 mr-2" /> }] : []),
    ...(role === "admin" || role === "superadmin" ? [{ name: "Analytics", path: "/admin/analytics", icon: <ChartNoAxesCombined className="w-5 h-5 mr-2" /> }] : []),

    ...(role === "superadmin" ? [{ name: "Access Control", path: "/superadmin/roles", icon: <Shield className="w-5 h-5 mr-2" /> }] : []),
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
    // --- CHANGE: Updated main background and text colors ---
    <aside className="w-[14rem] fixed inset-y-0 bg-background text-foreground hidden md:flex flex-col z-10">
      <div className="p-4">
        <Logo />
      </div>

      {/* --- CHANGE: Updated text color --- */}
      <div className="mt-6 px-4 text-sm text-foreground font-bold">Overview</div>
      {/* --- CHANGE: Updated text color --- */}
      <nav className="mt-2 space-y-1 px-2 text-foreground font-medium">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={(e) => {
              if (item.name === "History") {
                e.preventDefault();
                const brokerName = sessionStorage.getItem("broker_name");
                if (brokerName === "coindcx") {
                  window.open("https://coindcx.com/stats/futures/positions", "_blank");
                  return;
                }
              }
              window.location.href = item.path;
            }}
            // --- CHANGE: Updated active, inactive, and hover styles ---
            className={`flex items-center px-3 py-2 rounded-full ${location === item.path
              ? "bg-[#06a57f] text-primary-foreground"
              : "text-foreground hover:bg-muted"
              }`}
          >
            {item.icon}
            {item.name}
          </a>
        ))}
      </nav>

      <div className="mt-auto">
        {/* --- CHANGE: Updated text color --- */}
        <div className="px-4 text-sm text-foreground font-bold mb-2">Join Us</div>
        {/* --- CHANGE: Updated background color --- */}
        <div className="bg-muted rounded-lg mx-2 p-4 space-y-3">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              // --- CHANGE: Updated text and hover colors ---
              className="flex items-center text-sm text-foreground font-medium hover:text-[#02b589]"
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
              // --- CHANGE: Updated text and hover colors ---
              className="flex items-center text-sm text-foreground font-medium hover:text-[#02b589]"
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