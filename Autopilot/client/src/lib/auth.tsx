import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@hooks/use-toast';
import { supabase } from '@lib/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { AuthError, AuthResponse, UserResponse } from '@supabase/supabase-js';
import { setSessionItem } from './sessionStorageUtils';

// Define the auth context type
type AuthContextType = {
  user: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  signin: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  updateUserPhone: (phone: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signout: () => Promise<void>;
  // Custom backend authentication
  setCustomUser: (userData: any) => void;
  hasCustomAuth: boolean;
};

// Create the auth context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  signin: async () => false,
  signup: async () => false,
  verifyOtp: async () => false,
  updateUserPhone: async () => false,
  signInWithGoogle: async () => {},
  signout: async () => {},
  setCustomUser: () => {},
  hasCustomAuth: false,
});

// PKCE Utility Functions
const generateRandomString = (length: number): string => {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

const base64URLEncode = (buffer: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCustomAuth, setHasCustomAuth] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up the auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Get the current session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signin = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Sign in the user with Supabase (no OTP for login)
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) {
        console.error("Sign in error:", error.message);
        setError(error.message);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return false;
      } else {
        toast({
          title: "Success",
          description: "Signed in successfully",
        });
        return true;
      }
    } catch (error: any) {
      console.error("Sign in error:", error.message);
      setError(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // If user doesn't exist, proceed with signup
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            // Add any additional user metadata here
            signup_date: new Date().toISOString(),
          }
        }
      });

      if (signUpError) {
        // Handle specific error cases
        if (signUpError.message.includes('already registered')) {
          toast({
            title: "Email already in use",
            description: "This email is already registered. Please sign in or use a different email.",
            variant: "destructive",
          });
          return false;
        }
        throw signUpError;
      }

      toast({
        title: "Success",
        description: "Signup successful! Please check your email to verify your account.",
      });
      
      return true;
    } catch (error: any) {
      console.error("Sign up error:", error.message);
      setError(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Verify the OTP using Supabase
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Email verified successfully",
      });

      return true;
    } catch (error: any) {
      setError(error.message || "Failed to verify OTP");
      toast({
        title: "Error",
        description: error.message || "Failed to verify OTP",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPhone = async (phone: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // First check if the user is logged in
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user) {
        throw new Error("User not authenticated");
      }

      // Update the user's phone number in the user metadata
      const { data, error } = await supabase.auth.updateUser({
        data: { phone: phone }
      });

      if (error) {
        throw error;
      }

      // Update the local user state
      if (data?.user) {
        setUser(data.user);
      }

      toast({
        title: "Success",
        description: "Phone number updated successfully",
      });

      return true;
    } catch (error: any) {
      setError(error.message || "Failed to update phone number");
      toast({
        title: "Error",
        description: error.message || "Failed to update phone number",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Initiate the OAuth flow with Google
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'openid profile email',
        },
      });

      if (error) throw error;
      
      // The signInWithOAuth method will handle the PKCE flow automatically
      // and store the code verifier in session storage
      
      if (data?.url) {
        // Clear any existing auth state before redirecting
        await supabase.auth.signOut();
        // Redirect to the OAuth provider
        window.location.href = data.url;
      } else {
        throw new Error('No URL returned from OAuth provider');
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      // Clean up any stored code verifier on error
      setSessionItem('code_verifier', '');
      toast({
        title: "Error",
        description: error.message || 'Failed to sign in with Google',
        variant: "destructive",
      });
    }
  };

  const signout = async () => {
    // Clear custom auth data first
    localStorage.removeItem('auth_token');
    localStorage.removeItem('has_custom_auth');
    setHasCustomAuth(false);
    
    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setUser(null);
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    }
  };

  // Function to set a custom user from backend authentication
  const setCustomUser = (userData: any) => {
    // Create a Supabase-like user object
    const customUser = {
      id: userData.id || userData.user?.id || 'custom-id',
      email: userData.email || userData.user?.email,
      user_metadata: {
        ...userData,
        custom_auth: true
      },
      app_metadata: {
        provider: 'custom'
      }
    } as unknown as SupabaseUser;
    
    // Set the user in state
    setUser(customUser);
    setHasCustomAuth(true);
    
    // Store auth token if available
    if (userData.token) {
      localStorage.setItem('auth_token', userData.token);
    }
    
    // Store custom auth flag
    localStorage.setItem('has_custom_auth', 'true');
  };
  
  // Check for custom auth on initial load
  useEffect(() => {
    const hasCustomAuthStored = localStorage.getItem('has_custom_auth') === 'true';
    if (hasCustomAuthStored) {
      setHasCustomAuth(true);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        error,
        signin,
        signup,
        verifyOtp,
        updateUserPhone,
        signInWithGoogle,
        signout,
        setCustomUser,
        hasCustomAuth,
        isLoading,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
