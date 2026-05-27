import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LeaderboardPage from './pages/LeaderboardPage';
import './index.css';
import { ClerkProvider } from '@clerk/clerk-react';
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';
import * as Sentry from '@sentry/react';

// Initialize Sentry
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'development' or 'production'
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Reduce sampling in production to save quota
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Publishable Key for Clerk
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key');
}

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/leaderboard', element: <LeaderboardPage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <ThemeProvider>
        <GameProvider>
          <RouterProvider router={router} />
        </GameProvider>
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>
);
