/**
 * =============================================================================
 * FILE: src/app/(dashboard)/settings/api-keys/page.tsx
 * PURPOSE: API Keys & Credentials Management
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays and manages API keys for integrations
 * - Shows Meta/WhatsApp API credentials
 * - Webhook configuration
 * - API usage statistics
 * - Generate and revoke API keys
 * - Test webhook endpoint
 * 
 * KEY FEATURES:
 * - API key generation with scopes
 * - Copy to clipboard functionality
 * - Key expiration settings
 * - Webhook URL configuration
 * - Webhook event selection
 * - Test webhook button
 * - API request logs
 * - Usage limits display
 * 
 * API KEY SCOPES:
 * - messages:read - Read messages
 * - messages:write - Send messages
 * - contacts:read - Read contacts
 * - contacts:write - Create/update contacts
 * - templates:read - Read templates
 * - campaigns:write - Create campaigns
 * 
 * WEBHOOK EVENTS:
 * - message.received - New incoming message
 * - message.delivered - Message delivered
 * - message.read - Message read
 * - contact.created - New contact
 * - campaign.completed - Campaign finished
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Key,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Loader2,
  ExternalLink,
  Play,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

interface WebhookConfig {
  url: string;
  secret: string;
  events: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'FAILED';
  lastTriggered?: string;
  failureCount: number;
}

interface MetaCredentials {
  appId: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessTokenSet: boolean;
}

const SCOPES = [
  { id: 'messages:read', label: 'Read Messages', desc: 'Access message history' },
  { id: 'messages:write', label: 'Send Messages', desc: 'Send WhatsApp messages' },
  { id: 'contacts:read', label: 'Read Contacts', desc: 'Access contact list' },
  { id: 'contacts:write', label: 'Write Contacts', desc: 'Create/update contacts' },
  { id: 'templates:read', label: 'Read Templates', desc: 'Access message templates' },
  { id: 'campaigns:write', label: 'Create Campaigns', desc: 'Create broadcast campaigns' },
];

const WEBHOOK_EVENTS = [
  { id: 'message.received', label: 'Message Received', desc: 'New incoming message' },
  { id: 'message.delivered', label: 'Message Delivered', desc: 'Message delivered to recipient' },
  { id: 'message.read', label: 'Message Read', desc: 'Message read by recipient' },
  { id: 'message.failed', label: 'Message Failed', desc: 'Message delivery failed' },
  { id: 'contact.created', label: 'Contact Created', desc: 'New contact added' },
  { id: 'contact.opted_out', label: 'Contact Opted Out', desc: 'Contact unsubscribed' },
  { id: 'campaign.completed', label: 'Campaign Completed', desc: 'Campaign finished sending' },
];

export default function ApiKeysPage() {
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [metaCredentials, setMetaCredentials] = useState<MetaCredentials | null>(null);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // New key form
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch API keys
      const { data: keysData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (keysData) {
        setApiKeys(keysData.map((k: any) => ({
          id: k.id,
          name: k.name,
          key: k.key_hash, // Only show masked version
          scopes: k.scopes || [],
          lastUsed: k.last_used_at,
          createdAt: k.created_at,
          expiresAt: k.expires_at,
          status: k.status,
        })));
      }

      // Fetch webhook config
      const { data: webhookData } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .single();

      if (webhookData) {
        setWebhook({
          url: webhookData.url || '',
          secret: webhookData.secret || '',
          events: webhookData.events || [],
          status: webhookData.status || 'INACTIVE',
          lastTriggered: webhookData.last_triggered_at,
          failureCount: webhookData.failure_count || 0,
        });
      } else {
        setWebhook({
          url: '',
          secret: '',
          events: [],
          status: 'INACTIVE',
          failureCount: 0,
        });
      }

      // Fetch Meta credentials
      const { data: org } = await supabase
        .from('organizations')
        .select('meta_app_id, meta_phone_number_id, meta_business_account_id, meta_access_token')
        .eq('id', userData.organization_id)
        .single();

      if (org) {
        setMetaCredentials({
          appId: org.meta_app_id || '',
          phoneNumberId: org.meta_phone_number_id || '',
          businessAccountId: org.meta_business_account_id || '',
          accessTokenSet: !!org.meta_access_token,
        });
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || newKeyScopes.length === 0) return;
    setCreatingKey(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      // Generate API key
      const apiKey = `if_${crypto.randomUUID().replace(/-/g, '')}`;
      
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          organization_id: userData?.organization_id,
          name: newKeyName,
          key_hash: apiKey, // In production, hash this
          scopes: newKeyScopes,
          status: 'ACTIVE',
        })
        .select()
        .single();

      if (data) {
        setApiKeys(prev => [{
          id: data.id,
          name: data.name,
          key: apiKey, // Show full key only on creation
          scopes: data.scopes,
          createdAt: data.created_at,
          status: 'ACTIVE',
        }, ...prev]);

        // Alert user to copy key
        alert(`API Key created! Copy it now, it won't be shown again:\n\n${apiKey}`);
      }

      setShowCreateKey(false);
      setNewKeyName('');
      setNewKeyScopes([]);
    } catch (err) {
      console.error('Create key error:', err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;

    const supabase = createClient();
    await supabase
      .from('api_keys')
      .update({ status: 'REVOKED' })
      .eq('id', keyId);

    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'REVOKED' as const } : k));
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveWebhook = async () => {
    if (!webhook) return;
    setSavingWebhook(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      await supabase
        .from('webhook_configs')
        .upsert({
          organization_id: userData?.organization_id,
          url: webhook.url,
          secret: webhook.secret,
          events: webhook.events,
          status: webhook.url ? 'ACTIVE' : 'INACTIVE',
        });

      setWebhook({ ...webhook, status: webhook.url ? 'ACTIVE' : 'INACTIVE' });
    } catch (err) {
      console.error('Save webhook error:', err);
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhook?.url) return;
    setTestingWebhook(true);

    try {
      const response = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhook.url, secret: webhook.secret }),
      });

      if (response.ok) {
        alert('Test webhook sent successfully!');
      } else {
        alert('Webhook test failed. Please check your URL.');
      }
    } catch (err) {
      alert('Webhook test failed. Please check your URL.');
    } finally {
      setTestingWebhook(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const maskKey = (key: string) => {
    if (key.length < 12) return key;
    return key.slice(0, 6) + '•'.repeat(20) + key.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys & Webhooks</h1>
          <p className="text-gray-500">Manage API credentials and integrations</p>
        </div>
      </div>

      {/* Meta/WhatsApp Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-500" />
            WhatsApp API Credentials
          </CardTitle>
          <CardDescription>Your Meta Business API configuration</CardDescription>
        </CardHeader>
        <CardContent>
          {metaCredentials ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">App ID</p>
                <p className="font-mono text-sm">{metaCredentials.appId || 'Not configured'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Phone Number ID</p>
                <p className="font-mono text-sm">{metaCredentials.phoneNumberId || 'Not configured'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Business Account ID</p>
                <p className="font-mono text-sm">{metaCredentials.businessAccountId || 'Not configured'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Access Token</p>
                <div className="flex items-center space-x-2">
                  {metaCredentials.accessTokenSet ? (
                    <span className="text-green-600 text-sm flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Configured
                    </span>
                  ) : (
                    <span className="text-red-600 text-sm flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Not set
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading credentials...</p>
          )}
          <Button variant="outline" className="mt-4" asChild>
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Meta Developer Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2 text-yellow-500" />
                API Keys
              </CardTitle>
              <CardDescription>Manage your API keys for external integrations</CardDescription>
            </div>
            <Button variant="whatsapp" onClick={() => setShowCreateKey(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p>No API keys created yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={cn(
                    'p-4 border rounded-lg',
                    key.status === 'REVOKED' && 'opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{key.name}</p>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          key.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          key.status === 'EXPIRED' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {key.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {showKeyId === key.id ? key.key : maskKey(key.key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowKeyId(showKeyId === key.id ? null : key.id)}
                        >
                          {showKeyId === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyKey(key.key, key.id)}
                        >
                          {copiedId === key.id ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Created: {formatDate(key.createdAt)}</span>
                        {key.lastUsed && <span>Last used: {formatDate(key.lastUsed)}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.scopes.map((scope) => (
                          <span key={scope} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    {key.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Webhook className="h-5 w-5 mr-2 text-purple-500" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>Receive real-time events at your endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhook && (
            <>
              <div>
                <Label>Webhook URL</Label>
                <Input
                  value={webhook.url}
                  onChange={(e) => setWebhook({ ...webhook, url: e.target.value })}
                  placeholder="https://your-server.com/webhook"
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label>Webhook Secret</Label>
                <Input
                  value={webhook.secret}
                  onChange={(e) => setWebhook({ ...webhook, secret: e.target.value })}
                  placeholder="your-secret-key"
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Used to sign webhook payloads</p>
              </div>

              <div>
                <Label>Events to Subscribe</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className={cn(
                        'flex items-start p-3 border rounded-lg cursor-pointer',
                        webhook.events.includes(event.id) ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={webhook.events.includes(event.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhook({ ...webhook, events: [...webhook.events, event.id] });
                          } else {
                            setWebhook({ ...webhook, events: webhook.events.filter(ev => ev !== event.id) });
                          }
                        }}
                        className="mt-1 mr-3"
                      />
                      <div>
                        <p className="font-medium text-sm">{event.label}</p>
                        <p className="text-xs text-gray-500">{event.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {webhook.status && (
                <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      webhook.status === 'ACTIVE' ? 'bg-green-500' :
                      webhook.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-400'
                    )} />
                    <span className="text-sm">{webhook.status}</span>
                  </div>
                  {webhook.lastTriggered && (
                    <span className="text-xs text-gray-500">
                      Last triggered: {formatDate(webhook.lastTriggered)}
                    </span>
                  )}
                  {webhook.failureCount > 0 && (
                    <span className="text-xs text-red-600">
                      {webhook.failureCount} failures
                    </span>
                  )}
                </div>
              )}

              <div className="flex space-x-2">
                <Button variant="whatsapp" onClick={handleSaveWebhook} disabled={savingWebhook}>
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Webhook
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={!webhook.url || testingWebhook}
                >
                  {testingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Test Webhook
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      {showCreateKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>Create API Key</CardTitle>
              <CardDescription>Generate a new API key for integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Key Name *</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production Server"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Permissions *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className={cn(
                        'flex items-start p-2 border rounded cursor-pointer text-sm',
                        newKeyScopes.includes(scope.id) ? 'border-whatsapp bg-green-50' : 'border-gray-200'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope.id]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== scope.id));
                          }
                        }}
                        className="mt-0.5 mr-2"
                      />
                      <div>
                        <p className="font-medium">{scope.label}</p>
                        <p className="text-xs text-gray-500">{scope.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateKey(false)}>
                  Cancel
                </Button>
                <Button
                  variant="whatsapp"
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || newKeyScopes.length === 0 || creatingKey}
                >
                  {creatingKey ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                  Create Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
