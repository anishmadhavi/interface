/**
 * =============================================================================
 * FILE: src/app/(dashboard)/automations/page.tsx
 * PURPOSE: Automation Rules Management Page
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Zap,
  Plus,
  Search,
  MessageSquare,
  Clock,
  Tag,
  Users,
  ToggleLeft,
  ToggleRight,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  isActive: boolean;
  executionCount: number;
  lastTriggered: string | null;
}

export default function AutomationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [automations, setAutomations] = useState<Automation[]>([
    {
      id: '1',
      name: 'Welcome Message',
      description: 'Send welcome message to new contacts',
      trigger: 'New Contact Added',
      actions: ['Send Template Message'],
      isActive: true,
      executionCount: 156,
      lastTriggered: '2 hours ago',
    },
    {
      id: '2',
      name: 'Away Message',
      description: 'Auto-reply outside business hours',
      trigger: 'Message Received (Outside Hours)',
      actions: ['Send Text Message'],
      isActive: true,
      executionCount: 89,
      lastTriggered: '30 minutes ago',
    },
    {
      id: '3',
      name: 'Order Confirmation',
      description: 'Send confirmation when order is placed',
      trigger: 'Webhook: Shopify Order Created',
      actions: ['Send Template Message', 'Add Tag'],
      isActive: false,
      executionCount: 0,
      lastTriggered: null,
    },
  ]);

  const toggleAutomation = (id: string) => {
    setAutomations(automations.map(a => 
      a.id === id ? { ...a, isActive: !a.isActive } : a
    ));
  };

  const triggerIcons: Record<string, any> = {
    'New Contact Added': Users,
    'Message Received (Outside Hours)': Clock,
    'Webhook: Shopify Order Created': Tag,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-600">Create automated workflows to save time</p>
        </div>
        <Button className="bg-[#25D366] hover:bg-[#128C7E]">
          <Plus className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{automations.filter(a => a.isActive).length}</p>
                <p className="text-sm text-gray-500">Active Automations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {automations.reduce((sum, a) => sum + a.executionCount, 0)}
                </p>
                <p className="text-sm text-gray-500">Total Executions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">~2.5h</p>
                <p className="text-sm text-gray-500">Time Saved Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search automations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {automations
          .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((automation) => {
            const TriggerIcon = triggerIcons[automation.trigger] || Zap;
            return (
              <Card key={automation.id} className={!automation.isActive ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${automation.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <TriggerIcon className={`h-6 w-6 ${automation.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{automation.name}</h3>
                        <p className="text-sm text-gray-500">{automation.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>Trigger: {automation.trigger}</span>
                          <span>•</span>
                          <span>{automation.actions.length} action(s)</span>
                          {automation.lastTriggered && (
                            <>
                              <span>•</span>
                              <span>Last run: {automation.lastTriggered}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {automation.executionCount} runs
                      </span>
                      <button
                        onClick={() => toggleAutomation(automation.id)}
                        className="p-1"
                      >
                        {automation.isActive ? (
                          <ToggleRight className="h-8 w-8 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-8 w-8 text-gray-300" />
                        )}
                      </button>
                      <div className="relative group">
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Empty State */}
      {automations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No automations yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first automation to save time on repetitive tasks
            </p>
            <Button className="bg-[#25D366] hover:bg-[#128C7E]">
              <Plus className="h-4 w-4 mr-2" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
