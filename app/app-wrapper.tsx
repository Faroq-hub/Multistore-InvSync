import AppClient from './app-client';

export default async function AppWrapper({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const params = await searchParams;
  const shop = params?.shop || '';
  const host = params?.host || '';

  return <AppClient shop={shop} host={host} />;
}

