/**
 * =============================================================================
 * FILE: src/app/(dashboard)/contacts/[id]/page.tsx
 * PURPOSE: Contact Detail & Edit Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays full contact information
 * - Allows editing contact details (name, email, tags, custom fields)
 * - Shows conversation history with this contact
 * - Shows opt-in/consent status and history
 * - Shows e-commerce data if Shopify/WooCommerce integrated
 * - Allows adding/removing tags
 * - Provides DPDP "Forget Me" functionality
 * 
 * KEY FEATURES:
 * - Edit mode toggle
 * - Tag management
 * - Custom fields editor
 * - Conversation history timeline
 * - Order history (if e-commerce connected)
 * - Delete contact option
 * - Consent log viewer
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
  Pencil,
  Save,
  X,
  Trash2,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  Tag,
  ShoppingBag,
  Shield,
  AlertTriangle,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Link from 'next/link';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  optInStatus: boolean;
  optInMethod?: string;
  optInTimestamp?: string;
  customFields?: Record<string, string>;
  shopifyCustomerId?: string;
  totalOrders?: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

interface ConversationSummary {
  id: string;
  lastMessageAt: string;
  messageCount: number;
  status: string;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContact, setEditedContact] = useState<Partial<Contact>>({});
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [newTag, setNewTag] = useState('');

  // Fetch contact data
  useEffect(() => {
    const fetchContact = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      // Fetch contact
      const { data: contactData, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('organization_id', userData.organization_id)
        .single();

      if (error || !contactData) {
        console.error('Error fetching contact:', error);
        router.push('/contacts');
        return;
      }

      setContact({
        id: contactData.id,
        name: contactData.name || '',
        phone: contactData.phone,
        email: contactData.email,
        tags: contactData.tags || [],
        optInStatus: contactData.opt_in_status || false,
        optInMethod: contactData.opt_in_method,
        optInTimestamp: contactData.opt_in_timestamp,
        customFields: contactData.custom_fields || {},
        shopifyCustomerId: contactData.shopify_customer_id,
        totalOrders: contactData.total_orders,
        totalSpent: contactData.total_spent,
        createdAt: contactData.created_at,
        updatedAt: contactData.updated_at,
      });

      setEditedContact({
        name: contactData.name || '',
        email: contactData.email,
        tags: contactData.tags || [],
      });

      // Fetch conversations
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, last_message_at, status')
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false });

      if (convData) {
        setConversations(
          convData.map((c: any) => ({
            id: c.id,
            lastMessageAt: c.last_message_at,
            messageCount: 0,
            status: c.status,
          }))
        );
      }

      setLoading(false);
    };

    fetchContact();
  }, [contactId, router]);

  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editedContact.name,
        email: editedContact.email,
        tags: editedContact.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    if (!error) {
      setContact({
        ...contact,
        name: editedContact.name || contact.name,
        email: editedContact.email,
        tags: editedContact.tags || [],
      });
      setEditMode(false);
    }

    setSaving(false);
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...(editedContact.tags || []), newTag.trim()];
    setEditedContact({ ...editedContact, tags: updatedTags });
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = (editedContact.tags || []).filter(t => t !== tagToRemove);
    setEditedContact({ ...editedContact, tags: updatedTags });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (!error) {
      router.push('/contacts');
    }
  };

  const handleForgetMe = async () => {
    if (!confirm('This will permanently delete all data for this contact as per DPDP Act requirements. Continue?')) {
      return;
    }

    const response = await fetch('/api/compliance/forget-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId }),
    });

    if (response.ok) {
      router.push('/contacts');
    }
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-600">
                {contact.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{contact.name || 'Unknown'}</h1>
              <p className="text-gray-500">{contact.phone}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button variant="whatsapp" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="whatsapp" asChild>
                <Link href={`/inbox?phone=${contact.phone}`}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Message
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  {editMode ? (
                    <Input
                      value={editedContact.name || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{contact.name || '-'}</p>
                  )}
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="mt-1 text-gray-900 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {contact.phone}
                  </p>
                </div>
                <div>
                  <Label>Email</Label>
                  {editMode ? (
                    <Input
                      type="email"
                      value={editedContact.email || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900 flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {contact.email || '-'}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Added On</Label>
                  <p className="mt-1 text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {formatDate(contact.createdAt)}
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label className="flex items-center mb-2">
                  <Tag className="h-4 w-4 mr-2" />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(editMode ? editedContact.tags : contact.tags)?.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                      {editMode && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                  {editMode && (
                    <div className="flex items-center space-x-1">
                      <Input
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        className="w-32 h-8 text-sm"
                      />
                      <Button variant="ghost" size="sm" onClick={handleAddTag}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversation History */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <CardDescription>Previous chats with this contact</CardDescription>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <Link
                      key={conv.id}
                      href={`/inbox/${conv.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Conversation
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(conv.lastMessageAt)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        conv.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                        conv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {conv.status.toLowerCase()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Opt-in Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Consent Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Opt-in Status</span>
                {contact.optInStatus ? (
                  <span className="flex items-center text-green-600">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Opted In
                  </span>
                ) : (
                  <span className="flex items-center text-gray-400">
                    <XCircle className="h-4 w-4 mr-1" />
                    Not Opted In
                  </span>
                )}
              </div>
              {contact.optInMethod && (
                <div className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">Method:</span> {contact.optInMethod}
                </div>
              )}
              {contact.optInTimestamp && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">Date:</span> {formatDateTime(contact.optInTimestamp)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* E-commerce Data (if available) */}
          {contact.shopifyCustomerId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  E-commerce
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Orders</span>
                  <span className="font-medium">{contact.totalOrders || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Spent</span>
                  <span className="font-medium">{formatCurrency(contact.totalSpent || 0)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Contact
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleForgetMe}
              >
                <Shield className="h-4 w-4 mr-2" />
                DPDP: Forget Me
              </Button>
              <p className="text-xs text-gray-500">
                &quot;Forget Me&quot; permanently deletes all data including messages, as per DPDP Act 2023.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
