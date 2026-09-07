import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { AppShell } from '@/components/app-shell';

// Thai text needs a font with proper tone-mark placement on every platform.
const thai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-thai',
});

export const metadata: Metadata = {
  title: 'Workier — Putter Workspace',
  description: 'บริหารงานส่วนตัวหลายโปรเจกต์: รับข้อมูล จับประเด็น เลือกงานวันนี้ ติดตาม และเตรียมอัปเดตหัวหน้า',
  manifest: '/manifest.webmanifest',
  applicationName: 'Workier',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Workier',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3563e9',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body className="min-h-dvh font-sans antialiased">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
