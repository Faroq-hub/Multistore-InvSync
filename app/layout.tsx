import './globals.css';

export const metadata = {
  title: 'Multi-Store Inventory Sync',
  description: 'Sync inventory and products across Shopify and WooCommerce stores',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

