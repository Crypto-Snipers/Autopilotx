// import { useEffect } from 'react';
// import { useLocation } from 'wouter';
// import { supabase } from '@/lib/supabase';

// export default function AuthCallback() {
//   const [_, navigate] = useLocation();

//   useEffect(() => {
//     supabase.auth.onAuthStateChange(async (event) => {
//       if (event === 'SIGNED_IN') {
//         // User is signed in and email is verified
//         navigate('/');
//       }
//     });
//   }, [navigate]);

//   return <div>Verifying your email...</div>;
// }


import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  console.log('[AuthCallback] Component mounted');
  const [_, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('[AuthCallback] Handling OAuth callback');
      console.log('[AuthCallback] Full URL:', window.location.href);
      
      try {
        // The supabase client is already configured to handle the OAuth callback
        // We just need to get the session to complete the flow
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthCallback] Error getting session:', error);
          throw error;
        }
        
        if (!session) {
          throw new Error('No session found after OAuth callback');
        }
        
        console.log('[AuthCallback] Authentication successful, redirecting to home');
        
        // Show success message
        toast({
          title: 'Success',
          description: 'You have been signed in successfully!',
          variant: 'default',
        });
        
        // Wait a bit before redirecting to show the toast
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        
      } catch (err) {
        console.error('[AuthCallback] Error:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    handleAuthCallback();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
        <p className="text-gray-700">Authentication successful! Redirecting...</p>
      </div>
    </div>
  );
}
