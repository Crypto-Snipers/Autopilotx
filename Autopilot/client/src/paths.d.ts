// This file helps TypeScript understand our path aliases
declare module '@hooks/use-toast' {
  import { UseToastReturn } from './path-to-toast-types';
  export const useToast: () => UseToastReturn;
  export const toast: any; // Adjust the type as needed
}

declare module '@lib/supabase/client' {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const supabase: SupabaseClient;
}

// Add other module declarations as needed
