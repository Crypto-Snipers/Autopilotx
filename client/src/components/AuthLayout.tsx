import React, { ReactNode } from "react";
import { WhiteLogo } from "./WhiteLogo";
import TradingIllustration from "./illustrations/TradingIllustration";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left sidebar with branding and illustration */}
      <div className="w-full md:w-2/5 bg-secondary flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="fixed top-0 left-0 p-4 z-50">
            <WhiteLogo />
          </div>

          {/* Illustration */}
          <div className="flex justify-center items-center">
            <TradingIllustration />
          </div>
        </div>
      </div>

      {/* Right side with content */}
      <div className="w-full md:w-3/5 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {title}
            </h1>
            <p className="text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
