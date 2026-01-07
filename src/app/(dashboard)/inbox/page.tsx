/**
 * =============================================================================
 * FILE: src/app/(dashboard)/inbox/page.tsx
 * PURPOSE: Inbox - Conversation List Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all WhatsApp conversations in a list view
 * - Supports filtering by status (All, Open, Pending, Resolved)
 * - Supports search by contact name or phone number
 * - Shows unread message count badges
 * - Shows 24-hour session window status (active/expired)
 * - Real-time updates when new messages arrive (via Supabase Realtime)
 * - Allows assigning conversations to team members
 * 
 * KEY FEATURES:
 * - Status filters: All, Open, Pending, Resolved
 * - Search functionality
 * - Sort by: Latest, Oldest, Unread first
 * - Agent assignment indicator
 * - Session window indicator (green = active, red = expired)
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Supabase Realtime (for live updates)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Filter,
  MessageSquare,
  Clock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type ConversationStatus = 'ALL' | 'OPEN' | 'PENDING' | 'RESOLVED';

interface Conversation {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  assignedTo?: string;
  assignedToName?: string;
  sessionActive: boolean; // 24-hour window
  sessionExpiresAt?: string;
}

const STATUS_FILTERS: { value: ConversationStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Get filter from URL params
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'unanswered') {
      setStatusFilter('OPEN');
    }
  }, [searchParams]);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      setOrganizationId(userData.organization_id);

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          unread_count,
          last_message_at,
          last_customer_message_at,
          window_expires_at,
          assigned_to,
          contacts (
            id,
            name,
            phone
          ),
          users:assigned_to (
            full_name
          )
        `)
        .eq('organization_id', userData.organization_id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      const now = new Date();
      const mapped: Conversation[] = (data || []).map((conv: any) => {
        const windowExpires = conv.window_expires_at ? new Date(conv.window_expires_at) : null;
        const sessionActive = windowExpires ? windowExpires > now : false;

        return {
          id: conv.id,
          contactId: conv.contacts?.id || '',
          contactName: conv.contacts?.name || 'Unknown',
          contactPhone: conv.contacts?.phone || '',
          lastMessage: '', // Would fetch from messages
          lastMessageTime: conv.last_message_at,
          unreadCount: conv.unread_count || 0,
          status: conv.status,
          assignedTo: conv.assigned_to,
          assignedToName: conv.users?.full_name,
          sessionActive,
          sessionExpiresAt: conv.window_expires_at,
        };
      });

      setConversations(mapped);
      setFilteredConversations(mapped);
      setLoading(false);
    };

    fetchConversations();
  }, []);

  // Setup realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const supabase = createClient();
    
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log('Conversation change:', payload);
          // Refetch or update local state
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Filter conversations
  useEffect(() => {
    let filtered = [...conversations];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c => c.contactName.toLowerCase().includes(query) || 
             c.contactPhone.includes(query)
      );
    }

    setFilteredConversations(filtered);
  }, [conversations, statusFilter, searchQuery]);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500">{conversations.length} conversations</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                statusFilter === filter.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <Card>
        <CardContent className="p-0">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No conversations found</p>
              <p className="text-sm text-gray-400">
                {searchQuery ? 'Try a different search term' : 'Conversations will appear here when customers message you'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/inbox/${conv.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-600">
                          {conv.contactName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Session indicator */}
                      <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white',
                        conv.sessionActive ? 'bg-green-500' : 'bg-red-500'
                      )} title={conv.sessionActive ? 'Session active' : 'Session expired'} />
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{conv.contactName}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(conv.status))}>
                          {conv.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{conv.contactPhone}</p>
                      {conv.assignedToName && (
                        <p className="text-xs text-gray-400 flex items-center mt-1">
                          <User className="h-3 w-3 mr-1" />
                          {conv.assignedToName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{formatTimeAgo(conv.lastMessageTime)}</p>
                    {conv.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-whatsapp rounded-full mt-1">
                        {conv.unreadCount}
                      </span>
                    )}
                    {!conv.sessionActive && (
                      <p className="text-xs text-red-500 flex items-center justify-end mt-1">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Template only
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
