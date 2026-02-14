'use client';

export default function ConnectSuccessPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#333' }}>Store Connected</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Your store has been successfully connected. You will now receive automated inventory updates from your supplier.
        </p>
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          You can close this window. No further action is needed.
        </p>
      </div>
    </div>
  );
}
