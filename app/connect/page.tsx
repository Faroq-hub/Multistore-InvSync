'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function ConnectContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [invite, setInvite] = useState<{
    retailer_shop_domain: string;
    name: string;
    wholesaler_name: string;
    expires_at: string;
  } | null>(null);
  const [shopDomain, setShopDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvite = useCallback(async () => {
    if (!token) {
      setError('Missing invite link. Please use the link sent to you by your supplier.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/connect?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid or expired invite');
        setLoading(false);
        return;
      }
      setInvite(data);
      setShopDomain(data.retailer_shop_domain || '');
    } catch (err) {
      setError('Failed to load invite. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const handleConnect = () => {
    if (!invite || !token) return;
    setValidationError(null);
    let domain = shopDomain.trim().toLowerCase();
    if (!domain) {
      setValidationError('Please enter your Shopify store domain');
      return;
    }
    if (!domain.endsWith('.myshopify.com')) {
      if (!domain.includes('.')) {
        domain = `${domain}.myshopify.com`;
      } else {
        setValidationError('Please enter a valid Shopify store domain (e.g. your-store.myshopify.com)');
        return;
      }
    }
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    window.location.href = `${appUrl}/api/auth?shop=${encodeURIComponent(domain)}&invite=${encodeURIComponent(token)}`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Invalid or Expired Invite</h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error}</p>
          <p style={{ color: '#888', fontSize: '0.875rem' }}>Please contact your supplier for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#333', textAlign: 'center' }}>Connect Your Store</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
          <strong>{invite.wholesaler_name}</strong> has invited you to receive automated inventory updates.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e1e3e5', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#333', marginBottom: '0.375rem' }}>
              Shopify store domain
            </label>
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => {
                setShopDomain(e.target.value);
                setValidationError(null);
              }}
              placeholder="your-store.myshopify.com"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #c9cccf',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6d7175' }}>
              Enter your store domain. You can change this if you have multiple stores. After connecting, you&apos;ll select a location for inventory sync.
            </p>
          </div>
        </div>
        {validationError && (
          <p style={{ color: '#d72c0d', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
            {validationError}
          </p>
        )}
        <p style={{ color: '#888', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          You&apos;ll be redirected to Shopify to authorize the connection. This is a one-time setup.
        </p>
        <button
          onClick={handleConnect}
          style={{
            width: '100%',
            background: '#008060',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Connect to Shopify
        </button>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    }>
      <ConnectContent />
    </Suspense>
  );
}
