import "@fontsource-variable/geist";
import "./globals.css";
import "./workspace-theme.css";
export const metadata = {
  title: { default: "Outreach | Your workspace", template: "%s | Outreach" },
  description:
    "A thoughtful workspace for finding the right people and starting meaningful conversations.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


