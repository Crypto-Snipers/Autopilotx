import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { supabase } from './supabase';

// Define the default query function
const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const [endpoint, params] = queryKey as [string, any?];
  const BASE_URL = "http://localhost:7000";

  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
  // const BASE_URL = import.meta.env.VITE_API_URL?.replace('http://', 'https://') || '';

  // Construct the full URL
  const url = `${BASE_URL}${endpoint}`;

  // Extract method and data from params, defaulting to 'GET' and undefined
  const method = params?.method || 'GET';
  const data = params?.data;

  try {
    const headers = {
      'Content-Type': 'application/json',
      accept: 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Request failed');
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(error?.message || 'An unknown error occurred');
  }
};

// Create and configure the QueryClient
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Helper function to build API URLs
export const buildApiUrl = (path: string): string => {
  const cleanPath = path.replace(/^\/+/, '');
  // const BASE_URL = import.meta.env.VITE_API_URL || '';
  const BASE_URL = "http://localhost:7000";
  import.meta.env.VITE_API_URL?.replace('http://', 'https://') || '';
  console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);


  if (BASE_URL.startsWith('http')) {
    const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const finalUrl = `${base}/${cleanPath}`;
    return finalUrl;
  }

  const base = BASE_URL.startsWith('/') ? BASE_URL : `/${BASE_URL}`;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const finalUrl = `${window.location.origin}${cleanBase}/${cleanPath}`;
  return finalUrl;
};

// Export a type-safe API request function
export const apiRequest = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any
): Promise<T> => {
  let headers: Record<string, string> = {
    accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Try to get session, but don't fail if supabase is not available
  try {
    if (supabase && supabase.auth && typeof supabase.auth.getSession === 'function') {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (session && !sessionError) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  } catch (error) {
    console.warn('Failed to get Supabase session:', error);
    // Continue without authentication header
  }

  // const url = buildApiUrl(endpoint);
  const url = endpoint.startsWith('http') ? endpoint : buildApiUrl(endpoint);


  try {
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Request failed');
    }
    return await response.json();
  } catch (error: any) {
    throw new Error(error?.message || 'An unknown error occurred');
  }
};