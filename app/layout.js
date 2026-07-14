import "./globals.css";

export const metadata = {
  title: "SLOBOS · Roulette",
  description: "Spin the wheel. Win whitelist spots. Refer friends. Slop responsibly.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23c6e800'/%3E%3Cpath d='M28 34 L33 15 L42 27 L50 11 L58 27 L67 15 L72 34 Z' fill='%23eec262'/%3E%3Ccircle cx='50' cy='23' r='4' fill='%23e8262d'/%3E%3Ccircle cx='50' cy='60' r='33' fill='%23171009'/%3E%3Crect x='23' y='46' width='54' height='21' rx='5' fill='%23e8b64c' transform='rotate(-4 50 56)'/%3E%3Ccircle cx='38' cy='56' r='7' fill='%23000'/%3E%3Ccircle cx='61' cy='55' r='7' fill='%23000'/%3E%3Cellipse cx='52' cy='78' rx='16' ry='9' fill='%23000'/%3E%3C/svg%3E" />
      </head>
      <body>{children}</body>
    </html>
  );
}
