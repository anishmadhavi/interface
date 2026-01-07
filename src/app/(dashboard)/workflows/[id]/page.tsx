/**
 * =============================================================================
 * FILE: src/app/(dashboard)/workflows/[id]/page.tsx
 * PURPOSE: Workflow Detail & Edit Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays existing workflow details and steps
 * - Shows contacts currently in the workflow
 * - Shows workflow performance stats
 * - Allows editing workflow configuration
 * - Allows activating/pausing workflow
 * - Shows step-by-step progress for each contact
 * 
 * KEY FEATURES:
 * - Workflow status toggle (active/paused)
 * - Step visualization
 * - Contacts in workflow list
 * - Performance metrics (enrolled, completed, dropped)
 * - Edit mode for modifying steps
 * - Manual enrollment option
 * - Remove contacts from workflow
 * 
 * PERFORMANCE METRICS:
 * - Total enrolled
 * - Currently active
 * - Completed
 * - Dropped off (exited early)
 * - Avg completion time
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Play,
  Pause,
  Edit2,
  Save,
  X,
  Users,
  CheckCircle2,
  Clock,
  GitBranch,
  MessageSquare,
  Tag,
  Trash2,
  UserPlus,
  Loader2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type WorkflowStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT';

interface WorkflowStep {
  id: string;
  type: string;
  config: Record<string, any>;
  order: number;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  triggerType: string;
  triggerValue?: string;
  steps: WorkflowStep[];
  activeContacts: number;
  completedContacts: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowContact {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  currentStep: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'EXITED';
  enrolledAt: string;
  lastStepAt?: string;
}

const STEP_ICONS: Record<string, any> = {
  SEND_MESSAGE: MessageSquare,
  WAIT: Clock,
  ADD_TAG: Tag,
  REMOVE_TAG: Tag,
  CONDITION: GitBranch,
};

const STEP_COLORS: Record<string, string> = {
  SEND_MESSAGE: 'bg-green-100 text-green-700 border-green-200',
  WAIT: 'bg-blue-100 text-blue-700 border-blue-200',
  ADD_TAG: 'bg-purple-100 text-purple-700 border-purple-200',
  REMOVE_TAG: 'bg-orange-100 text-orange-700 border-orange-200',
  CONDITION: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [contacts, setContacts] = useState<WorkflowContact[]>([]);
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollPhone, setEnrollPhone] = useState('');

  useEffect(() => {
    const fetchWorkflow = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch workflow
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (error || !data) {
        router.push('/workflows');
        return;
      }

      setWorkflow({
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        triggerType: data.trigger_type,
        triggerValue: data.trigger_value,
        steps: data.steps || [],
        activeContacts: data.active_contacts || 0,
        completedContacts: data.completed_contacts || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
      setEditName(data.name);
      setEditDescription(data.description || '');

      // Fetch templates for step display
      const { data: templatesData } = await supabase
        .from('templates')
        .select('id, name')
        .eq('organization_id', userData.organization_id);

      if (templatesData) {
        const map: Record<string, string> = {};
        templatesData.forEach((t: any) => { map[t.id] = t.name; });
        setTemplates(map);
      }

      // Fetch contacts in workflow
      const { data: contactsData } = await supabase
        .from('workflow_enrollments')
        .select(`
          id,
          current_step,
          status,
          enrolled_at,
          last_step_at,
          contacts (id, name, phone)
        `)
        .eq('workflow_id', workflowId)
        .order('enrolled_at', { ascending: false })
        .limit(50);

      if (contactsData) {
        setContacts(contactsData.map((c: any) => ({
          id: c.id,
          contactId: c.contacts?.id || '',
          contactName: c.contacts?.name || 'Unknown',
          contactPhone: c.contacts?.phone || '',
          currentStep: c.current_step || 0,
          status: c.status,
          enrolledAt: c.enrolled_at,
          lastStepAt: c.last_step_at,
        })));
      }

      setLoading(false);
    };

    fetchWorkflow();
  }, [workflowId, router]);

  const handleToggleStatus = async () => {
    if (!workflow || workflow.status === 'DRAFT') return;

    const newStatus = workflow.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const supabase = createClient();
    await supabase
      .from('workflows')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', workflowId);

    setWorkflow({ ...workflow, status: newStatus });
  };

  const handleSave = async () => {
    if (!workflow) return;
    setSaving(true);

    const supabase = createClient();
    await supabase
      .from('workflows')
      .update({
        name: editName,
        description: editDescription,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);

    setWorkflow({ ...workflow, name: editName, description: editDescription });
    setEditMode(false);
    setSaving(false);
  };

  const handleEnroll = async () => {
    if (!enrollPhone.trim()) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_id', user.id)
      .single();

    // Find contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('organization_id', userData?.organization_id)
      .eq('phone', enrollPhone)
      .single();

    if (!contact) {
      alert('Contact not found');
      return;
    }

    // Enroll
    const { data: enrollment } = await supabase
      .from('workflow_enrollments')
      .insert({
        workflow_id: workflowId,
        contact_id: contact.id,
        current_step: 0,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (enrollment) {
      setContacts(prev => [{
        id: enrollment.id,
        contactId: contact.id,
        contactName: contact.name || 'Unknown',
        contactPhone: contact.phone,
        currentStep: 0,
        status: 'ACTIVE',
        enrolledAt: enrollment.enrolled_at,
      }, ...prev]);
    }

    setShowEnrollModal(false);
    setEnrollPhone('');
  };

  const handleRemoveContact = async (enrollmentId: string) => {
    if (!confirm('Remove this contact from the workflow?')) return;

    const supabase = createClient();
    await supabase
      .from('workflow_enrollments')
      .update({ status: 'EXITED' })
      .eq('id', enrollmentId);

    setContacts(prev =>
      prev.map(c => c.id === enrollmentId ? { ...c, status: 'EXITED' as const } : c)
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepDescription = (step: WorkflowStep): string => {
    switch (step.type) {
      case 'SEND_MESSAGE':
        return templates[step.config.templateId] || 'Send message';
      case 'WAIT':
        return `Wait ${step.config.duration} ${step.config.unit}`;
      case 'ADD_TAG':
        return `Add tag: ${step.config.tag}`;
      case 'REMOVE_TAG':
        return `Remove tag: ${step.config.tag}`;
      default:
        return step.type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!workflow) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/workflows"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            {editMode ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold h-auto py-1"
              />
            ) : (
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-900">{workflow.name}</h1>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  workflow.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                  workflow.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                )}>
                  {workflow.status}
                </span>
              </div>
            )}
            {editMode ? (
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                className="mt-1"
              />
            ) : (
              <p className="text-gray-500">{workflow.description || 'No description'}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                <X className="h-4 w-4 mr-2" />Cancel
              </Button>
              <Button variant="whatsapp" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Edit2 className="h-4 w-4 mr-2" />Edit
              </Button>
              <Button
                variant={workflow.status === 'ACTIVE' ? 'outline' : 'whatsapp'}
                onClick={handleToggleStatus}
                disabled={workflow.status === 'DRAFT'}
              >
                {workflow.status === 'ACTIVE' ? (
                  <><Pause className="h-4 w-4 mr-2" />Pause</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Activate</>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Users className="h-6 w-6 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{workflow.activeContacts}</p>
            <p className="text-sm text-gray-500">Active Contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
            <p className="text-2xl font-bold">{workflow.completedContacts}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <GitBranch className="h-6 w-6 text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{workflow.steps.length}</p>
            <p className="text-sm text-gray-500">Steps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Clock className="h-6 w-6 text-gray-400 mb-2" />
            <p className="text-2xl font-bold">{formatDate(workflow.updatedAt)}</p>
            <p className="text-sm text-gray-500">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow Steps */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Workflow Steps</CardTitle>
            <CardDescription>
              Trigger: {workflow.triggerType.replace('_', ' ')}
              {workflow.triggerValue && ` (${workflow.triggerValue})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workflow.steps.length === 0 ? (
              <p className="text-center py-4 text-gray-500">No steps configured</p>
            ) : (
              <div className="space-y-3">
                {workflow.steps.sort((a, b) => a.order - b.order).map((step, index) => {
                  const StepIcon = STEP_ICONS[step.type] || GitBranch;
                  return (
                    <div key={step.id} className="flex items-start space-x-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border',
                          STEP_COLORS[step.type]
                        )}>
                          <StepIcon className="h-4 w-4" />
                        </div>
                        {index < workflow.steps.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium text-sm">{step.type.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500">{getStepDescription(step)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full mt-4" asChild>
              <Link href={`/workflows/editor?id=${workflowId}`}>
                <Edit2 className="h-4 w-4 mr-2" />Edit Steps
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Contacts in Workflow */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contacts in Workflow</CardTitle>
                <CardDescription>People currently in or completed this workflow</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowEnrollModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Enroll
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p>No contacts enrolled yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium">{contact.contactName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{contact.contactName}</p>
                        <p className="text-sm text-gray-500">{contact.contactPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm">
                          Step {contact.currentStep + 1} of {workflow.steps.length}
                        </p>
                        <p className={cn(
                          'text-xs',
                          contact.status === 'ACTIVE' ? 'text-green-600' :
                          contact.status === 'COMPLETED' ? 'text-blue-600' :
                          contact.status === 'EXITED' ? 'text-red-600' :
                          'text-gray-500'
                        )}>
                          {contact.status}
                        </p>
                      </div>
                      {contact.status === 'ACTIVE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveContact(contact.id)}
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
      </div>

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Enroll Contact</CardTitle>
              <CardDescription>Manually add a contact to this workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={enrollPhone}
                  onChange={(e) => setEnrollPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
                <Button variant="whatsapp" onClick={handleEnroll}>Enroll</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
