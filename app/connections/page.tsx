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
  ProgressBar,
  Spinner,
  Divider,
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
    sync_tags: false,
    sync_collections: false,
    create_products: true,
    product_status: false, // false = draft, true = active
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null);
  const [statusTab, setStatusTab] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    sync_categories: false,
    sync_tags: false,
    sync_collections: false,
    create_products: true,
    product_status: false,
  });
  const [updating, setUpdating] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    isRunning: boolean;
    progress?: { total: number; completed: number; failed: number; remaining: number; percentage: number };
    speed?: { items_per_minute: number; estimated_minutes_remaining: number | null };
    started_at?: string;
  } | null>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [errorSummary, setErrorSummary] = useState<{
    health: 'healthy' | 'warning' | 'critical';
    errors: any;
  } | null>(null);
  const [dashboardModalOpen, setDashboardModalOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({ name: '', retailer_email: '', retailer_shop_domain: '' });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ invite_url: string; retailer_shop_domain: string } | null>(null);
  const [invitesModalOpen, setInvitesModalOpen] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
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
              sync_tags: formData.sync_tags === true,
              sync_collections: formData.sync_collections === true,
              create_products: formData.create_products !== false,
              product_status: formData.product_status === true,
            }
          : {
              name: formData.name,
              base_url: formData.base_url,
              consumer_key: formData.consumer_key,
              consumer_secret: formData.consumer_secret,
              sync_price: formData.sync_price === true,
              sync_categories: formData.sync_categories === true,
              sync_tags: formData.sync_tags === true,
              sync_collections: formData.sync_collections === true,
              create_products: formData.create_products !== false,
              product_status: formData.product_status === true,
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
        sync_tags: false,
        sync_collections: false,
        create_products: true,
        product_status: false,
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

  const handleViewDashboard = async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setDashboardModalOpen(true);
    await fetchDashboardData(connectionId);
  };

  const fetchDashboardData = useCallback(async (connectionId: string) => {
    try {
      // Fetch progress, history, and error summary in parallel
      const [progressRes, historyRes, errorsRes] = await Promise.all([
        makeRequest(`/api/connections/${connectionId}/progress`).catch(() => ({ isRunning: false })),
        makeRequest(`/api/connections/${connectionId}/history?limit=10`).catch(() => ({ jobs: [] })),
        makeRequest(`/api/connections/${connectionId}/errors?hours=24`).catch(() => ({ health: 'healthy', errors: {} })),
      ]);

      setSyncProgress(progressRes);
      setSyncHistory(historyRes.jobs || []);
      setErrorSummary({
        health: errorsRes.health || 'healthy',
        errors: errorsRes.errors || {},
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, [makeRequest]);

  // Poll for progress updates when dashboard is open and sync is running
  useEffect(() => {
    if (!dashboardModalOpen || !selectedConnectionId || !syncProgress?.isRunning) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const progressRes = await makeRequest(`/api/connections/${selectedConnectionId}/progress`);
        setSyncProgress(progressRes);
        if (!progressRes.isRunning && selectedConnectionId) {
          // Sync finished, refresh all data
          await fetchDashboardData(selectedConnectionId);
        }
      } catch (err) {
        console.error('Error polling progress:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [dashboardModalOpen, selectedConnectionId, syncProgress?.isRunning, makeRequest, fetchDashboardData]);

  const handleExportLogs = async (connectionId: string, connectionName: string) => {
    try {
      // Get session token for authentication
      let token: string;
      try {
        token = await getSessionToken(app);
      } catch (err) {
        console.error('Failed to retrieve Shopify session token', err);
        throw new Error('Session expired. Please reopen the app from Shopify Admin.');
      }

      // Fetch CSV directly (don't use makeRequest since it tries to parse as JSON)
      const downloadResponse = await fetch(`/api/connections/${connectionId}/export-logs?limit=10000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Shop': shop,
        },
      });
      
      if (!downloadResponse.ok) {
        // Try to parse error message if response is JSON
        const contentType = downloadResponse.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await downloadResponse.json();
          throw new Error(errorData.error || `Failed to export logs: ${downloadResponse.status}`);
        }
        throw new Error(`Failed to export logs: ${downloadResponse.status}`);
      }
      
      // Get the CSV blob
      const blob = await downloadResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedName = connectionName.replace(/[^a-zA-Z0-9-_]/g, '_');
      a.download = `sync-logs-${sanitizedName}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setToast({ content: 'Logs exported successfully' });
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to export logs', error: true });
    }
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await makeRequest('/api/connections/templates');
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setToast({ content: 'Failed to load templates', error: true });
    }
  }, [makeRequest]);

  const fetchInvites = useCallback(async () => {
    try {
      const data = await makeRequest('/api/connections/invites');
      setInvites(data.invites || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
      setToast({ content: 'Failed to load invites', error: true });
    }
  }, [makeRequest]);

  const handleCreateInvite = async () => {
    if (!inviteFormData.name.trim()) {
      setToast({ content: 'Connection name is required', error: true });
      return;
    }
    if (!inviteFormData.retailer_shop_domain.trim()) {
      setToast({ content: 'Retailer store domain is required', error: true });
      return;
    }
    try {
      setInviteSubmitting(true);
      const data = await makeRequest('/api/connections/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteFormData.name.trim(),
          retailer_email: inviteFormData.retailer_email.trim() || undefined,
          retailer_shop_domain: inviteFormData.retailer_shop_domain.trim(),
        }),
      });
      setCreatedInvite({ invite_url: data.invite_url, retailer_shop_domain: data.retailer_shop_domain });
      setToast({ content: 'Invite created. Share the link with your retailer.' });
      fetchInvites();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to create invite', error: true });
    } finally {
      setInviteSubmitting(false);
    }
  };

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setToast({ content: 'Link copied to clipboard' });
  };

  const handleCreateTemplate = async (connectionId: string, templateName: string) => {
    try {
      await makeRequest('/api/connections/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: connectionId, name: templateName }),
      });
      setToast({ content: 'Template created successfully' });
      fetchTemplates();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to create template', error: true });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await makeRequest(`/api/connections/templates/${templateId}`, { method: 'DELETE' });
      setToast({ content: 'Template deleted successfully' });
      fetchTemplates();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to delete template', error: true });
    }
  };

  const handleUseTemplate = async (templateId: string, connectionName: string, accessToken?: string, consumerSecret?: string) => {
    try {
      const body: any = { connection_name: connectionName };
      if (accessToken) body.access_token = accessToken;
      if (consumerSecret) body.consumer_secret = consumerSecret;
      
      const data = await makeRequest(`/api/connections/templates/${templateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setToast({ content: 'Connection created from template successfully' });
      setTemplatesModalOpen(false);
      fetchConnections();
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to create connection from template', error: true });
    }
  };

  const handlePreviewSync = async (connectionId: string) => {
    try {
      setLoadingPreview(true);
      const data = await makeRequest(`/api/connections/${connectionId}/preview?limit=50`);
      setPreviewData(data.preview);
      setPreviewModalOpen(true);
    } catch (err) {
      setToast({ content: err instanceof Error ? err.message : 'Failed to generate preview', error: true });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleEditClick = async (connection: Connection) => {
    try {
      // Fetch full connection details
      const data = await makeRequest(`/api/connections/${connection.id}`);
      const fullConnection = data.connection;
      setConnectionToEdit(fullConnection);
      const rules = fullConnection.rules || {};
      // Get sync options from connection (they're stored as 1/0 in DB, but may be in rules for backward compatibility)
      setEditFormData({
        name: fullConnection.name || '',
        dest_location_id: fullConnection.dest_location_id || '',
        access_token: '', // Don't pre-fill for security - user enters new token if updating
        sync_price: fullConnection.sync_price !== false && fullConnection.sync_price !== 0,
        sync_categories: fullConnection.sync_categories === true || fullConnection.sync_categories === 1,
        sync_tags: fullConnection.sync_tags === true || fullConnection.sync_tags === 1,
        sync_collections: fullConnection.sync_collections === true || fullConnection.sync_collections === 1,
        create_products: fullConnection.create_products !== false && fullConnection.create_products !== 0,
        product_status: fullConnection.product_status === true || fullConnection.product_status === 1,
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
      setEditFormData({ 
        name: '', 
        dest_location_id: '', 
        access_token: '', 
        sync_price: true,
        sync_categories: false,
        sync_tags: false,
        sync_collections: false,
        create_products: true,
        product_status: false,
      });
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
    let filtered = statusTab === 'all' ? connections : connections.filter((connection) => connection.status === statusTab);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((connection) => 
        connection.name.toLowerCase().includes(query) ||
        (connection.dest_shop_domain && connection.dest_shop_domain.toLowerCase().includes(query)) ||
        (connection.base_url && connection.base_url.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [connections, statusTab, searchQuery]);

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
      <Button 
        size="slim" 
        onClick={() => handleExportLogs(conn.id, conn.name)}
        disabled={loading}
      >
        Export Logs
      </Button>
      <Button 
        size="slim" 
        onClick={() => handleViewDashboard(conn.id)}
        disabled={loading}
      >
        Dashboard
      </Button>
      <Button 
        size="slim" 
        onClick={() => handlePreviewSync(conn.id)}
        disabled={loading || loadingPreview}
      >
        Preview
      </Button>
      <Button 
        size="slim" 
        onClick={() => {
          const name = prompt('Enter template name:');
          if (name) {
            handleCreateTemplate(conn.id, name);
          }
        }}
        disabled={loading}
      >
        Save as Template
      </Button>
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
        [
          {
            content: 'Invite Retailer',
            onAction: () => {
              setCreatedInvite(null);
              setInviteFormData({ name: '', retailer_email: '', retailer_shop_domain: '' });
              setInviteModalOpen(true);
            },
            disabled: installationStatus?.needsReinstall === true,
          },
          {
            content: 'View Invites',
            onAction: () => {
              setInvitesModalOpen(true);
              fetchInvites();
            },
            disabled: installationStatus?.needsReinstall === true,
          },
          ...(connections.length > 0 ? [{
            content: 'Templates',
            onAction: () => {
              setTemplatesModalOpen(true);
              fetchTemplates();
            },
            disabled: installationStatus?.needsReinstall === true,
          }] : []),
          ...(connections.length > 0 ? [{
            content: 'Delete All Connections',
            destructive: true,
            onAction: () => setDeleteAllModalOpen(true),
            disabled: installationStatus?.needsReinstall === true,
          }] : []),
        ]
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
                <InlineStack gap="200" align="space-between" blockAlign="center">
                  <div style={{ flex: 1, maxWidth: '400px' }}>
                    <TextField
                      label="Search connections"
                      labelHidden
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Search by name, domain, or URL..."
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => setSearchQuery('')}
                    />
                  </div>
                  <Text as="span" tone="subdued">
                    {filteredConnections.length} of {connections.length} connection{connections.length !== 1 ? 's' : ''}
                  </Text>
                </InlineStack>
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
              label="Publish products immediately"
              checked={formData.product_status === true}
              onChange={(value) => setFormData({ ...formData, product_status: value })}
              helpText="When enabled, newly created products will be published (active) immediately. When disabled, products will be created as drafts."
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
            <Checkbox
              label="Sync tags"
              checked={formData.sync_tags === true}
              onChange={(value) => setFormData({ ...formData, sync_tags: value })}
              helpText="When enabled, product tags from the source will be synced to the destination store. When disabled, tags will not be updated."
            />
            <Checkbox
              label="Sync collections"
              checked={formData.sync_collections === true}
              onChange={(value) => setFormData({ ...formData, sync_collections: value })}
              helpText="Enable to sync product collections to the destination store. Collections will be created if they don't exist."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Invite Retailer Modal */}
      <Modal
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setCreatedInvite(null);
          setInviteFormData({ name: '', retailer_email: '', retailer_shop_domain: '' });
          fetchConnections();
        }}
        title="Invite Retailer"
        primaryAction={
          createdInvite
            ? undefined
            : {
                content: 'Create Invite',
                onAction: handleCreateInvite,
                loading: inviteSubmitting,
              }
        }
        secondaryActions={[
          {
            content: createdInvite ? 'Done' : 'Cancel',
            onAction: () => {
              setInviteModalOpen(false);
              setCreatedInvite(null);
              setInviteFormData({ name: '', retailer_email: '', retailer_shop_domain: '' });
              fetchConnections();
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {createdInvite ? (
              <BlockStack gap="300">
                <Banner tone="success" title="Invite created">
                  Share this link with your retailer. They will install the app on their store to receive your inventory updates.
                </Banner>
                <BlockStack gap="200">
                  <Text as="p" fontWeight="semibold">Invite link</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <TextField
                      label=""
                      labelHidden
                      value={createdInvite.invite_url}
                      readOnly
                      autoComplete="off"
                    />
                    <Button onClick={() => copyInviteLink(createdInvite.invite_url)}>Copy</Button>
                  </InlineStack>
                </BlockStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  Store: {createdInvite.retailer_shop_domain}
                </Text>
              </BlockStack>
            ) : (
              <>
                <Text as="p" tone="subdued">
                  Create an invite link for your retailer. They will install the app on their Shopify store to receive automated inventory updates.
                </Text>
                <TextField
                  label="Connection name"
                  value={inviteFormData.name}
                  onChange={(value) => setInviteFormData({ ...inviteFormData, name: value })}
                  placeholder="e.g. Retail Store ABC"
                  autoComplete="off"
                />
                <TextField
                  label="Retailer store domain"
                  value={inviteFormData.retailer_shop_domain}
                  onChange={(value) => setInviteFormData({ ...inviteFormData, retailer_shop_domain: value })}
                  placeholder="retailer-store.myshopify.com"
                  helpText="The Shopify store domain of the retailer you're inviting"
                  autoComplete="off"
                />
                <TextField
                  label="Retailer email (optional)"
                  value={inviteFormData.retailer_email}
                  onChange={(value) => setInviteFormData({ ...inviteFormData, retailer_email: value })}
                  placeholder="retailer@example.com"
                  helpText="For your reference when sending the invite"
                  type="email"
                  autoComplete="off"
                />
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Invites List Modal */}
      <Modal
        open={invitesModalOpen}
        onClose={() => setInvitesModalOpen(false)}
        title="Connection Invites"
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setInvitesModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Invites you&apos;ve sent to retailers. When they complete the setup, the connection will appear in your connections list.
            </Text>
            {invites.length === 0 ? (
              <EmptyState
                heading="No invites yet"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
              >
                <p>Create an invite from the &quot;Invite Retailer&quot; button to get started.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                {invites.map((inv: any) => (
                  <Card key={inv.id}>
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="h3" variant="headingMd">{inv.name}</Text>
                          <Text as="p" tone="subdued" variant="bodySm">
                            {inv.retailer_shop_domain}
                            {inv.retailer_email ? ` • ${inv.retailer_email}` : ''}
                          </Text>
                        </BlockStack>
                        <Badge tone={inv.status === 'accepted' ? 'success' : inv.status === 'pending' ? 'attention' : 'critical'}>
                          {inv.status}
                        </Badge>
                      </InlineStack>
                      {inv.status === 'pending' && (
                        <InlineStack gap="200">
                          <Button size="slim" onClick={() => copyInviteLink(inv.invite_url)}>
                            Copy link
                          </Button>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            )}
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
          setEditFormData({ 
        name: '', 
        dest_location_id: '', 
        access_token: '', 
        sync_price: true,
        sync_categories: false,
        sync_tags: false,
        sync_collections: false,
        create_products: true,
        product_status: false,
      });
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
              setEditFormData({ 
                name: '', 
                dest_location_id: '', 
                access_token: '', 
                sync_price: true,
                sync_categories: false,
                sync_tags: false,
                sync_collections: false,
                create_products: true,
                product_status: false,
              });
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
              checked={editFormData.sync_price}
              onChange={(value) => setEditFormData({ ...editFormData, sync_price: value })}
              helpText="Enable this to sync product prices to the destination store. When disabled, only inventory levels will be synced."
            />
            <Checkbox
              label="Sync categories"
              checked={editFormData.sync_categories}
              onChange={(value) => setEditFormData({ ...editFormData, sync_categories: value })}
              helpText="Enable this to sync product categories to the destination store. Categories will be created if they don't exist."
            />
            <Checkbox
              label="Sync tags"
              checked={editFormData.sync_tags}
              onChange={(value) => setEditFormData({ ...editFormData, sync_tags: value })}
              helpText="Enable this to sync product tags to the destination store."
            />
            <Checkbox
              label="Sync collections"
              checked={editFormData.sync_collections}
              onChange={(value) => setEditFormData({ ...editFormData, sync_collections: value })}
              helpText="Enable this to sync product collections to the destination store. Collections will be created if they don't exist."
            />
            <Checkbox
              label="Create new products if not available in destination store"
              checked={editFormData.create_products}
              onChange={(value) => setEditFormData({ ...editFormData, create_products: value })}
              helpText="When enabled, products that don't exist in the destination store will be created automatically. When disabled, only existing products will be updated."
            />
            <Checkbox
              label="Publish products immediately (active status)"
              checked={editFormData.product_status}
              onChange={(value) => setEditFormData({ ...editFormData, product_status: value })}
              helpText="When enabled, newly created products will be published (active) immediately. When disabled, products will be created as drafts."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Sync Status Dashboard Modal */}
      <Modal
        open={dashboardModalOpen}
        onClose={() => {
          setDashboardModalOpen(false);
          setSelectedConnectionId(null);
          setSyncProgress(null);
          setSyncHistory([]);
          setErrorSummary(null);
        }}
        title="Sync Status Dashboard"
      >
        {selectedConnectionId && (
          <BlockStack gap="400">
            {/* Progress Section */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Current Sync Progress</Text>
                {syncProgress?.isRunning ? (
                  <BlockStack gap="200">
                    <ProgressBar progress={syncProgress.progress?.percentage || 0} />
                    <InlineStack gap="400" align="space-between">
                      <Text as="span" tone="subdued">
                        {syncProgress.progress?.completed || 0} / {syncProgress.progress?.total || 0} items completed
                      </Text>
                      {syncProgress.progress?.failed && syncProgress.progress.failed > 0 && (
                        <Text as="span" tone="critical">
                          {syncProgress.progress.failed} failed
                        </Text>
                      )}
                    </InlineStack>
                    {syncProgress.speed && (
                      <BlockStack gap="100">
                        <Text as="span" tone="subdued" variant="bodySm">
                          Speed: {syncProgress.speed.items_per_minute} items/min
                        </Text>
                        {syncProgress.speed.estimated_minutes_remaining && (
                          <Text as="span" tone="subdued" variant="bodySm">
                            Estimated time remaining: {syncProgress.speed.estimated_minutes_remaining} minutes
                          </Text>
                        )}
                      </BlockStack>
                    )}
                    {syncProgress.started_at && (
                      <Text as="span" tone="subdued" variant="bodySm">
                        Started: {new Date(syncProgress.started_at).toLocaleString()}
                      </Text>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">No sync in progress</Text>
                )}
              </BlockStack>
            </Card>

            {/* Error Summary Section */}
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Error Summary (Last 24 Hours)</Text>
                  {errorSummary && (
                    <Badge tone={errorSummary.health === 'healthy' ? 'success' : errorSummary.health === 'warning' ? 'warning' : 'critical'}>
                      {errorSummary.health}
                    </Badge>
                  )}
                </InlineStack>
                {errorSummary?.errors ? (
                  <BlockStack gap="200">
                    <InlineStack gap="400">
                      <Text as="span">
                        <strong>Total:</strong> {errorSummary.errors.total || 0}
                      </Text>
                      <Text as="span">
                        <strong>Errors:</strong> <span style={{ color: 'var(--p-color-text-critical)' }}>{errorSummary.errors.byLevel?.error || 0}</span>
                      </Text>
                      <Text as="span">
                        <strong>Warnings:</strong> <span style={{ color: 'var(--p-color-text-warning)' }}>{errorSummary.errors.byLevel?.warn || 0}</span>
                      </Text>
                      <Text as="span">
                        <strong>Info:</strong> <span style={{ color: 'var(--p-color-text-success)' }}>{errorSummary.errors.byLevel?.info || 0}</span>
                      </Text>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">No errors in the last 24 hours</Text>
                )}
              </BlockStack>
            </Card>

            {/* Sync History Section */}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Recent Sync History</Text>
                {syncHistory.length > 0 ? (
                  <BlockStack gap="200">
                    {syncHistory.map((job: any) => {
                      const getBadgeTone = (state: string): 'success' | 'critical' | 'warning' | undefined => {
                        if (state === 'succeeded') return 'success';
                        if (state === 'failed' || state === 'dead') return 'critical';
                        if (state === 'running') return 'warning';
                        return undefined;
                      };
                      return (
                      <BlockStack key={job.id} gap="100">
                        <InlineStack gap="200" align="space-between" blockAlign="center">
                          <InlineStack gap="200">
                            <Badge tone={getBadgeTone(job.state)}>
                              {job.state}
                            </Badge>
                            <Text as="span" variant="bodySm">{job.job_type}</Text>
                          </InlineStack>
                          <Text as="span" tone="subdued" variant="bodySm">
                            {job.duration_minutes ? `${job.duration_minutes} min` : 'N/A'}
                          </Text>
                        </InlineStack>
                        {job.last_error && (
                          <Banner tone="critical" title="Error">
                            {job.last_error}
                          </Banner>
                        )}
                        <Text as="span" variant="bodySm">
                          {new Date(job.created_at).toLocaleString()}
                        </Text>
                        <Divider />
                      </BlockStack>
                      );
                    })}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">No sync history available</Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        )}
      </Modal>

      {/* Templates Modal */}
      <Modal
        open={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        title="Connection Templates"
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setTemplatesModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Save connection configurations as templates to quickly create new connections with the same settings.
            </Text>
            {templates.length === 0 ? (
              <EmptyState
                heading="No templates yet"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
              >
                <p>Create a template from an existing connection to get started.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="300">
                {templates.map((template: any) => (
                  <Card key={template.id}>
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="h3" variant="headingMd">{template.name}</Text>
                          <Text as="p" tone="subdued" variant="bodySm">
                            Type: {template.type} • Created: {new Date(template.created_at).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button
                            size="slim"
                            onClick={() => {
                              const name = prompt('Enter connection name:');
                              if (name) {
                                if (template.type === 'shopify') {
                                  const token = prompt('Enter access token:');
                                  if (token) {
                                    handleUseTemplate(template.id, name, token);
                                  }
                                } else {
                                  const secret = prompt('Enter consumer secret:');
                                  if (secret) {
                                    handleUseTemplate(template.id, name, undefined, secret);
                                  }
                                }
                              }
                            }}
                          >
                            Use Template
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => {
                              if (confirm(`Delete template "${template.name}"?`)) {
                                handleDeleteTemplate(template.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            )}
            <Divider />
            <Text as="h3" variant="headingMd">Create Template from Connection</Text>
            <Select
              label="Select Connection"
              options={[
                { label: 'Select a connection...', value: '' },
                ...connections.map((conn) => ({ label: conn.name, value: conn.id })),
              ]}
              onChange={(value) => {
                if (value) {
                  const name = prompt('Enter template name:');
                  if (name) {
                    handleCreateTemplate(value, name);
                  }
                }
              }}
              value=""
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Sync Preview Modal */}
      <Modal
        open={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setPreviewData(null);
        }}
        title="Sync Preview"
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => {
              setPreviewModalOpen(false);
              setPreviewData(null);
            },
          },
        ]}
      >
        <Modal.Section>
          {loadingPreview ? (
            <BlockStack gap="200">
              <Spinner accessibilityLabel="Loading preview" size="small" />
              <Text as="p" tone="subdued">Generating preview...</Text>
            </BlockStack>
          ) : previewData ? (
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Summary</Text>
                  <InlineStack gap="400">
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">Total Items</Text>
                      <Text as="span" variant="headingMd">{previewData.total_items || 0}</Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">To Sync</Text>
                      <Text as="span" variant="headingMd">{previewData.items_to_sync || 0}</Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">To Create</Text>
                      <Text as="span" variant="headingMd" tone="success">{previewData.items_to_create || 0}</Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">To Update</Text>
                      <Text as="span" variant="headingMd">{previewData.items_to_update || 0}</Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text as="span" tone="subdued" variant="bodySm">To Skip</Text>
                      <Text as="span" variant="headingMd" tone="critical">{previewData.items_to_skip || 0}</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>
              {previewData.preview_items && previewData.preview_items.length > 0 && (
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">Preview Items (showing first {previewData.preview_items.length})</Text>
                    <BlockStack gap="200">
                      {previewData.preview_items.map((item: any, index: number) => (
                        <Card key={index}>
                          <BlockStack gap="100">
                            <InlineStack gap="200" align="space-between" blockAlign="center">
                              <BlockStack gap="050">
                                <Text as="span" fontWeight="semibold">{item.title}</Text>
                                <Text as="span" tone="subdued" variant="bodySm">SKU: {item.sku}</Text>
                              </BlockStack>
                              <Badge tone={item.action === 'create' ? 'success' : item.action === 'update' ? 'info' : 'critical'}>
                                {item.action}
                              </Badge>
                            </InlineStack>
                            {item.reason && (
                              <Text as="span" tone="subdued" variant="bodySm">Reason: {item.reason}</Text>
                            )}
                            {(item.price !== undefined || item.stock !== undefined) && (
                              <InlineStack gap="200">
                                {item.price !== undefined && (
                                  <Text as="span" variant="bodySm">Price: ${item.price.toFixed(2)}</Text>
                                )}
                                {item.stock !== undefined && (
                                  <Text as="span" variant="bodySm">Stock: {item.stock}</Text>
                                )}
                              </InlineStack>
                            )}
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          ) : (
            <Text as="p" tone="subdued">No preview data available</Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}

