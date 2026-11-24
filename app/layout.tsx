import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leo Revita Salon | Basta Leo, Hamloy Kaayo',
  description: 'Your beauty, your confidence. Discover salon services and book your next hair transformation with Leo Revita Salon.',
  applicationName: 'Leo Revita Salon',
  themeColor: '#D21F1B',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
