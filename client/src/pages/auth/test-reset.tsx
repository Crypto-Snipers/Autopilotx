import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

export default function TestReset() {
  const [location] = useLocation();
  const [status, setStatus] = useState("Checking...");
  const [details, setDetails] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        // Parse URL parameters directly from window.location.search
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        console.log('URL search params:', window.location.search);
        console.log('Parsed params:', { token, type });
        
        setDetails({ 
          token, 
          type, 
          url: window.location.href,
          rawSearch: window.location.search 
        });
        
        if (!token || type !== "recovery") {
          setStatus("Invalid parameters");
          setError("Missing token_hash or incorrect type parameter");
          return;
        }

        // Try direct verification
        setStatus("Testing token verification...");
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });
        
        if (verifyError) {
          setStatus("Verification failed");
          setError(verifyError.message);
          console.error("Token verification error:", verifyError);
          return;
        }
        
        setStatus("Success! Token is valid");
        console.log("Verification successful:", data);
        
      } catch (err: any) {
        setStatus("Error");
        setError(err.message);
        console.error("Unexpected error:", err);
      }
    };

    checkToken();
  }, [location]);

  return (
    <AuthLayout title="Password Reset Diagnostics" subtitle="Testing your password reset link">
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Status: {status}</h2>
        
        {error && (
          <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2">URL Parameters:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Supabase Configuration:</h3>
          <p>URL: {import.meta.env.VITE_SUPABASE_URL ? "✅ Set" : "❌ Missing"}</p>
          <p>Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"}</p>
        </div>
        
        <div className="flex space-x-2 mt-4">
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
