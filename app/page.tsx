import { Suspense } from 'react';
import AppWrapper from './app-wrapper';

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppWrapper searchParams={searchParams} />
    </Suspense>
  );
}

