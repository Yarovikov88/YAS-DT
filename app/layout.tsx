export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" style={{ backgroundColor: '#000' }}>
      <body>{children}</body>
    </html>
  );
}
