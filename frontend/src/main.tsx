import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LeaderboardPage from './pages/LeaderboardPage';
import './index.css';
import { ClerkProvider } from '@clerk/clerk-react';
import { ThemeProvider } from './context/ThemeProvider';
import { GameProvider } from './context/GameProvider';

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
