import "./globals.css";

export const metadata = {
  title: "RAGIA Chat",
  description: "UI Next.js para consultar el backend RAG local",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
