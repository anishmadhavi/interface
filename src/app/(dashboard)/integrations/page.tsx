/**
 * =============================================================================
 * FILE: src/app/(dashboard)/integrations/page.tsx
 * PURPOSE: Third-Party Integrations Management Page
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  CheckCircle,
  Circle,
  ExternalLink,
  Settings,
  Zap,
  ShoppingCart,
  CreditCard,
  Users,
  Mail,
  Webhook,
  Database,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isConnected: boolean;
  isPopular: boolean;
}

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const integrations: Integration[] = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync orders and send automated order updates via WhatsApp',
      category: 'ecommerce',
      icon: '🛍️',
      isConnected: false,
      isPopular: true,
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'Connect your WooCommerce store for order notifications',
      category: 'ecommerce',
      icon: '🛒',
      isConnected: false,
      isPopular: true,
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Send payment confirmations and receipts automatically',
      category: 'payments',
      icon: '💳',
      isConnected: true,
      isPopular: true,
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment notifications and invoice delivery',
      category: 'payments',
      icon: '💰',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts and trigger WhatsApp from HubSpot workflows',
      category: 'crm',
      icon: '🔶',
      isConnected: false,
      isPopular: true,
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Two-way sync with Salesforce CRM',
      category: 'crm',
      icon: '☁️',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'zoho',
      name: 'Zoho CRM',
      description: 'Connect Zoho CRM for contact sync and automation',
      category: 'crm',
      icon: '📊',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'freshdesk',
      name: 'Freshdesk',
      description: 'Create tickets from WhatsApp conversations',
      category: 'support',
      icon: '🎫',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'zendesk',
      name: 'Zendesk',
      description: 'Integrate support tickets with WhatsApp',
      category: 'support',
      icon: '🎯',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect with 5000+ apps via Zapier automation',
      category: 'automation',
      icon: '⚡',
      isConnected: true,
      isPopular: true,
    },
    {
      id: 'make',
      name: 'Make (Integromat)',
      description: 'Advanced automation workflows with Make',
      category: 'automation',
      icon: '🔄',
      isConnected: false,
      isPopular: false,
    },
    {
      id: 'google_sheets',
      name: 'Google Sheets',
      description: 'Export contacts and messages to Google Sheets',
      category: 'productivity',
      icon: '📗',
      isConnected: false,
      isPopular: true,
    },
    {
      id: 'webhook',
      name: 'Custom Webhook',
      description: 'Send data to any URL via webhooks',
      category: 'developer',
      icon: '🔗',
      isConnected: true,
      isPopular: false,
    },
    {
      id: 'api',
      name: 'REST API',
      description: 'Full API access for custom integrations',
      category: 'developer',
      icon: '🔌',
      isConnected: true,
      isPopular: false,
    },
  ];

  const categories = [
    { id: 'all', name: 'All', icon: Database },
    { id: 'ecommerce', name: 'E-Commerce', icon: ShoppingCart },
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'crm', name: 'CRM', icon: Users },
    { id: 'support', name: 'Support', icon: Mail },
    { id: 'automation', name: 'Automation', icon: Zap },
    { id: 'developer', name: 'Developer', icon: Webhook },
  ];

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const connectedCount = integrations.filter(i => i.isConnected).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">Connect your favorite apps with Interface</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{connectedCount}</p>
                <p className="text-sm text-gray-500">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{integrations.length}</p>
                <p className="text-sm text-gray-500">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">1,234</p>
                <p className="text-sm text-gray-500">Events Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={selectedCategory === category.id ? 'bg-[#25D366] hover:bg-[#128C7E]' : ''}
              >
                <Icon className="h-4 w-4 mr-1" />
                {category.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.map((integration) => (
          <Card key={integration.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{integration.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {integration.name}
                      {integration.isPopular && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
                {integration.isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">{integration.description}</p>
              <div className="flex gap-2">
                {integration.isConnected ? (
                  <>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="flex-1 bg-[#25D366] hover:bg-[#128C7E]">
                    Connect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
