/**
 * =============================================================================
 * FILE: src/app/(dashboard)/workflows/page.tsx
 * PURPOSE: Drip Workflows List Page - Automation Sequences
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all automation workflows (drip campaigns)
 * - Shows workflow status (Active, Paused, Draft)
 * - Shows trigger type and action count
 * - Displays contacts currently in each workflow
 * - Provides quick toggle to activate/deactivate
 * - Links to visual editor for creating/editing
 * 
 * KEY FEATURES:
 * - Workflow status badges
 * - Trigger type display (tag added, form submitted, etc.)
 * - Active contacts count (people currently in workflow)
 * - Completion stats
 * - Quick pause/resume toggle
 * - Duplicate workflow
 * - Delete workflow
 * 
 * WORKFLOW TYPES:
 * - Drip sequence: Send messages over time
 * - Welcome series: New contact onboarding
 * - Re-engagement: Win back inactive contacts
 * - Order follow-up: Post-purchase sequences
 * 
 * TRIGGERS:
 * - Tag added
 * - Contact created
 * - Form submitted
 * - Keyword received
 * - Manual enrollment
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Plus,
  Play,
  Pause,
  GitBranch,
  Users,
  Clock,
  CheckCircle2,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  Zap,
  Tag,
  MessageSquare,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type WorkflowStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';
type TriggerType = 'TAG_ADDED' | 'CONTACT_CREATED' | 'KEYWORD_RECEIVED' | 'FORM_SUBMITTED' | 'MANUAL';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  triggerType: TriggerType;
  triggerValue?: string;
  stepsCount: number;
  activeContacts: number;
  completedContacts: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: Play },
  PAUSED: { label: 'Paused', color: 'bg-yellow-100 text-yellow-700', icon: Pause },
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit },
};

const TRIGGER_CONFIG = {
  TAG_ADDED: { label: 'Tag Added', icon: Tag },
  CONTACT_CREATED: { label: 'Contact Created', icon: Users },
  KEYWORD_RECEIVED: { label: 'Keyword Received', icon: MessageSquare },
  FORM_SUBMITTED: { label: 'Form Submitted', icon: CheckCircle2 },
  MANUAL: { label: 'Manual Enrollment', icon: Zap },
};

export default function WorkflowsPage() {
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState<Workflow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'ALL'>('ALL');
  const [showActions, setShowActions] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflows = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setWorkflows(data.map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          status: w.status,
          triggerType: w.trigger_type,
          triggerValue: w.trigger_value,
          stepsCount: w.steps?.length || 0,
          activeContacts: w.active_contacts || 0,
          completedContacts: w.completed_contacts || 0,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
        })));
      }

      setLoading(false);
    };

    fetchWorkflows();
  }, []);

  useEffect(() => {
    let filtered = [...workflows];

    if (searchQuery) {
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(w => w.status === statusFilter);
    }

    setFilteredWorkflows(filtered);
  }, [workflows, searchQuery, statusFilter]);

  const handleToggleStatus = async (workflowId: string, currentStatus: WorkflowStatus) => {
    if (currentStatus === 'DRAFT') return;

    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const supabase = createClient();
    await supabase
      .from('workflows')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', workflowId);

    setWorkflows(prev =>
      prev.map(w => (w.id === workflowId ? { ...w, status: newStatus } : w))
    );
  };

  const handleDuplicate = async (workflow: Workflow) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        organization_id: userData?.organization_id,
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        status: 'DRAFT',
        trigger_type: workflow.triggerType,
        trigger_value: workflow.triggerValue,
        steps: [],
      })
      .select()
      .single();

    if (data) {
      setWorkflows(prev => [{
        ...workflow,
        id: data.id,
        name: data.name,
        status: 'DRAFT',
        activeContacts: 0,
        completedContacts: 0,
      }, ...prev]);
    }
    setShowActions(null);
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This will also remove all contacts from it.')) {
      return;
    }

    const supabase = createClient();
    await supabase.from('workflows').delete().eq('id', workflowId);
    setWorkflows(prev => prev.filter(w => w.id !== workflowId));
    setShowActions(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate stats
  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === 'ACTIVE').length,
    totalContacts: workflows.reduce((sum, w) => sum + w.activeContacts, 0),
    completed: workflows.reduce((sum, w) => sum + w.completedContacts, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-500">Automate message sequences and drip campaigns</p>
        </div>
        <Button variant="whatsapp" asChild>
          <Link href="/workflows/editor">
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Workflows</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <GitBranch className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Play className="h-8 w-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Contacts in Workflows</p>
                <p className="text-2xl font-bold">{stats.totalContacts}</p>
              </div>
              <Users className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-gray-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {(['ALL', 'ACTIVE', 'PAUSED', 'DRAFT'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusFilter === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows List */}
      {filteredWorkflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No workflows found</p>
            <p className="text-sm text-gray-400">Create your first automation workflow</p>
            <Button variant="whatsapp" className="mt-4" asChild>
              <Link href="/workflows/editor">
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredWorkflows.map((workflow) => {
            const StatusIcon = STATUS_CONFIG[workflow.status].icon;
            const TriggerIcon = TRIGGER_CONFIG[workflow.triggerType].icon;

            return (
              <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Link
                          href={`/workflows/${workflow.id}`}
                          className="font-medium text-gray-900 hover:text-whatsapp"
                        >
                          {workflow.name}
                        </Link>
                        <span className={cn(
                          'inline-flex items-center text-xs px-2 py-0.5 rounded-full',
                          STATUS_CONFIG[workflow.status].color
                        )}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {STATUS_CONFIG[workflow.status].label}
                        </span>
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center">
                          <TriggerIcon className="h-4 w-4 mr-1" />
                          {TRIGGER_CONFIG[workflow.triggerType].label}
                          {workflow.triggerValue && `: ${workflow.triggerValue}`}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {workflow.stepsCount} steps
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center space-x-8 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{workflow.activeContacts}</p>
                        <p className="text-xs text-gray-500">In Progress</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-green-600">{workflow.completedContacts}</p>
                        <p className="text-xs text-gray-500">Completed</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {workflow.status !== 'DRAFT' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(workflow.id, workflow.status)}
                        >
                          {workflow.status === 'ACTIVE' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowActions(showActions === workflow.id ? null : workflow.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>

                        {showActions === workflow.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border z-10">
                            <Link
                              href={`/workflows/${workflow.id}`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDuplicate(workflow)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </button>
                            <button
                              onClick={() => handleDelete(workflow.id)}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
