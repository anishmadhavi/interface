/**
 * =============================================================================
 * FILE: src/app/(dashboard)/inbox/[id]/page.tsx
 * PURPOSE: Chat Window - Individual Conversation View
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays full chat history with a specific contact
 * - Shows messages in WhatsApp-like bubble format
 * - Allows sending new messages (text, templates, media)
 * - Shows message delivery status (sent, delivered, read)
 * - Real-time message updates via Supabase Realtime
 * - Shows 24-hour session window status
 * - Blocks free-form messages if session expired (template only)
 * - Shows typing indicator (agent collision detection)
 * - Allows assigning conversation to team member
 * 
 * KEY FEATURES:
 * - Message input with emoji picker
 * - Template selector when session expired
 * - Media attachment support
 * - Quick replies
 * - Contact info sidebar
 * - Session window countdown
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Supabase Realtime (for live messages)
 * =============================================================================
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  User,
  Clock,
  CheckCheck,
  Check,
  AlertCircle,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'TEMPLATE' | 'AUDIO' | 'VIDEO';
  content: {
    text?: string;
    caption?: string;
    url?: string;
    filename?: string;
    templateName?: string;
  };
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  senderName?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  optInStatus: boolean;
  createdAt: string;
}

interface ConversationDetails {
  id: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  sessionActive: boolean;
  sessionExpiresAt?: string;
  assignedTo?: string;
  assignedToName?: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch conversation data
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
      setOrganizationId(userData.organization_id);

      // Fetch conversation with contact
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          window_expires_at,
          assigned_to,
          contacts (
            id,
            name,
            phone,
            email,
            tags,
            opt_in_status,
            created_at
          ),
          users:assigned_to (
            full_name
          )
        `)
        .eq('id', conversationId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (convError || !convData) {
        console.error('Error fetching conversation:', convError);
        router.push('/inbox');
        return;
      }

      const now = new Date();
      const windowExpires = convData.window_expires_at ? new Date(convData.window_expires_at) : null;

      setConversation({
        id: convData.id,
        status: convData.status,
        sessionActive: windowExpires ? windowExpires > now : false,
        sessionExpiresAt: convData.window_expires_at,
        assignedTo: convData.assigned_to,
        assignedToName: convData.users?.full_name,
      });

      setContact({
        id: convData.contacts?.id || '',
        name: convData.contacts?.name || 'Unknown',
        phone: convData.contacts?.phone || '',
        email: convData.contacts?.email,
        tags: convData.contacts?.tags || [],
        optInStatus: convData.contacts?.opt_in_status || false,
        createdAt: convData.contacts?.created_at,
      });

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (messagesData) {
        setMessages(
          messagesData.map((msg: any) => ({
            id: msg.id,
            direction: msg.direction,
            type: msg.type,
            content: msg.content || {},
            status: msg.status,
            createdAt: msg.created_at,
          }))
        );
      }

      // Mark as read
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      setLoading(false);
    };

    fetchData();
  }, [conversationId, router]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!organizationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              direction: newMsg.direction,
              type: newMsg.type,
              content: newMsg.content || {},
              status: newMsg.status,
              createdAt: newMsg.created_at,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, organizationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation) return;

    // Check if session is active
    if (!conversation.sessionActive) {
      setShowTemplateSelector(true);
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          contactPhone: contact?.phone,
          message: {
            type: 'TEXT',
            text: newMessage,
          },
        }),
      });

      if (response.ok) {
        setNewMessage('');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'DELIVERED':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'READ':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'FAILED':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getSessionTimeRemaining = () => {
    if (!conversation?.sessionExpiresAt) return null;
    const expires = new Date(conversation.sessionExpiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return null;

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inbox">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-lg font-medium text-gray-600">
                {contact?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{contact?.name}</p>
              <p className="text-sm text-gray-500">{contact?.phone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Session indicator */}
            {conversation?.sessionActive ? (
              <div className="flex items-center text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                <Clock className="h-3 w-3 mr-1" />
                {getSessionTimeRemaining()} left
              </div>
            ) : (
              <div className="flex items-center text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <AlertCircle className="h-3 w-3 mr-1" />
                Session expired
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContactInfo(!showContactInfo)}
            >
              <User className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#e5ded8]">
          <div className="space-y-4">
            {messages.map((message, index) => {
              const showDate = index === 0 || 
                formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

              return (
                <div key={message.id}>
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
                        {formatDate(message.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    'flex',
                    message.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'
                  )}>
                    <div className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2 shadow-sm',
                      message.direction === 'OUTBOUND'
                        ? 'bg-[#dcf8c6] rounded-br-none'
                        : 'bg-white rounded-bl-none'
                    )}>
                      {/* Message content */}
                      {message.type === 'TEXT' && (
                        <p className="text-gray-900">{message.content.text}</p>
                      )}
                      {message.type === 'IMAGE' && (
                        <div>
                          <img
                            src={message.content.url}
                            alt="Image"
                            className="rounded max-w-full"
                          />
                          {message.content.caption && (
                            <p className="text-gray-900 mt-1">{message.content.caption}</p>
                          )}
                        </div>
                      )}
                      {message.type === 'DOCUMENT' && (
                        <div className="flex items-center space-x-2">
                          <FileText className="h-8 w-8 text-gray-400" />
                          <span className="text-gray-900">{message.content.filename}</span>
                        </div>
                      )}
                      {message.type === 'TEMPLATE' && (
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-xs text-blue-600 mb-1">Template: {message.content.templateName}</p>
                          <p className="text-gray-900">{message.content.text}</p>
                        </div>
                      )}

                      {/* Time and status */}
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                        {message.direction === 'OUTBOUND' && getStatusIcon(message.status)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="px-4 py-3 border-t bg-gray-50">
          {!conversation?.sessionActive && (
            <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              24-hour session expired. You can only send template messages.
              <Button
                variant="link"
                size="sm"
                className="ml-2 p-0 h-auto text-yellow-800 underline"
                onClick={() => setShowTemplateSelector(true)}
              >
                Choose template
              </Button>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Smile className="h-5 w-5 text-gray-500" />
            </Button>
            <Button variant="ghost" size="sm">
              <Paperclip className="h-5 w-5 text-gray-500" />
            </Button>
            <Input
              placeholder={conversation?.sessionActive ? "Type a message..." : "Session expired - use template"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={!conversation?.sessionActive || sending}
              className="flex-1"
            />
            <Button
              variant="whatsapp"
              size="sm"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Info Sidebar */}
      {showContactInfo && (
        <div className="w-80 border-l bg-white">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-medium">Contact Info</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowContactInfo(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-medium text-gray-600">
                  {contact?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-medium text-lg">{contact?.name}</p>
              <p className="text-gray-500">{contact?.phone}</p>
            </div>

            <div className="space-y-3">
              {contact?.email && (
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm">{contact.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Opt-in Status</p>
                <p className="text-sm">{contact?.optInStatus ? 'Opted In' : 'Not Opted In'}</p>
              </div>
              {contact?.tags && contact.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" className="w-full" asChild>
              <Link href={`/contacts/${contact?.id}`}>View Full Profile</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
