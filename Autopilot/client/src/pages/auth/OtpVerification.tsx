import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { getSessionItem, setSessionItem, getSessionObject } from '@/lib/sessionStorageUtils';

export default function OtpVerification() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { verifyOtp } = useAuth();
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [isResending, setIsResending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'sending' | 'sent' | 'error'>('sending');

  // Get user data from session storage
  const userData = getSessionObject<{ email: string; name?: string; phone?: string; password?: string }>("userData", { email: "" });
  const email = userData.email || "";

  useEffect(() => {
    if (!email) {
      navigate("/signup");
      toast({
        title: "Error",
        description: "Please complete the signup form first",
        variant: "destructive",
      });
      return;
    }

    // Show a toast to let the user know the email is being sent
    toast({
      title: "Sending verification code",
      description: "Please wait while we send a verification code to your email.",
    });

    // Check for email status periodically
    const emailCheckInterval = setInterval(() => {
      // In a real implementation, you might want to check with your backend
      // Here we're just simulating a status change after a delay
      setTimeout(() => {
        setEmailStatus('sent');
        toast({
          title: "Verification code sent",
          description: `A 6-digit verification code has been sent to ${email}. Please check your inbox and spam folder.`,
        });
        clearInterval(emailCheckInterval);
      }, 5000); // Simulate a 5-second delay for email sending
    }, 2000);

    // Start countdown
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(emailCheckInterval);
    };
  }, [email, navigate, toast]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0];
    }

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    // Auto focus to next input
    if (value !== "" && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }

    // Reset invalid state when user starts typing
    if (isInvalid) setIsInvalid(false);
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // On backspace, clear current field and focus previous
    if (e.key === "Backspace" && index > 0 && otpValues[index] === "") {
      const newOtpValues = [...otpValues];
      newOtpValues[index - 1] = "";
      setOtpValues(newOtpValues);

      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();

    if (/^\d+$/.test(pastedData)) {
      const digits = pastedData.split("").slice(0, 6);
      const newOtpValues = [...otpValues];

      digits.forEach((digit, idx) => {
        if (idx < 6) newOtpValues[idx] = digit;
      });

      setOtpValues(newOtpValues);

      // Focus the next empty input or last input
      const nextEmptyIndex = newOtpValues.findIndex((val) => val === "");
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      const nextInput = document.getElementById(`otp-input-${focusIndex}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleResendOtp = async () => {
    if (timeLeft > 0 || !email) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setTimeLeft(180);
      setOtpValues(Array(6).fill(""));
      setIsInvalid(false);

      toast({
        title: "OTP Resent",
        description: `A new OTP has been sent to ${email}`,
        variant: "default",
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast({
        title: "Error",
        description: "Failed to resend OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const otp = otpValues.join("");

    // Validate OTP format
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setIsInvalid(true);
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 6-digit OTP code",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setIsInvalid(false);

      if (!userData) {
        throw new Error("Session expired. Please sign up again.");
      }

      // Verify OTP using the auth context function (already imported at the top)
      const success = await verifyOtp(userData.email, otp);

      if (!success) {
        throw new Error("Failed to verify OTP. Please try again.");
      }

      // If we get here, OTP is verified
      // Now we can update the user metadata in Supabase
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            name: userData.name,
            phone: userData.phone,
            email_verified: true
          }
        });

        if (updateError) {
          console.error("Error updating user metadata after verification:", updateError);
          // Continue with the flow even if metadata update fails
        } else {
          console.log("User metadata updated successfully");
        }
      } catch (metadataError) {
        console.error("Exception updating user metadata:", metadataError);
        // Continue with the flow even if metadata update fails
      }

      toast({
        title: "Email verified!",
        description: "Your account has been successfully created.",
        variant: "default",
      });

      // Clear sensitive data from session storage
      setSessionItem("userData", "");

      // Store user info in session storage for Home page
      if (userData.name) setSessionItem("signupName", userData.name);
      if (userData.phone) setSessionItem("signupPhone", userData.phone);

      // Redirect to home page
      navigate("/");
    } catch (error: any) {
      console.error("OTP verification error:", error);
      setIsInvalid(true);
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Format time remaining as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AuthLayout title="" subtitle="">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-muted-foreground">
            We've sent a 6-digit code to {email}. The code will expire in{" "}
            <span className="font-medium text-foreground">
              {formatTime(timeLeft)}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center space-x-2">
            {otpValues.map((value, index) => (
              <Input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={value}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`h-12 w-12 text-center text-xl ${isInvalid ? "border-red-500" : ""
                  }`}
                disabled={isLoading}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {isInvalid && (
            <p className="text-center text-sm text-red-500">
              Invalid code. Please try again.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </Button>

          <div className="text-center text-sm">
            <p className="text-muted-foreground">
              Didn't receive a code?{" "}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={timeLeft > 0 || isResending}
                className="font-medium text-primary hover:underline"
              >
                {isResending ? (
                  <span className="inline-flex items-center">
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    Sending...
                  </span>
                ) : timeLeft > 0 ? (
                  `Resend in ${formatTime(timeLeft)}`
                ) : (
                  "Resend Code"
                )}
              </button>
            </p>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
