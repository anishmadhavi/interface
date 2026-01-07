/**
 * =============================================================================
 * FILE: src/app/(dashboard)/team/page.tsx
 * PURPOSE: Team Members - List & Management
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all team members in organization
 * - Shows member roles and permissions
 * - Allows changing member roles
 * - Remove/deactivate members
 * - Shows member activity status
 * - Pending invitations list
 * - Team usage stats
 * 
 * KEY FEATURES:
 * - Member list with avatar, name, email
 * - Role badges (Owner, Admin, Agent)
 * - Status indicator (Online, Offline, Away)
 * - Change role dropdown
 * - Remove member with confirmation
 * - Resend invitation
 * - Cancel pending invite
 * - Search and filter members
 * 
 * ROLES & PERMISSIONS:
 * - Owner: Full access, billing, delete org
 * - Admin: Manage team, settings, all features
 * - Agent: Inbox, contacts, campaigns (limited)
 * 
 * PLAN LIMITS:
 * - Starter: 1 user
 * - Growth: 5 users
 * - Business: Unlimited users
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  User,
  Mail,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Crown
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type MemberRole = 'OWNER' | 'ADMIN' | 'AGENT';
type MemberStatus = 'ACTIVE' | 'INVITED' | 'DEACTIVATED';
type OnlineStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: MemberRole;
  status: MemberStatus;
  onlineStatus: OnlineStatus;
  lastActive?: string;
  joinedAt: string;
  conversationsHandled?: number;
}

interface PlanLimits {
  planName: string;
  maxUsers: number | 'Unlimited';
  currentUsers: number;
}

const ROLE_CONFIG = {
  OWNER: { label: 'Owner', icon: Crown, color: 'bg-yellow-100 text-yellow-800' },
  ADMIN: { label: 'Admin', icon: ShieldCheck, color: 'bg-purple-100 text-purple-800' },
  AGENT: { label: 'Agent', icon: User, color: 'bg-blue-100 text-blue-800' },
};

const ONLINE_STATUS_CONFIG = {
  ONLINE: { label: 'Online', color: 'bg-green-500' },
  AWAY: { label: 'Away', color: 'bg-yellow-500' },
  OFFLINE: { label: 'Offline', color: 'bg-gray-400' },
};

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamMember[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const fetchTeam = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;
      setCurrentUserId(userData.id);

      // Fetch team members
      const { data: teamData } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('role', { ascending: true });

      if (teamData) {
        const active: TeamMember[] = [];
        const pending: TeamMember[] = [];

        teamData.forEach((m: any) => {
          const member: TeamMember = {
            id: m.id,
            name: m.name || 'Unnamed User',
            email: m.email,
            avatar: m.avatar_url,
            role: m.role || 'AGENT',
            status: m.status || 'ACTIVE',
            onlineStatus: m.online_status || 'OFFLINE',
            lastActive: m.last_active_at,
            joinedAt: m.created_at,
            conversationsHandled: m.conversations_handled || 0,
          };

          if (m.status === 'INVITED') {
            pending.push(member);
          } else {
            active.push(member);
          }
        });

        setMembers(active);
        setPendingInvites(pending);
      }

      // Fetch plan limits
      const { data: org } = await supabase
        .from('organizations')
        .select('plan_name, max_users')
        .eq('id', userData.organization_id)
        .single();

      if (org) {
        setPlanLimits({
          planName: org.plan_name || 'Starter',
          maxUsers: org.max_users || 1,
          currentUsers: (teamData?.filter((m: any) => m.status !== 'INVITED').length) || 1,
        });
      }

      setLoading(false);
    };

    fetchTeam();
  }, []);

  const handleChangeRole = async (memberId: string, newRole: MemberRole) => {
    const supabase = createClient();
    await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', memberId);

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    setActionMenuId(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    const supabase = createClient();
    await supabase
      .from('users')
      .update({ status: 'DEACTIVATED' })
      .eq('id', memberId);

    setMembers(prev => prev.filter(m => m.id !== memberId));
    setActionMenuId(null);
  };

  const handleResendInvite = async (memberId: string) => {
    // In production, trigger email resend
    alert('Invitation resent successfully!');
  };

  const handleCancelInvite = async (memberId: string) => {
    if (!confirm('Cancel this invitation?')) return;

    const supabase = createClient();
    await supabase
      .from('users')
      .delete()
      .eq('id', memberId);

    setPendingInvites(prev => prev.filter(m => m.id !== memberId));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatLastActive = (dateString?: string) => {
    if (!dateString) return 'Never';
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return formatDate(dateString);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canAddMore = () => {
    if (!planLimits) return false;
    if (planLimits.maxUsers === 'Unlimited') return true;
    return planLimits.currentUsers < planLimits.maxUsers;
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
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500">Manage your team members and roles</p>
        </div>
        <Button variant="whatsapp" asChild disabled={!canAddMore()}>
          <Link href="/team/invite">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Link>
        </Button>
      </div>

      {/* Plan Limits */}
      {planLimits && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Users className="h-8 w-8 text-whatsapp" />
                <div>
                  <p className="font-medium">Team Capacity</p>
                  <p className="text-sm text-gray-500">{planLimits.planName} Plan</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {planLimits.currentUsers} / {planLimits.maxUsers === 'Unlimited' ? '∞' : planLimits.maxUsers}
                </p>
                <p className="text-sm text-gray-500">members</p>
              </div>
            </div>
            {planLimits.maxUsers !== 'Unlimited' && planLimits.currentUsers >= (planLimits.maxUsers as number) && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  You've reached your team limit. <Link href="/billing/plans" className="underline font-medium">Upgrade your plan</Link> to add more members.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No members found</p>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => {
                const roleConfig = ROLE_CONFIG[member.role];
                const RoleIcon = roleConfig.icon;
                const onlineConfig = ONLINE_STATUS_CONFIG[member.onlineStatus];
                const isCurrentUser = member.id === currentUserId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-medium text-gray-600">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white',
                          onlineConfig.color
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{member.name}</p>
                          {isCurrentUser && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">You</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                          <span>{onlineConfig.label}</span>
                          <span>•</span>
                          <span>Last active: {formatLastActive(member.lastActive)}</span>
                          {member.conversationsHandled !== undefined && (
                            <>
                              <span>•</span>
                              <span>{member.conversationsHandled} conversations</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        'flex items-center px-2 py-1 rounded text-xs font-medium',
                        roleConfig.color
                      )}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConfig.label}
                      </span>

                      {member.role !== 'OWNER' && !isCurrentUser && (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActionMenuId(actionMenuId === member.id ? null : member.id)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>

                          {actionMenuId === member.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                              <div className="p-1">
                                <p className="px-3 py-2 text-xs text-gray-500 font-medium">Change Role</p>
                                {(['ADMIN', 'AGENT'] as MemberRole[]).map((role) => (
                                  <button
                                    key={role}
                                    onClick={() => handleChangeRole(member.id, role)}
                                    className={cn(
                                      'w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 flex items-center justify-between',
                                      member.role === role && 'bg-gray-50'
                                    )}
                                  >
                                    {ROLE_CONFIG[role].label}
                                    {member.role === role && <CheckCircle2 className="h-4 w-4 text-whatsapp" />}
                                  </button>
                                ))}
                                <hr className="my-1" />
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 rounded hover:bg-red-50 flex items-center"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Member
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-yellow-500" />
              Pending Invitations ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvites.map((invite) => {
                const roleConfig = ROLE_CONFIG[invite.role];

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 border border-dashed rounded-lg bg-yellow-50/50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-sm text-gray-500">
                          Invited {formatDate(invite.joinedAt)} • {roleConfig.label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvite(invite.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvite(invite.id)}
                        className="text-red-600"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>What each role can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-600" />
                <p className="font-medium">Owner</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Full access to all features</li>
                <li>• Manage billing & subscription</li>
                <li>• Delete organization</li>
                <li>• Transfer ownership</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <p className="font-medium">Admin</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Manage team members</li>
                <li>• Access all settings</li>
                <li>• Create templates & campaigns</li>
                <li>• View all conversations</li>
              </ul>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-5 w-5 text-blue-600" />
                <p className="font-medium">Agent</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Handle assigned conversations</li>
                <li>• View contacts</li>
                <li>• Send messages</li>
                <li>• Limited campaign access</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
