
'use client';

import React from 'react';
import type { ReactNode } from 'react';
import { UserProvider } from '@/contexts/UserContext';
import { SDKProvider } from '@telegram-apps/sdk-react';

export function AppProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render null on the server and during the initial client render pass before hydration.
    // This ensures UserProvider and its hooks (which call useMiniApp/useInitData)
    // are not invoked at all on the server.
    return null;
  }

  return (
    <SDKProvider acceptCustomStyles ssr={true}>
      <UserProvider>
        {children}
      </UserProvider>
    </SDKProvider>
  );
}
