import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-context';
import { db } from '@/lib/store';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Venturee Biz - Smart SaaS POS',
  description: 'Advanced company management and POS system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // We pass initial users for the mock auth to work on the client
  const users = db.getUsers();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen">
        <AuthProvider initialUsers={users}>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
