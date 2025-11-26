// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export default function ConnectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

