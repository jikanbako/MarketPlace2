import './globals.css';
import NavBar from '@/components/NavBar';
import BannedBanner from '@/components/BannedBanner';
import RegisterServiceWorker from '@/components/RegisterServiceWorker';
import InstallPrompt from '@/components/InstallPrompt';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#171310',
};

export const metadata = {
  title: 'BuyLink',
  description: 'Discover and sell products, TikTok-style.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BuyLink',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }) {
  const analyticsDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="en">
      <head>
        {analyticsDomain && (
          <script
            defer
            data-domain={analyticsDomain}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body className="font-body min-h-screen">
        <RegisterServiceWorker />
        <NavBar />
        <InstallPrompt />
        <BannedBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
