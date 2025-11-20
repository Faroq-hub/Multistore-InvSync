'use client';

import { PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { AppProvider as PolarisProvider, Frame, Navigation, TopBar } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import { LinkIcon, OrderIcon, WrenchIcon } from '@shopify/polaris-icons';
import { createApp, AppConfig, ClientApplication } from '@shopify/app-bridge';
import ConnectionsPage from './connections/page';

const polarisI18n = {
  Polaris: {
    Avatar: {
      label: 'Avatar',
      labelWithInitials: 'Avatar with initials {initials}',
    },
    ContextualSaveBar: {
      save: 'Save',
      discard: 'Discard',
    },
    TextField: {
      characterCount: '{count} characters',
    },
    TopBar: {
      toggleMenuLabel: 'Toggle menu',
      SearchField: {
        clearButtonLabel: 'Clear',
        search: 'Search',
      },
    },
    Modal: {
      i18n: {
        close: 'Close',
      },
    },
    Frame: {
      skipToContent: 'Skip to content',
      navigationLabel: 'Navigation',
      Navigation: {
        closeMobileNavigationLabel: 'Close navigation',
      },
    },
  },
} as const;

function Providers({ children }: PropsWithChildren) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  if (!apiKey) {
    console.error('Missing NEXT_PUBLIC_SHOPIFY_API_KEY environment variable');
    return <div style={{ padding: '2rem' }}>App configuration error. Contact the app developer.</div>;
  }

  return (
    <PolarisProvider i18n={polarisI18n}>{children}</PolarisProvider>
  );
}

export default function AppClient({ shop, host }: { shop: string; host: string }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const appBridge = useMemo<ClientApplication<any> | null>(() => {
    if (!apiKey || !host) return null;
    const config: AppConfig = {
      apiKey,
      host,
      forceRedirect: true,
    };
    try {
      return createApp(config);
    } catch (error) {
      console.warn('Failed to initialize Shopify App Bridge', error);
      return null;
    }
  }, [apiKey, host]);

  if (!apiKey) {
    return (
      <div style={{ padding: '2rem' }}>
        Missing <code>NEXT_PUBLIC_SHOPIFY_API_KEY</code>. Contact the app developer.
      </div>
    );
  }

  if (!host || !appBridge) {
    // During OAuth flows, the app might load without host temporarily
    // Check if we're on the auth/callback route or if there's a shop parameter
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      
      // If we're on the auth callback route, show a loading message
      if (window.location.pathname.includes('/api/auth/callback')) {
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Completing installation...</p>
            <p style={{ color: '#666', marginTop: '1rem' }}>Please wait while we redirect you back to the app.</p>
          </div>
        );
      }
      
      // If we have a shop parameter but no host, we might be in OAuth flow
      if (shop && !host) {
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p>Setting up the app...</p>
            <p style={{ color: '#666', marginTop: '1rem' }}>If this page doesn't redirect automatically, please launch the app from Shopify Admin.</p>
          </div>
        );
      }
    }
    
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Unable to initialize Shopify embedded app context.</p>
        <p style={{ color: '#666', marginTop: '1rem' }}>Please launch the app from Shopify Admin to continue.</p>
        <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.9em' }}>
          If you're trying to reinstall the app, the OAuth flow should redirect you automatically.
        </p>
      </div>
    );
  }

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleUserMenu = useCallback(() => setUserMenuOpen((open) => !open), []);

  const navigationMarkup = useMemo(
    () => (
      <Navigation location="/">
        <Navigation.Section
          items={[
            {
              label: 'Connections',
              icon: LinkIcon,
              url: '#',
              selected: true,
            },
            {
              label: 'Jobs',
              icon: OrderIcon,
              url: '#',
              disabled: true,
            },
            {
              label: 'Deployment Guide',
              icon: WrenchIcon,
              url: 'https://github.com/FarooqK/reseller-feed-middleware/blob/main/DEPLOYMENT.md',
              external: true,
            },
          ]}
        />
      </Navigation>
    ),
    []
  );

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com';

  const userMenuMarkup = (
    <TopBar.UserMenu
      name={shop || 'Merchant'}
      initials={(shop?.[0] || 'M').toUpperCase()}
      open={userMenuOpen}
      actions={[
        {
          items: [
            {
              content: 'Contact support',
              onAction: () => window.open(`mailto:${supportEmail}`, '_blank'),
            },
          ],
        },
      ]}
      onToggle={toggleUserMenu}
    />
  );

  const topBarMarkup = <TopBar userMenu={userMenuMarkup} />;

  return (
    <Providers>
      <Frame navigation={navigationMarkup} topBar={topBarMarkup} skipToContentTarget="app-content">
        <div id="app-content">
          <ConnectionsPage shop={shop} app={appBridge} />
        </div>
      </Frame>
    </Providers>
  );
}
