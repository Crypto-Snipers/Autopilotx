import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import { useEffect, useState } from "react";
import axios from "axios";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/context/ThemeProvider";

// Pages
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import OtpVerification from "@/pages/auth/OtpVerification";
import CompleteProfile from "@/pages/auth/CompleteProfile";
import Home from "@/pages/Home";
import Strategies from "@/pages/Strategies";
import Positions from "@/pages/Positions";
import History from "@/pages/History";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/not-found";
import Visitor from "@/pages/Visitor";
import AuthCallback from "@/pages/auth/callback";
import AdminNotificationForm from "@/pages/AdminNotificationForm";
import AdminApprovalDashboard from "@/pages/AdminApprovalDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import AccessControlDashboard from "./pages/AccessControlDashboard";
import UpdatePassword from "./pages/auth/update-password";
import TestReset from "./pages/auth/test-reset";
import WelcomeVisitor from "./pages/WelcomeVisitor";

// 🔹 Protected Route
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsAuthenticated(true);
        } else if (!isLoading && !user) {
          window.location.href = "/visitor";
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [user, isLoading]);

  if (isLoading || isCheckingAuth) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (user || isAuthenticated) {
    return <Component />;
  }

  return <div className="flex h-screen items-center justify-center">Redirecting...</div>;
}

// 🔹 Router setup
function Router() {
  return (
    <Switch>
      <Route path="/visitor" component={WelcomeVisitor} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/signin" component={SignIn} />
      <Route path="/signup" component={SignUp} />
      <Route path="/auth/otp-verification" component={OtpVerification} />
      <Route path="/complete-profile" component={CompleteProfile} />
      <Route path="/auth/update-password" component={UpdatePassword} />
      <Route path="/auth/test-reset" component={TestReset} />
      <Route path="/home" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/strategies" component={() => <Strategies />} />
      <Route path="/positions" component={() => <Positions/>} />
      <Route path="/history" component={() => <History />} />
      <Route path="/terms" component={Terms} />
      <Route path="/admin/notifications" component={() => <ProtectedRoute component={AdminNotificationForm} />} />
      <Route path="/admin/approvals" component={() => <ProtectedRoute component={AdminApprovalDashboard} />} />
      <Route path="/admin/analytics" component={() => <ProtectedRoute component={AnalyticsDashboard} />} />
      <Route path="/superadmin/roles" component={() => <ProtectedRoute component={AccessControlDashboard} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

// 🔹 Main App component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}


// 🔹 Optional: User hook
export function useUser() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error.message);
      } else {
        setUser(user);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return user;
}

export default App;
