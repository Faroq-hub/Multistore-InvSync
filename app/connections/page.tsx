'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClientApplication } from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { Redirect } from '@shopify/app-bridge/actions';
import {
  Page,
  Card,
  DataTable,
  Button,
  EmptyState,
  Modal,
  TextField,
  Select,
  Badge,
  Layout,
  BlockStack,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  Toast,
  CalloutCard,
  Tabs,
  Text,
  Banner,
  Checkbox,
} from '@shopify/polaris';

type StatusFilter = 'all' | 'active' | 'paused' | 'disabled';

interface Connection {
  id: string;
  name: string;
  type: 'shopify' | 'woocommerce';
  status: 'active' | 'paused' | 'disabled';
  dest_shop_domain?: string | null;
  dest_location_id?: string | null;
  base_url?: string | null;
  rules?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string | null;
  syncedSkus?: number;
}

export default function ConnectionsPage({ shop, app }: { shop: string; app: ClientApplication<any> }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [installationStatus, setInstallationStatus] = useState<{ shop: string; hasAccessToken: boolean; needsReinstall: boolean } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [connectionType, setConnectionType] = useState<'shopify' | 'woocommerce'>('shopify');
  const [formData, setFormData] = useState({
    name: '',
    dest_shop_domain: '',
    access_token: '',
    dest_location_id: '',
    base_url: '',
    consumer_key: '',
    consumer_secret: '',
    sync_price: false,
    sync_categories: false,
    create_products: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null);
  const [statusTab, setStatusTab] = useState<StatusFilter>('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [connectionToEdit, setConnectionToEdit] = useState<Connection | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    dest_location_id: '',
    access_token: '',
    sync_price: true,
  });
  const [updating, setUpdating] = useState(false);
  const makeRequest = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      let token: string;
      try {
        token = await getSessionToken(app);
      } catch (err) {
        console.error('Failed to retrieve Shopify session token', err);
        throw new Error('Session expired. Please reopen the app from Shopify Admin.');
      }

      const headers = new Headers(init?.headers ?? {});
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('X-Shop', shop);

      const response = await fetch(input, {
        ...init,
        headers,
      });

      if (response.status === 401) {
        const reauth = response.headers.get('X-Shopify-API-Request-Failure-Reauthorize');
        const redirectUrl = response.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
        if (reauth === '1' && redirectUrl) {
          const redirect = Redirect.create(app);
          redirect.dispatch(Redirect.Action.REMOTE, redirectUrl);
          return {};
        }
      }

      const text = await response.text();

      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        let errorData: any = null;
        try {
          const payload = text ? JSON.parse(text) : null;
          if (payload && typeof payload.error === 'string' && payload.error.trim().length > 0) {
            message = payload.error;
          }
          // Preserve the full error response for special error handling
          if (payload) {
            errorData = payload;
          }
        } catch {
          if (text?.trim()) {
            message = text.trim();
          }
        }
        const error = new Error(message) as any;
        error.response = response;
        error.errorData = errorData;
        throw error;
      }

      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch (err) {
        console.error('Failed to parse response JSON', err, text);
        throw new Error('Unexpected response format from server');
      }
    },
    [app]
  );

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await makeRequest('/api/connections');
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      if (data.installation) {
        setInstallationStatus(data.installation);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load connections';
      setToast({ content: message, error: true });
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const openExternal = useCallback(
    (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer'),
    []
  );

  const handleCreateConnection = async () => {
    try {
      setSubmitting(true);
      
      // Validate required fields
      if (!formData.name) {
        setToast({ content: 'Name is required', error: true });
        setSubmitting(false);
        return;
      }
      
      if (connectionType === 'shopify') {
        if (!formData.dest_shop_domain) {
          setToast({ content: 'Shop Domain is required', error: true });
          setSubmitting(false);
          return;
        }
        if (!formData.access_token) {
          setToast({ content: 'Access Token is required', error: true });
          setSubmitting(false);
          return;
        }
        if (!formData.dest_location_id) {
          setToast({ content: 'Location ID is required for inventory updates', error: true });
          setSubmitting(false);
          return;
        }
      } else {
        if (!formData.base_url || !formData.consumer_key || !formData.consumer_secret) {
          setToast({ content: 'Base URL, Consumer Key, and Consumer Secret are required', error: true });
          setSubmitting(false);
          return;
        }
      }
      
      const endpoint = connectionType === 'shopify' ? '/api/connections/shopify' : '/api/connections/woocommerce';
      const body =
        connectionType === 'shopify'
          ? {
              name: formData.name,
              dest_shop_domain: formData.dest_shop_domain,
              access_token: formData.access_token,
              dest_location_id: formData.dest_location_id || null,
              sync_price: formData.sync_price === true,
              sync_categories: formData.sync_categories === true,
              create_products: formData.create_products !== false,
            }
          : {
              name: formData.name,
              base_url: formData.base_url,
              consumer_key: formData.consumer_key,
              consumer_secret: formData.consumer_secret,
              sync_price: formData.sync_price === true,
              sync_categories: formData.sync_categories === true,
              create_products: formData.create_products !== false,
            };

      await makeRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setToast({ content: 'Connection created successfully' });
      setModalOpen(false);
      setFormData({
        name: '',
        dest_shop_domain: '',
        access_token: '',
        dest_location_id: '',
        base_url: '',
        consumer_key: '',
        consumer_secret: '',
        sync_price: false,
        sync_categories: false,
        create_products: true,
      });
      fetchConnections();
    } catch (err: any) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to create connection';
      
      // Handle missing access token error specifically
      if (err?.errorData) {
        const errorData = err.errorData;
        if (errorData?.code === 'MISSING_ACCESS_TOKEN') {
          errorMessage = `Installation missing access token for shop ${errorData.shop || 'unknown'}. Please reinstall the app through Shopify OAuth to grant permissions.`;
        } else if (errorData?.error) {
          errorMessage = errorData.error;
        }
      }
      
      setToast({ content: errorMessage, error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFullSync = async (connectionId: string) => {
    try {
      await makeRequest(`/api/connections/${connectionId}/full-sync`, { method: 'POST' });
      setToast({ content: 'Sync started successfully' });
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to trigger sync', error: true });
    }
  };

  const handlePause = async (connectionId: string) => {
    try {
      await makeRequest(`/api/connections/${connectionId}/pause`, { method: 'POST' });
      setToast({ content: 'Connection paused' });
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to pause', error: true });
    }
  };

  const handleResume = async (connectionId: string) => {
    try {
      await makeRequest(`/api/connections/${connectionId}/resume`, { method: 'POST' });
      setToast({ content: 'Connection resumed' });
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to resume', error: true });
    }
  };

  const handleEditClick = async (connection: Connection) => {
    try {
      // Fetch full connection details
      const data = await makeRequest(`/api/connections/${connection.id}`);
      const fullConnection = data.connection;
      setConnectionToEdit(fullConnection);
      const rules = fullConnection.rules || {};
      setEditFormData({
        name: fullConnection.name || '',
        dest_location_id: fullConnection.dest_location_id || '',
        access_token: '', // Don't pre-fill for security - user enters new token if updating
        sync_price: rules.sync_price !== false, // Default to true if not set
      });
      setEditModalOpen(true);
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to load connection details', error: true });
    }
  };

  const handleUpdateConnection = async () => {
    if (!connectionToEdit) return;
    
    // Validate required fields
    if (!editFormData.name) {
      setToast({ content: 'Name is required', error: true });
      return;
    }
    
    if (connectionToEdit.type === 'shopify' && !editFormData.dest_location_id) {
      setToast({ content: 'Location ID is required for inventory updates', error: true });
      return;
    }
    
    try {
      setUpdating(true);
      const updateBody: any = {
        name: editFormData.name,
        dest_location_id: editFormData.dest_location_id || null,
        rules: {
          sync_price: editFormData.sync_price !== false,
        },
      };
      
      // Include access_token if provided (for Shopify connections)
      if (connectionToEdit.type === 'shopify' && editFormData.access_token.trim()) {
        updateBody.access_token = editFormData.access_token.trim();
      }
      
      await makeRequest(`/api/connections/${connectionToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      setToast({ content: 'Connection updated successfully' });
      setEditModalOpen(false);
      setConnectionToEdit(null);
      setEditFormData({ name: '', dest_location_id: '', access_token: '', sync_price: true });
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to update connection', error: true });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteClick = (connection: Connection) => {
    setConnectionToDelete(connection);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!connectionToDelete) return;
    try {
      setDeleting(true);
      await makeRequest(`/api/connections/${connectionToDelete.id}`, { method: 'DELETE' });
      setToast({ content: 'Connection deleted successfully' });
      setDeleteModalOpen(false);
      setConnectionToDelete(null);
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to delete connection', error: true });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAllConfirm = async () => {
    try {
      setDeletingAll(true);
      const response = await makeRequest('/api/connections', { method: 'DELETE' });
      const message = response.message || `Deleted ${response.deleted || 0} connection(s)`;
      setToast({ content: message });
      setDeleteAllModalOpen(false);
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to delete all connections', error: true });
    } finally {
      setDeletingAll(false);
    }
  };

  const tabs = useMemo<{ id: StatusFilter; content: string }[]>(() => {
    const counts = connections.reduce<Record<StatusFilter, number>>(
      (acc, conn) => {
        acc.all += 1;
        acc[conn.status] += 1;
        return acc;
      },
      { all: 0, active: 0, paused: 0, disabled: 0 }
    );
    return [
      { id: 'all', content: `All (${counts.all})` },
      { id: 'active', content: `Active (${counts.active})` },
      { id: 'paused', content: `Paused (${counts.paused})` },
      { id: 'disabled', content: `Disabled (${counts.disabled})` },
    ];
  }, [connections]);

  const filteredConnections = useMemo(() => {
    if (statusTab === 'all') return connections;
    return connections.filter((connection) => connection.status === statusTab);
  }, [connections, statusTab]);

  const rows = filteredConnections.map((conn) => [
    conn.name,
    conn.type,
    <Badge key={conn.id} tone={conn.status === 'active' ? 'success' : conn.status === 'paused' ? 'warning' : 'critical'}>
      {conn.status}
    </Badge>,
    <Text key={conn.id} as="span" fontWeight={conn.syncedSkus && conn.syncedSkus > 0 ? 'semibold' : 'regular'}>
      {conn.syncedSkus !== undefined ? `${conn.syncedSkus} SKU${conn.syncedSkus !== 1 ? 's' : ''}` : '-'}
    </Text>,
    <BlockStack key={conn.id} gap="050">
      <Text as="span">{conn.dest_shop_domain || conn.base_url || '-'}</Text>
      {conn.type === 'shopify' && !conn.dest_location_id && (
        <Badge tone="warning" size="small">Location ID missing - inventory won't update</Badge>
      )}
    </BlockStack>,
    conn.last_synced_at ? new Date(conn.last_synced_at).toLocaleString() : (conn.updated_at ? new Date(conn.updated_at).toLocaleString() : 'Never'),
    <InlineStack key={conn.id} gap="200">
      {conn.status === 'active' && (
        <Button size="slim" onClick={() => handleFullSync(conn.id)}>
          Sync Now
        </Button>
      )}
      <Button size="slim" onClick={() => handleEditClick(conn)}>
        Edit
      </Button>
      {conn.status === 'active' ? (
        <Button size="slim" onClick={() => handlePause(conn.id)}>
          Pause
        </Button>
      ) : (
        <Button size="slim" onClick={() => handleResume(conn.id)}>
          Resume
        </Button>
      )}
      <Button size="slim" tone="critical" onClick={() => handleDeleteClick(conn)}>
        Delete
      </Button>
    </InlineStack>,
  ]);

  const toastMarkup = toast ? <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} /> : null;

  const summaryMarkup = (
    <InlineStack gap="400" wrap={false} align="space-between">
      <BlockStack gap="100">
        <Text variant="headingLg" as="h2">
          Connection health
        </Text>
        <Text as="p" tone="subdued">
          Track active destinations and trigger manual syncs when needed.
        </Text>
      </BlockStack>
      <InlineStack gap="400">
        <Card>
          <BlockStack gap="100">
            <Text as="span" tone="subdued">
              Active
            </Text>
            <Text variant="headingLg" as="p">
              {connections.filter((c) => c.status === 'active').length}
            </Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="100">
            <Text as="span" tone="subdued">
              Paused
            </Text>
            <Text variant="headingLg" as="p">
              {connections.filter((c) => c.status === 'paused').length}
            </Text>
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="100">
            <Text as="span" tone="subdued">
              Disabled
            </Text>
            <Text variant="headingLg" as="p">
              {connections.filter((c) => c.status === 'disabled').length}
            </Text>
          </BlockStack>
        </Card>
      </InlineStack>
    </InlineStack>
  );

  const handleReinstall = useCallback(() => {
    // Extract host from URL if available (needed for App Bridge after OAuth)
    const urlParams = new URLSearchParams(window.location.search);
    const host = urlParams.get('host');
    
    // Redirect to OAuth authorization URL using App Bridge to ensure top-level redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const shopParam = installationStatus?.shop || shop;
    const authUrl = host 
      ? `${appUrl}/api/auth?shop=${shopParam}&host=${encodeURIComponent(host)}`
      : `${appUrl}/api/auth?shop=${shopParam}`;
    
    const redirect = Redirect.create(app);
    redirect.dispatch(Redirect.Action.REMOTE, authUrl);
  }, [installationStatus, shop, app]);

  return (
    <Page
      title="Store Connections"
      subtitle={shop ? `Source shop: ${shop}` : undefined}
      primaryAction={{
        content: 'Add Connection',
        onAction: () => setModalOpen(true),
        disabled: installationStatus?.needsReinstall === true,
      }}
      secondaryActions={
        connections.length > 0
          ? [
              {
                content: 'Delete All Connections',
                destructive: true,
                onAction: () => setDeleteAllModalOpen(true),
                disabled: installationStatus?.needsReinstall === true,
              },
            ]
          : undefined
      }
    >
      {toastMarkup}
      {installationStatus?.needsReinstall && (
        <Banner
          tone="critical"
          title="App Installation Incomplete"
          onDismiss={() => {}}
        >
          <BlockStack gap="200">
            <Text as="p">
              The installation for shop <strong>{installationStatus.shop}</strong> is missing an access token. 
              Please reinstall the app through Shopify OAuth to grant the necessary permissions.
            </Text>
            <Button onClick={handleReinstall} tone="critical">
              Reinstall App
            </Button>
          </BlockStack>
        </Banner>
      )}
      <Layout>
        <Layout.Section>
          {summaryMarkup}
        </Layout.Section>
        <Layout.Section>
          <CalloutCard
            title="Need a refresher on deployment?"
            illustration="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            primaryAction={{
              content: 'View Shopify docs',
              onAction: openExternal('https://shopify.dev/docs/apps'),
            }}
            secondaryAction={{
              content: 'Railway dashboard',
              onAction: openExternal('https://railway.app/dashboard'),
            }}
          >
            Review environment variables and infrastructure before shipping to production.
          </CalloutCard>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {loading ? (
              <div style={{ padding: '1.5rem' }}>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
                </BlockStack>
              </div>
            ) : connections.length === 0 ? (
              <EmptyState
                heading="No connections yet"
                action={{
                  content: 'Add Connection',
                  onAction: () => setModalOpen(true),
                }}
                secondaryAction={{
                  content: 'Learn about syncing',
                  onAction: openExternal('https://shopify.dev/docs/apps/build/online-store'),
                }}
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
              >
                <p>Connect your Shopify or WooCommerce stores to sync inventory and products.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                <Tabs
                  tabs={tabs}
                  selected={tabs.findIndex((tab) => tab.id === statusTab)}
                  onSelect={(index) => setStatusTab(tabs[index].id as typeof statusTab)}
                />
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Name', 'Type', 'Status', 'Synced SKUs', 'Destination', 'Last Updated', 'Actions']}
                  rows={rows}
                />
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Connection"
        primaryAction={{
          content: 'Create',
          onAction: handleCreateConnection,
          loading: submitting,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Connection Type"
              options={[
                { label: 'Shopify Store', value: 'shopify' },
                { label: 'WooCommerce Store', value: 'woocommerce' },
              ]}
              value={connectionType}
              onChange={(value) => setConnectionType(value as 'shopify' | 'woocommerce')}
            />
            <TextField
              label="Name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="My Store Connection"
              autoComplete="off"
            />
            {connectionType === 'shopify' ? (
              <>
                <TextField
                  label="Shop Domain"
                  value={formData.dest_shop_domain}
                  onChange={(value) => setFormData({ ...formData, dest_shop_domain: value })}
                  placeholder="destination-store.myshopify.com"
                  helpText="The Shopify store domain you want to sync to"
                  autoComplete="off"
                />
                <TextField
                  label="Access Token"
                  value={formData.access_token}
                  onChange={(value) => setFormData({ ...formData, access_token: value })}
                  placeholder="shpat_xxx"
                  helpText="Admin API access token from the destination store"
                  type="password"
                  autoComplete="off"
                />
                <TextField
                  label="Location ID"
                  value={formData.dest_location_id}
                  onChange={(value) => setFormData({ ...formData, dest_location_id: value })}
                  placeholder="123456789"
                  helpText="Required for inventory updates. Find it in Shopify Admin > Settings > Locations, or via API: GET /admin/api/2024-10/locations.json"
                  requiredIndicator
                  autoComplete="off"
                />
              </>
            ) : (
              <>
                <TextField
                  label="Base URL"
                  value={formData.base_url}
                  onChange={(value) => setFormData({ ...formData, base_url: value })}
                  placeholder="https://your-store.com"
                  helpText="Your WooCommerce store URL"
                  autoComplete="off"
                />
                <TextField
                  label="Consumer Key"
                  value={formData.consumer_key}
                  onChange={(value) => setFormData({ ...formData, consumer_key: value })}
                  placeholder="ck_xxx"
                  helpText="Get this from WooCommerce → Settings → Advanced → REST API. Create a new API key with Read/Write permissions."
                  autoComplete="off"
                />
                <TextField
                  label="Consumer Secret"
                  value={formData.consumer_secret}
                  onChange={(value) => setFormData({ ...formData, consumer_secret: value })}
                  placeholder="cs_xxx"
                  type="password"
                  helpText="Get this from WooCommerce → Settings → Advanced → REST API. Copy immediately after generating (shown only once)."
                  autoComplete="off"
                />
              </>
            )}
            <Text as="h3" variant="headingMd">Sync Options</Text>
            <Checkbox
              label="Create products if not found"
              checked={formData.create_products !== false}
              onChange={(value) => setFormData({ ...formData, create_products: value })}
              helpText="When enabled, products that don't exist in the destination store will be created automatically. When disabled, only existing products will be updated."
            />
            <Checkbox
              label="Sync prices"
              checked={formData.sync_price === true}
              onChange={(value) => setFormData({ ...formData, sync_price: value })}
              helpText="Enable to update product prices in the destination store. When disabled, only stock levels will be synced."
            />
            <Checkbox
              label="Sync categories"
              checked={formData.sync_categories === true}
              onChange={(value) => setFormData({ ...formData, sync_categories: value })}
              helpText="Enable to sync product categories/types to the destination store. Categories will be created if they don't exist."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setConnectionToDelete(null);
        }}
        title="Delete Connection"
        primaryAction={{
          content: 'Delete',
          onAction: handleDeleteConfirm,
          loading: deleting,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setDeleteModalOpen(false);
              setConnectionToDelete(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              Are you sure you want to delete the connection <strong>{connectionToDelete?.name}</strong>?
            </Text>
            <Text as="p" tone="subdued">
              This action cannot be undone. All sync jobs for this connection will be stopped.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={deleteAllModalOpen}
        onClose={() => {
          setDeleteAllModalOpen(false);
        }}
        title="Delete All Connections"
        primaryAction={{
          content: 'Delete All',
          onAction: handleDeleteAllConfirm,
          loading: deletingAll,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setDeleteAllModalOpen(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              Are you sure you want to delete <strong>all {connections.length} connection(s)</strong>?
            </Text>
            <Text as="p" tone="subdued">
              This action cannot be undone. All sync jobs for these connections will be stopped and removed.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setConnectionToEdit(null);
          setEditFormData({ name: '', dest_location_id: '', access_token: '', sync_price: true });
        }}
        title="Edit Connection"
        primaryAction={{
          content: 'Update',
          onAction: handleUpdateConnection,
          loading: updating,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setEditModalOpen(false);
              setConnectionToEdit(null);
              setEditFormData({ name: '', dest_location_id: '', access_token: '', sync_price: true });
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData({ ...editFormData, name: value })}
              placeholder="My Store Connection"
              autoComplete="off"
            />
            {connectionToEdit?.type === 'shopify' && (
              <>
                <TextField
                  label="Location ID"
                  value={editFormData.dest_location_id}
                  onChange={(value) => setEditFormData({ ...editFormData, dest_location_id: value })}
                  placeholder="123456789"
                  helpText="Required for inventory updates. Find it in Shopify Admin > Settings > Locations, or via API: GET /admin/api/2024-10/locations.json"
                  requiredIndicator
                  autoComplete="off"
                />
                {connectionToEdit?.dest_shop_domain && (
                  <Text as="p" tone="subdued" variant="bodySm">
                    Destination: {connectionToEdit.dest_shop_domain}
                  </Text>
                )}
                <TextField
                  label="Access Token"
                  value={editFormData.access_token}
                  onChange={(value) => setEditFormData({ ...editFormData, access_token: value })}
                  placeholder="shpat_xxx (leave empty to keep current token)"
                  helpText="Update the Admin API access token if it's expired or invalid. Leave empty to keep the current token."
                  type="password"
                  autoComplete="off"
                />
              </>
            )}
            {connectionToEdit?.type === 'woocommerce' && connectionToEdit?.base_url && (
              <Text as="p" tone="subdued" variant="bodySm">
                Destination: {connectionToEdit.base_url}
              </Text>
            )}
            <Checkbox
              label="Sync prices"
              checked={editFormData.sync_price !== false}
              onChange={(value) => setEditFormData({ ...editFormData, sync_price: value })}
              helpText="Enable this to sync product prices to the destination store. When disabled, only inventory levels will be synced."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

