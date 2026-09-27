import type { Metadata, Viewport } from 'next';
import { Amiri, IBM_Plex_Sans_Arabic, Tajawal } from 'next/font/google';
import './globals.css';

const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'استوديو يُتبع... | لوحة التحكم والإدارة المركزية',
  description: 'منظومة إدارة المحتوى والبث والإنتاج الصوتي لمنصة يُتبع...',
  manifest: '/site.webmanifest',
  appleWebApp: { capable: true, title: 'استوديو يُتبع', statusBarStyle: 'black-translucent' },
  icons: {
    icon: '/branding/icon.svg',
    apple: [{ url: '/branding/install-icon.png', sizes: '1254x1254', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0D0D11',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmPlexArabic.variable} ${tajawal.variable} ${amiri.variable} dark`}
    >
      <body className="bg-obsidian text-editorial-ivory min-h-screen antialiased font-ui">
        {children}
      </body>
    </html>
  );
}
