import './globals.css';

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
        <nav className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
          <a href="/" className="font-display text-xl">BuyLink</a>
          <div className="flex gap-5 text-sm">
            <a href="/feed" className="hover:text-clay">Feed</a>
            <a href="/products" className="hover:text-clay">Browse</a>
            <a href="/dashboard" className="hover:text-clay">Sell</a>
            <a href="/dashboard/posts/new" className="hover:text-clay">Post</a>
            <a href="/messages" className="hover:text-clay">Messages</a>
            <a href="/login" className="hover:text-clay">Log in</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
