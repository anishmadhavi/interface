import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Interface - WhatsApp Business Platform',
    template: '%s | Interface',
  },
  description:
    'Manage your WhatsApp Business communications with ease. Team inbox, campaigns, automation, and more.',
  keywords: [
    'WhatsApp Business',
    'WhatsApp API',
    'Team Inbox',
    'WhatsApp Marketing',
    'Business Messaging',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
} 
