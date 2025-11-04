import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/[A-Z]/, { message: "Must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Must contain at least one number" })
    .regex(/[^\w]/, { message: "Must contain at least one special character" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function UpdatePassword() {
  const [location, setLocation] = useLocation();
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  
  // Parse query parameters directly from window.location.search
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token_hash');
  const type = searchParams.get('type');
  
  // Debug logging
  console.log('URL search params:', window.location.search);
  console.log('Parsed token and type:', { token, type });

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Check if the reset token is valid
  useEffect(() => {
    const checkToken = async () => {
      console.log("Checking token...", { token, type, location });
      
      if (!token || type !== "recovery") {
        console.error("Invalid token or type:", { token, type });
        setError("Invalid password reset link. Please check the link and try again.");
        setIsValidLink(false);
        return;
      }

      try {
        // According to Supabase docs, we need to extract the token from the URL
        // and use it directly with the auth.verifyOtp method
        console.log("Verifying token with Supabase...");
        
        // Important: For password recovery, we need to use the token directly
        // The token_hash in the URL is already the correct format
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });
        
        console.log("Token verification response:", { data, error });
        
        if (error) {
          console.error("Token verification failed:", error);
          throw error;
        }
        
        console.log("Token verified successfully");
        setIsValidLink(true);
      } catch (err: any) {
        console.error("Error verifying token:", err);
        setError(`The password reset link is invalid or has expired. ${err.message || ''}`.trim());
        setIsValidLink(false);
      }
    };

    // Only run this effect when the component mounts or when token/type changes
    checkToken();
  }, [token, type]);

  const onSubmit = async (data: PasswordFormValues) => {
    try {
      setIsUpdating(true);
      setError(null);

      if (!token) {
        throw new Error("Invalid password reset token. Please request a new password reset link.");
      }

      // Try to update the password directly without re-verifying
      console.log("Attempting to update password with token:", token);
      
      // Update the password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });
      
      console.log("Password update response:", { updateData, updateError });
      
      if (updateError) {
        // If direct update fails, try verifying the token first
        console.log("Password update failed, trying to verify token first");
        
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });
        
        if (verifyError) {
          console.error("Token verification failed:", verifyError);
          throw new Error(`Password reset link is invalid or has expired. ${verifyError.message}`);
        }
        
        // If token verification succeeded but password update failed
        throw updateError;
      }

      // Sign out all other sessions
      await supabase.auth.signOut();

      // Show success message
      toast({
        title: "Success!",
        description: "Your password has been updated successfully. Please sign in with your new password.",
      });

      // Set success state to show success UI
      setSuccess(true);

      // Redirect to sign in after a short delay
      setTimeout(() => {
        setLocation("/signin");
      }, 3000);
    } catch (err: any) {
      console.error("Error in password update:", err);
      setError(err.message || "An error occurred while updating your password. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isValidLink === null) {
    return (
      <AuthLayout
        title="Update Password"
        subtitle="Verifying your password reset link..."
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md p-8 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-t-primary border-gray-200 rounded-full animate-spin"></div>
            <h2 className="text-2xl font-semibold">Verifying your link</h2>
            <p className="text-muted-foreground">Please wait while we verify your password reset link...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={success ? "Password Updated!" : "Set a New Password"}
      subtitle={
        success
          ? "Your password has been successfully updated."
          : "Create a new password for your account. Make sure it's strong and secure."
      }
    >
      <Card className="w-full max-w-md mx-auto">
        {success ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h3 className="mb-2 text-2xl font-semibold">Success!</h3>
            <p className="mb-6 text-muted-foreground">
              Your password has been updated successfully. Redirecting to sign in...
            </p>
            <Button onClick={() => setLocation("/signin")} className="w-full">
              Back to Sign In
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-4 m-4 text-sm text-red-600 bg-red-100 rounded-md">
                {error}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription>
                Enter your new password below.
              </CardDescription>
            </CardHeader>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...form.register("password")}
                      disabled={!isValidLink || isUpdating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pr-10"
                      {...form.register("confirmPassword")}
                      disabled={!isValidLink || isUpdating}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="p-4 text-sm bg-blue-50 rounded-md">
                  <h4 className="mb-1 font-medium">Password Requirements:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center">
                      <span className="inline-block w-1.5 h-1.5 mr-2 bg-blue-500 rounded-full"></span>
                      At least 8 characters
                    </li>
                    <li className="flex items-center">
                      <span className="inline-block w-1.5 h-1.5 mr-2 bg-blue-500 rounded-full"></span>
                      At least one uppercase & lowercase letter
                    </li>
                    <li className="flex items-center">
                      <span className="inline-block w-1.5 h-1.5 mr-2 bg-blue-500 rounded-full"></span>
                      At least one number
                    </li>
                    <li className="flex items-center">
                      <span className="inline-block w-1.5 h-1.5 mr-2 bg-blue-500 rounded-full"></span>
                      At least one special character
                    </li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isValidLink || isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update Password"}
                </Button>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </AuthLayout>
  );
}
