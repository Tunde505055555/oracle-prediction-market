import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Oracle — AI Prediction Market on GenLayer',
  description: 'The first prediction market that resolves with on-chain AI. No human resolvers. No disputes. Just trustless consensus.',
  openGraph: {
    title: 'Oracle — AI Prediction Market on GenLayer',
    description: 'Bet on anything. The AI resolves it. 5 validators reach consensus.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
