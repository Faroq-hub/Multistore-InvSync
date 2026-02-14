'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Location = { id: string; name: string; address?: string };

function ConnectCompleteContent() {
  const searchParams = useSearchParams();
  const pendingToken = searchParams.get('pending');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destShop, setDestShop] = useState('');

  const fetchLocations = useCallback(async () => {
    if (!pendingToken) {
      setError('Missing session. Please use the invite link from your supplier.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/connect/complete?pending=${encodeURIComponent(pendingToken)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load locations');
        setLoading(false);
        return;
      }
      const locs = data.locations || [];
      setLocations(locs);
      setDestShop(data.dest_shop_domain || '');
      if (locs.length > 0) {
        setSelectedLocationId(locs[0].id);
      }
    } catch (err) {
      setError('Failed to load locations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pendingToken]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleSubmit = async () => {
    if (!pendingToken || !selectedLocationId) {
      setError('Please select a location.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/connect/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pending_token: pendingToken, location_id: selectedLocationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to complete setup');
        setSubmitting(false);
        return;
      }
      window.location.href = '/connect/success';
    } catch (err) {
      setError('Failed to complete setup. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666' }}>Loading locations...</p>
      </div>
    );
  }

  if (error && locations.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Setup Error</h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>{error}</p>
          <p style={{ color: '#888', fontSize: '0.875rem' }}>Please start over from the invite link sent by your supplier.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#333', textAlign: 'center' }}>Select Location</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>
          Choose the location where inventory will be synced for <strong>{destShop}</strong>
        </p>
        <div style={{ background: '#fff', border: '1px solid #e1e3e5', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#333', marginBottom: '0.5rem' }}>
            Location <span style={{ color: '#d72c0d' }}>*</span>
          </label>
          {locations.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.875rem' }}>No locations found in your store. Add a location in Shopify Admin → Settings → Locations.</p>
          ) : (
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #c9cccf',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Select a location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {loc.address ? ` (${loc.address})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && (
          <p style={{ color: '#d72c0d', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={locations.length === 0 || !selectedLocationId || submitting}
          style={{
            width: '100%',
            background: locations.length === 0 || !selectedLocationId ? '#ccc' : '#008060',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: locations.length === 0 || !selectedLocationId ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Completing...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}

export default function ConnectCompletePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    }>
      <ConnectCompleteContent />
    </Suspense>
  );
}
