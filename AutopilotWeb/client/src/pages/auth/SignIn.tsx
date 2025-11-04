import React from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import AuthLayout from "@/components/AuthLayout";
import { Eye, EyeOff, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setSessionItem } from "@/lib/sessionStorageUtils";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
  rememberMe: z.boolean().optional(),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignIn() {
  const [_, navigate] = useLocation();
  const { signin, signInWithGoogle, setCustomUser } = useAuth();
  const { toast } = useToast(); // Add toast from useToast hook
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });



  const handleGoogleSignIn = async () => {
    console.log('handleGoogleSignIn calling...');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false, // Ensure browser redirects to OAuth provider
          queryParams: {
            prompt: 'select_account', // This forces the account selection popup
            access_type: 'offline'    // Request refresh token too
          }
        }
      });
      console.log('Redirecting to:', `${window.location.origin}/auth/callback`);

      console.log('Supabase fetched data', data);

      if (error) {
        console.error("Google sign-in error:", error.message);
      }
    } catch (error) {
      console.error("Google sign-in exception:", error);
    }
  };


  async function onSubmit(values: SignInValues) {
    try {
      // Store email in session storage
      setSessionItem("signupEmail", values.email);

      // Set loading state to true when starting the submission
      setIsLoading(true);

      // First try to sign in directly with Supabase to get user data
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password
      });

      if (error) {
        throw error;
      }

      // If we have user data, store it in session storage
      if (data && data.user) {
        // Store essential user data in session storage for home page
        const userData = data.user;

        // Store user metadata
        if (userData.user_metadata) {
          if (userData.user_metadata.name) {
            setSessionItem("signupName", userData.user_metadata.name);
          }
          if (userData.user_metadata.phone) {
            setSessionItem("signupPhone", userData.user_metadata.phone);
          }
        }

        // Use the auth context to ensure auth state is updated
        await signin(values.email, values.password);

        // If login is successful, redirect to home page
        navigate("/");
      } else {
        throw new Error("Failed to retrieve user data");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Sign in failed",
        description: error.message || "Please check your email and password",
        variant: "destructive",
      });
      // Reset loading state on error
      setIsLoading(false);
    }
  }

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsResetting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;

      setResetSent(true);
      toast({
        title: "Email sent",
        description: "Check your email for the password reset link",
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue"
    >
      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetSent
                ? "Check your email for the password reset link. You can close this window."
                : "Enter your email address and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>

          {!resetSent ? (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={isResetting}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  disabled={isResetting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting || !resetEmail}
                >
                  {isResetting ? "Sending..." : "Send Reset Link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mt-4">
              <Button onClick={() => {
                setIsForgotPasswordOpen(false);
                setResetSent(false);
                setResetEmail("");
              }}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-neutral-600">
          Don't have an account?{" "}
          <a href="/signup" className="text-[#06a57f] font-medium">
            Sign up
          </a>
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your email id/ client id</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center mb-1">
                  <FormLabel>Password</FormLabel>
                  <button
                    type="button"
                    className="text-sm text-[#06a57f] hover:underline"
                    onClick={() => setIsForgotPasswordOpen(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      className="pr-10"
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#06a57f]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    className="mt-2 border-[#06a57f] data-[state=checked]:bg-[#06a57f] data-[state=checked]:border-[#06a57f]"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="text-sm cursor-pointer">
                  Remember me
                </FormLabel>
              </FormItem>
            )}
          />

          {/* <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Continue"}
          </Button> */}

          <button
          type="submit" className="w-full bg-[#06a57f] hover:bg-[#05b289] font-medium text-white px-4 py-2 rounded-md transition-colors" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Continue"}
          </button>

          <div className="relative flex items-center justify-center">
            <span className="flex-shrink mx-4 text-neutral-400 text-sm">or</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
