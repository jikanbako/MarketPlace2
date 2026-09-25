import './globals.css';
import NavBar from '@/components/NavBar';
import BannedBanner from '@/components/BannedBanner';

export const metadata = {
  title: 'BuyLink',
  description: 'Discover and sell products, TikTok-style.',
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
        <NavBar />
        <BannedBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
