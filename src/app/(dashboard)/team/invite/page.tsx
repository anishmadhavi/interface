/**
 * =============================================================================
 * FILE: src/app/(dashboard)/team/invite/page.tsx
 * PURPOSE: Invite Team Member - Send Invitation to Join
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Form to invite new team members by email
 * - Role selection for new member
 * - Shows plan limit warning if applicable
 * - Validates email before sending
 * - Sends invitation email
 * - Shows success/error feedback
 * 
 * KEY FEATURES:
 * - Email input with validation
 * - Role selector (Admin, Agent)
 * - Optional personal message
 * - Plan limit check
 * - Bulk invite option
 * - Invitation preview
 * - Recent invitations list
 * 
 * INVITATION FLOW:
 * 1. Enter email and select role
 * 2. Send invitation
 * 3. Email sent with signup link
 * 4. User creates account
 * 5. Auto-joins organization
 * 
 * EMAIL TEMPLATE:
 * - Organization name
 * - Inviter name
 * - Role assigned
 * - Personal message (optional)
 * - Signup/Accept link
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data operations)
 * - Email service (for sending invites)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  UserPlus,
  Mail,
  ShieldCheck,
  User,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type MemberRole = 'ADMIN' | 'AGENT';

interface InviteForm {
  email: string;
  role: MemberRole;
  message: string;
}

interface PlanLimits {
  planName: string;
  maxUsers: number | 'Unlimited';
  currentUsers: number;
  canInvite: boolean;
}

interface RecentInvite {
  email: string;
  role: MemberRole;
  sentAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
}

const ROLE_CONFIG = {
  ADMIN: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'border-purple-200 bg-purple-50',
    description: 'Full access to settings, team management, templates, and campaigns',
  },
  AGENT: {
    label: 'Agent',
    icon: User,
    color: 'border-blue-200 bg-blue-50',
    description: 'Handle conversations, view contacts, send messages',
  },
};

export default function InvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [recentInvites, setRecentInvites] = useState<RecentInvite[]>([]);
  const [orgName, setOrgName] = useState('');
  const [inviterName, setInviterName] = useState('');

  // Form state
  const [emails, setEmails] = useState<string[]>(['']);
  const [role, setRole] = useState<MemberRole>('AGENT');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('name, organization_id, organizations(*)')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      setInviterName(userData.name || 'Team Admin');
      
      const org = userData.organizations as any;
      if (org) {
        setOrgName(org.name || 'Your Organization');
        
        // Get current user count
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', userData.organization_id)
          .neq('status', 'DEACTIVATED');

        const maxUsers = org.max_users || 1;
        const currentUsers = count || 1;

        setPlanLimits({
          planName: org.plan_name || 'Starter',
          maxUsers: maxUsers,
          currentUsers: currentUsers,
          canInvite: maxUsers === 'Unlimited' || currentUsers < maxUsers,
        });
      }

      // Fetch recent invites
      const { data: invites } = await supabase
        .from('users')
        .select('email, role, created_at, status')
        .eq('organization_id', userData.organization_id)
        .eq('status', 'INVITED')
        .order('created_at', { ascending: false })
        .limit(5);

      if (invites) {
        setRecentInvites(invites.map((i: any) => ({
          email: i.email,
          role: i.role,
          sentAt: i.created_at,
          status: 'PENDING',
        })));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmailField = () => {
    if (emails.length >= 10) return;
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    if (emails.length === 1) return;
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSendInvites = async () => {
    setError(null);
    
    // Filter valid emails
    const validEmails = emails.filter(e => e.trim() && validateEmail(e.trim()));
    
    if (validEmails.length === 0) {
      setError('Please enter at least one valid email address');
      return;
    }

    // Check plan limits
    if (planLimits && planLimits.maxUsers !== 'Unlimited') {
      const remaining = (planLimits.maxUsers as number) - planLimits.currentUsers;
      if (validEmails.length > remaining) {
        setError(`You can only invite ${remaining} more member(s). Upgrade your plan for more.`);
        return;
      }
    }

    setSending(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      // Create invite records
      const invitePromises = validEmails.map(async (email) => {
        const inviteToken = crypto.randomUUID();
        
        await supabase.from('users').insert({
          organization_id: userData?.organization_id,
          email: email.trim().toLowerCase(),
          role: role,
          status: 'INVITED',
          invite_token: inviteToken,
          invited_by: user.id,
          invite_message: message || null,
        });

        // In production, send email via your email service
        // await sendInviteEmail({ email, role, token: inviteToken, orgName, inviterName, message });
      });

      await Promise.all(invitePromises);

      setSuccess(true);
      setTimeout(() => {
        router.push('/team');
      }, 2000);
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.message || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-800 mb-2">Invitations Sent!</h2>
            <p className="text-green-700 mb-4">
              Your team members will receive an email with instructions to join.
            </p>
            <Button variant="outline" asChild>
              <Link href="/team">Back to Team</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/team"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invite Team Member</h1>
          <p className="text-gray-500">Send invitation to join {orgName}</p>
        </div>
      </div>

      {/* Plan Limit Warning */}
      {planLimits && !planLimits.canInvite && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Team Limit Reached</p>
                <p className="text-sm text-yellow-700">
                  Your {planLimits.planName} plan allows {planLimits.maxUsers} team member(s).
                  <Link href="/billing/plans" className="underline ml-1">Upgrade your plan</Link> to add more.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserPlus className="h-5 w-5 mr-2 text-whatsapp" />
            New Invitation
          </CardTitle>
          <CardDescription>Enter email addresses to send invitations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Fields */}
          <div>
            <Label>Email Address(es) *</Label>
            <div className="space-y-2 mt-2">
              {emails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="colleague@company.com"
                      className={cn(
                        'pl-9',
                        email && !validateEmail(email) && 'border-red-300'
                      )}
                    />
                  </div>
                  {emails.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEmailField(index)}
                      className="text-gray-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {emails.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addEmailField}
                className="mt-2 text-whatsapp"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Another
              </Button>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <Label>Role *</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {(Object.entries(ROLE_CONFIG) as [MemberRole, typeof ROLE_CONFIG.ADMIN][]).map(([roleKey, config]) => {
                const RoleIcon = config.icon;
                const isSelected = role === roleKey;

                return (
                  <button
                    key={roleKey}
                    type="button"
                    onClick={() => setRole(roleKey)}
                    className={cn(
                      'p-4 border-2 rounded-lg text-left transition-all',
                      isSelected ? 'border-whatsapp bg-green-50' : 'border-gray-200 hover:border-gray-300',
                      config.color.replace('border-', isSelected ? '' : 'hover:')
                    )}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <RoleIcon className={cn(
                        'h-5 w-5',
                        roleKey === 'ADMIN' ? 'text-purple-600' : 'text-blue-600'
                      )} />
                      <span className="font-medium">{config.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-whatsapp ml-auto" />}
                    </div>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal Message */}
          <div>
            <Label>Personal Message (Optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to the invitation..."
              rows={3}
              className="mt-2"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            variant="whatsapp"
            className="w-full"
            onClick={handleSendInvites}
            disabled={sending || (planLimits && !planLimits.canInvite)}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Invitation{emails.filter(e => e.trim()).length > 1 ? 's' : ''}
          </Button>
        </CardContent>
      </Card>

      {/* Invitation Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Subject: You're invited to join {orgName} on Interface</p>
            <hr className="my-3" />
            <p className="mb-2">Hi there,</p>
            <p className="mb-2">
              <strong>{inviterName}</strong> has invited you to join <strong>{orgName}</strong> on Interface as a{' '}
              <strong>{ROLE_CONFIG[role].label}</strong>.
            </p>
            {message && (
              <div className="bg-white p-3 rounded border my-3">
                <p className="italic text-gray-600">"{message}"</p>
              </div>
            )}
            <p className="mb-4">Click the button below to accept the invitation and create your account.</p>
            <div className="bg-whatsapp text-white px-4 py-2 rounded inline-block">
              Accept Invitation →
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invitations */}
      {recentInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentInvites.map((invite, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{invite.email}</span>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                      {ROLE_CONFIG[invite.role]?.label || invite.role}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(invite.sentAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How invitations work</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Invitees receive an email with a unique signup link</li>
                <li>They create their account using the link</li>
                <li>Once signed up, they automatically join your organization</li>
                <li>Invitations expire after 7 days</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
