
'use client';

// This is a simple pass-through layout for the settings page.
// It ensures that the notes layout styling is applied here as well.
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
