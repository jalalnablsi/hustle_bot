
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from '@/contexts/UserContext'; // Import UserProvider

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
        <UserProvider> {/* Wrap children with UserProvider */}
          {children}
          <Toaster />
        </UserProvider>
      </body>
    </html>
  );
}
