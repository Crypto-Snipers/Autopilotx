import React from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Scroll, Shield, AlertCircle, FileText, CheckCircle } from "lucide-react";

export default function Terms() {
  return (
    <>
    
      <Header />
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#2d3139] p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white dark:bg-background text-foreground shadow-md rounded-xl p-6 md:p-8">
              <div className="flex items-center mb-6">
                <Shield className="h-8 w-8 text-green-600 mr-3" />
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-300">Terms and Conditions</h1>
              </div>
              
              <div className="prose prose-blue max-w-none">
                <p className="text-gray-700 dark:text-gray-400 mb-6">
                  Welcome to the Autopilotx (hereinafter referred to as "Autopilotx", "we", "our", or "the Platform"). 
                  Autopilotx is a Software-as-a-Service (SaaS) product designed to help users automate their cryptocurrency 
                  trading strategies through intelligent, rule-based systems. The Platform currently operates with the 
                  third-party exchanges, allowing users to test, and automate trades. Access is granted only to users 
                  who have opened their account in provided exchanges using the referral link provided to you by team 
                  Autopilotx only.
                </p>
                
                <p className="text-gray-700 dark:text-gray-400 mb-6">
                  The Platform, Website, and any associated mobile or desktop applications shall hereinafter be jointly 
                  referred to as the "Services". These Terms of Use ("Agreement", "Terms", or "Terms of Service"), along 
                  with our Privacy Policy and Cookie Policy, govern your use of the Services provided by the Autopilotx. 
                  This document forms a legally binding agreement between you and Autopilotx. If you do not agree to these 
                  Terms, you may not access or use the Services.
                </p>

                <div className="bg-blue-50 dark:bg-muted border-l-4 border-[#06a57f]/50 p-4 mb-6">
                  <h3 className="flex items-center text-lg font-semibold text-[#06a57f] mb-2">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    By using the Services, you confirm and agree that:
                  </h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-400">
                    <li>You have read, understood, and accepted these Terms of Use as they appear at the time of each use of the Platform;</li>
                    <li>You are of legal age and possess the legal capacity to enter into this Agreement;</li>
                    <li>You are not located in or subject to any jurisdiction that prohibits the use of trading automation software;</li>
                    <li>You understand that the Autopilotx does not offer any financial, investment, or trading advice;</li>
                    <li>You use the Autopilotx at your own risk and discretion and bear full responsibility for all trading decisions and outcomes;</li>
                    <li>You acknowledge that the Autopilotx is not regulated by any financial authority, and as such, use of the Services is not protected by any financial services compensation or ombudsman schemes.</li>
                  </ul>
                </div>

                <div className="bg-amber-50 dark:bg-muted border-l-4 border-amber-500 p-4 mb-6">
                  <h2 className="flex items-center text-xl font-bold text-amber-800 mb-3">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    RISK DISCLOSURE
                  </h2>
                  <p className="text-gray-700 dark:text-gray-400">
                    All features and functionalities offered through the Autopilotx — including strategy automation, backtesting 
                    tools, and signal plotting — are intended solely for educational and informational purposes. Any data, 
                    strategies, signals, or content displayed on the Platform are based on general market insights and do not 
                    constitute financial advice or personalized trading recommendations. Cryptocurrency trading involves 
                    significant risk. Past performance is not indicative of future results. You should conduct independent 
                    research or consult with a licensed financial advisor before making any trading decisions. Never trade 
                    with money you cannot afford to lose.
                  </p>
                </div>

                <p className="text-gray-700 dark:text-gray-400 mb-6">
                  Autopilotx currently integrates with third-party cryptocurrency exchanges. While Autopilotx is not affiliated 
                  with or endorsed by any of these changes, it enables automated strategy execution for users onboarded 
                  via approved referral links. We may collaborate with more third-party exchanges in the future to enhance 
                  functionality, flexibility, and access for our users. Such integrations, if added, will be communicated 
                  through official channels.
                </p>

                <div className="border border-gray-200 rounded-lg p-4 mb-6">
                  <h3 className="flex items-center text-lg font-semibold text-gray-800 dark:text-gray-300 mb-2">
                    <FileText className="h-5 w-5 mr-2" />
                    Disclaimers
                  </h3>
                  <p className="text-gray-700 dark:text-gray-400">
                    We do not guarantee the accuracy, completeness, or reliability of any information presented on the 
                    Platform. We disclaim all liability for any financial loss, including but not limited to direct, 
                    indirect, or consequential losses, arising from your use of or reliance on the Services.
                  </p>
                </div>

                <p className="text-gray-700 dark:text-gray-400 mb-6">
                  We reserve the right to update, modify, or change any part of this Agreement at any time. Changes will 
                  be communicated via email or published directly on our website or within the Platform. Your continued 
                  use of the Services following any such updates will be considered your acceptance of the revised Terms.
                </p>

                <div className="flex items-center justify-center mt-8 text-gray-500 dark:text-gray-300">
                  <Scroll className="h-5 w-5 mr-2" />
                  <p className="text-sm">Last updated: May 25, 2025</p>
                </div>
              </div>
            </div>
          </div>
        </main>
        </>
  );
}
