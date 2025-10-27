import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    // Add any other session properties you might need
  }
}
