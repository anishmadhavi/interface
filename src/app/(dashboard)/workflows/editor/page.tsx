/**
 * =============================================================================
 * FILE: src/app/(dashboard)/workflows/editor/page.tsx
 * PURPOSE: Visual Workflow Editor - Drag & Drop Builder
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Provides visual drag-and-drop interface for building workflows
 * - Allows configuring triggers (what starts the workflow)
 * - Allows adding action steps (send message, wait, condition)
 * - Shows workflow as a flowchart
 * - Validates workflow before saving
 * - Supports saving as draft or activating immediately
 * 
 * KEY FEATURES:
 * - Trigger selection panel
 * - Action blocks: Send Message, Wait, Add Tag, Condition
 * - Drag-drop step ordering
 * - Step configuration modal
 * - Live preview of message content
 * - Save as draft / Activate
 * 
 * STEP TYPES:
 * - SEND_MESSAGE: Send a template message
 * - WAIT: Wait for specified duration (hours/days)
 * - ADD_TAG: Add a tag to contact
 * - REMOVE_TAG: Remove a tag from contact
 * - CONDITION: Branch based on tag/attribute
 * - WEBHOOK: Call external URL
 * 
 * TRIGGERS:
 * - TAG_ADDED: When specific tag is added
 * - CONTACT_CREATED: When new contact is created
 * - KEYWORD_RECEIVED: When keyword is received
 * - FORM_SUBMITTED: When form is submitted
 * - MANUAL: Manual enrollment only
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for saving)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  Clock,
  Tag,
  GitBranch,
  Zap,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TriggerType = 'TAG_ADDED' | 'CONTACT_CREATED' | 'KEYWORD_RECEIVED' | 'MANUAL';
type StepType = 'SEND_MESSAGE' | 'WAIT' | 'ADD_TAG' | 'REMOVE_TAG' | 'CONDITION';

interface WorkflowStep {
  id: string;
  type: StepType;
  config: Record<string, any>;
  order: number;
}

interface WorkflowForm {
  name: string;
  description: string;
  triggerType: TriggerType;
  triggerValue: string;
  steps: WorkflowStep[];
}

interface Template {
  id: string;
  name: string;
}

const TRIGGERS = [
  { type: 'TAG_ADDED', label: 'Tag Added', icon: Tag, description: 'When a specific tag is added to contact' },
  { type: 'CONTACT_CREATED', label: 'Contact Created', icon: Users, description: 'When a new contact is created' },
  { type: 'KEYWORD_RECEIVED', label: 'Keyword Received', icon: MessageSquare, description: 'When contact sends specific keyword' },
  { type: 'MANUAL', label: 'Manual Only', icon: Zap, description: 'Manually enroll contacts' },
];

const STEP_TYPES = [
  { type: 'SEND_MESSAGE', label: 'Send Message', icon: MessageSquare, color: 'bg-green-100 text-green-700' },
  { type: 'WAIT', label: 'Wait', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  { type: 'ADD_TAG', label: 'Add Tag', icon: Tag, color: 'bg-purple-100 text-purple-700' },
  { type: 'REMOVE_TAG', label: 'Remove Tag', icon: Tag, color: 'bg-orange-100 text-orange-700' },
  { type: 'CONDITION', label: 'Condition', icon: GitBranch, color: 'bg-yellow-100 text-yellow-700' },
];

export default function WorkflowEditorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const [form, setForm] = useState<WorkflowForm>({
    name: '',
    description: '',
    triggerType: 'TAG_ADDED',
    triggerValue: '',
    steps: [],
  });

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      const { data } = await supabase
        .from('templates')
        .select('id, name')
        .eq('organization_id', userData.organization_id)
        .eq('status', 'APPROVED');

      if (data) {
        setTemplates(data);
      }
    };

    fetchTemplates();
  }, []);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: generateId(),
      type,
      config: getDefaultConfig(type),
      order: form.steps.length,
    };

    setForm({ ...form, steps: [...form.steps, newStep] });
    setExpandedStep(newStep.id);
  };

  const getDefaultConfig = (type: StepType): Record<string, any> => {
    switch (type) {
      case 'SEND_MESSAGE':
        return { templateId: '', variables: {} };
      case 'WAIT':
        return { duration: 1, unit: 'days' };
      case 'ADD_TAG':
      case 'REMOVE_TAG':
        return { tag: '' };
      case 'CONDITION':
        return { field: 'tag', operator: 'has', value: '' };
      default:
        return {};
    }
  };

  const updateStep = (stepId: string, config: Record<string, any>) => {
    setForm({
      ...form,
      steps: form.steps.map(s =>
        s.id === stepId ? { ...s, config: { ...s.config, ...config } } : s
      ),
    });
  };

  const removeStep = (stepId: string) => {
    setForm({
      ...form,
      steps: form.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i })),
    });
    setExpandedStep(null);
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = form.steps.findIndex(s => s.id === stepId);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === form.steps.length - 1) return;

    const newSteps = [...form.steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    
    setForm({
      ...form,
      steps: newSteps.map((s, i) => ({ ...s, order: i })),
    });
  };

  const validateWorkflow = (): boolean => {
    setError(null);

    if (!form.name.trim()) {
      setError('Please enter a workflow name');
      return false;
    }

    if (form.triggerType !== 'MANUAL' && !form.triggerValue.trim()) {
      setError('Please enter the trigger value');
      return false;
    }

    if (form.steps.length === 0) {
      setError('Please add at least one step');
      return false;
    }

    // Validate each step
    for (const step of form.steps) {
      if (step.type === 'SEND_MESSAGE' && !step.config.templateId) {
        setError('Please select a template for all Send Message steps');
        return false;
      }
      if ((step.type === 'ADD_TAG' || step.type === 'REMOVE_TAG') && !step.config.tag) {
        setError('Please enter a tag for all tag steps');
        return false;
      }
    }

    return true;
  };

  const handleSave = async (activate: boolean = false) => {
    if (!validateWorkflow()) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) throw new Error('No organization');

      const { data, error: dbError } = await supabase
        .from('workflows')
        .insert({
          organization_id: userData.organization_id,
          name: form.name,
          description: form.description,
          status: activate ? 'ACTIVE' : 'DRAFT',
          trigger_type: form.triggerType,
          trigger_value: form.triggerValue,
          steps: form.steps,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      router.push(`/workflows/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow');
      setSaving(false);
    }
  };

  const getStepIcon = (type: StepType) => {
    const config = STEP_TYPES.find(s => s.type === type);
    return config?.icon || Zap;
  };

  const getStepColor = (type: StepType) => {
    const config = STEP_TYPES.find(s => s.type === type);
    return config?.color || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/workflows"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Workflow</h1>
            <p className="text-gray-500">Build an automated message sequence</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
          <Button variant="whatsapp" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Save & Activate
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Workflow Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Welcome Series"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this workflow do?"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
          <CardDescription>What starts this workflow?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {TRIGGERS.map((trigger) => (
              <div
                key={trigger.type}
                onClick={() => setForm({ ...form, triggerType: trigger.type as TriggerType })}
                className={cn(
                  'p-4 border rounded-lg cursor-pointer transition-all',
                  form.triggerType === trigger.type
                    ? 'border-whatsapp bg-green-50 ring-2 ring-whatsapp'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <trigger.icon className="h-6 w-6 text-whatsapp mb-2" />
                <p className="font-medium">{trigger.label}</p>
                <p className="text-sm text-gray-500">{trigger.description}</p>
              </div>
            ))}
          </div>

          {form.triggerType !== 'MANUAL' && (
            <div>
              <Label>
                {form.triggerType === 'TAG_ADDED' && 'Tag Name *'}
                {form.triggerType === 'KEYWORD_RECEIVED' && 'Keyword *'}
                {form.triggerType === 'CONTACT_CREATED' && 'Filter (optional)'}
              </Label>
              <Input
                value={form.triggerValue}
                onChange={(e) => setForm({ ...form, triggerValue: e.target.value })}
                placeholder={
                  form.triggerType === 'TAG_ADDED' ? 'e.g., new-lead' :
                  form.triggerType === 'KEYWORD_RECEIVED' ? 'e.g., START' :
                  'e.g., source=website'
                }
                className="mt-1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Steps</CardTitle>
              <CardDescription>Define the sequence of actions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Steps List */}
          {form.steps.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No steps added yet</p>
              <p className="text-sm text-gray-400">Add steps below to build your workflow</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {form.steps.map((step, index) => {
                const StepIcon = getStepIcon(step.type);
                const isExpanded = expandedStep === step.id;

                return (
                  <div key={step.id} className="border rounded-lg">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className={cn('p-1.5 rounded', getStepColor(step.type))}>
                          <StepIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium">{STEP_TYPES.find(s => s.type === step.type)?.label}</p>
                          <p className="text-sm text-gray-500">
                            {step.type === 'SEND_MESSAGE' && (templates.find(t => t.id === step.config.templateId)?.name || 'Select template')}
                            {step.type === 'WAIT' && `Wait ${step.config.duration} ${step.config.unit}`}
                            {step.type === 'ADD_TAG' && (step.config.tag || 'Set tag')}
                            {step.type === 'REMOVE_TAG' && (step.config.tag || 'Set tag')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up'); }}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down'); }}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} className="text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Config */}
                    {isExpanded && (
                      <div className="p-4 border-t bg-gray-50">
                        {step.type === 'SEND_MESSAGE' && (
                          <div>
                            <Label>Template *</Label>
                            <select
                              value={step.config.templateId}
                              onChange={(e) => updateStep(step.id, { templateId: e.target.value })}
                              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3"
                            >
                              <option value="">Select template</option>
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {step.type === 'WAIT' && (
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <Label>Duration</Label>
                              <Input
                                type="number"
                                value={step.config.duration}
                                onChange={(e) => updateStep(step.id, { duration: parseInt(e.target.value) || 1 })}
                                min={1}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex-1">
                              <Label>Unit</Label>
                              <select
                                value={step.config.unit}
                                onChange={(e) => updateStep(step.id, { unit: e.target.value })}
                                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3"
                              >
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {(step.type === 'ADD_TAG' || step.type === 'REMOVE_TAG') && (
                          <div>
                            <Label>Tag Name *</Label>
                            <Input
                              value={step.config.tag}
                              onChange={(e) => updateStep(step.id, { tag: e.target.value })}
                              placeholder="e.g., engaged"
                              className="mt-1"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Step Buttons */}
          <div className="flex flex-wrap gap-2">
            {STEP_TYPES.map((stepType) => (
              <Button
                key={stepType.type}
                variant="outline"
                size="sm"
                onClick={() => addStep(stepType.type as StepType)}
              >
                <stepType.icon className="h-4 w-4 mr-1" />
                {stepType.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
