
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
// Removed direct imports of UserProvider and SDKProvider
// import { UserProvider } from '@/contexts/UserContext';
// import { SDKProvider } from '@telegram-apps/sdk-react';
import { AppProviders } from '@/components/providers/AppProviders'; // Import the new wrapper

export const metadata: Metadata = {
  title: 'HustleSoul Airdrop Bot',
  description: 'HustleSoul Telegram Airdrop Bot Interface',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {/* Use the AppProviders wrapper here */}
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
