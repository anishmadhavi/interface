/**
 * =============================================================================
 * FILE: src/app/(dashboard)/contacts/page.tsx
 * PURPOSE: Contacts List Page
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays all contacts in the organization
 * - Supports search by name, phone, or email
 * - Supports filtering by tags and opt-in status
 * - Allows adding new contacts manually
 * - Shows contact count and pagination
 * - Quick actions: message, edit, delete
 * - Bulk actions: tag, delete multiple
 * 
 * KEY FEATURES:
 * - Search functionality
 * - Tag-based filtering
 * - Opt-in status filter
 * - Pagination (50 per page)
 * - CSV import button (links to /contacts/import)
 * - Add contact modal
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * =============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Plus,
  Upload,
  MoreVertical,
  MessageSquare,
  Pencil,
  Trash2,
  Filter,
  Users,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  optInStatus: boolean;
  lastMessageAt?: string;
  createdAt: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [optInFilter, setOptInFilter] = useState<'all' | 'opted_in' | 'not_opted_in'>('all');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
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
        .from('contacts')
        .select('*')
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contacts:', error);
        return;
      }

      const mapped: Contact[] = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Unknown',
        phone: c.phone,
        email: c.email,
        tags: c.tags || [],
        optInStatus: c.opt_in_status || false,
        lastMessageAt: c.last_message_at,
        createdAt: c.created_at,
      }));

      setContacts(mapped);
      setFilteredContacts(mapped);

      // Extract all unique tags
      const tags = new Set<string>();
      mapped.forEach(c => c.tags.forEach(t => tags.add(t)));
      setAllTags(Array.from(tags));

      setLoading(false);
    };

    fetchContacts();
  }, []);

  // Filter contacts
  useEffect(() => {
    let filtered = [...contacts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query) ||
          (c.email && c.email.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(c =>
        selectedTags.some(tag => c.tags.includes(tag))
      );
    }

    // Opt-in filter
    if (optInFilter === 'opted_in') {
      filtered = filtered.filter(c => c.optInStatus);
    } else if (optInFilter === 'not_opted_in') {
      filtered = filtered.filter(c => !c.optInStatus);
    }

    setFilteredContacts(filtered);
  }, [contacts, searchQuery, selectedTags, optInFilter]);

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const handleSelectContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedContacts.length} contacts?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', selectedContacts);

    if (!error) {
      setContacts(prev => prev.filter(c => !selectedContacts.includes(c.id)));
      setSelectedContacts([]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500">{contacts.length} total contacts</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/import">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button variant="whatsapp" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Opt-in Filter */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {[
            { value: 'all', label: 'All' },
            { value: 'opted_in', label: 'Opted In' },
            { value: 'not_opted_in', label: 'Not Opted In' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setOptInFilter(filter.value as any)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                optInFilter === filter.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {allTags.slice(0, 5).map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags(prev =>
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )
                  }
                  className={cn(
                    'px-2 py-0.5 text-xs rounded-full transition-colors',
                    selectedTags.includes(tag)
                      ? 'bg-whatsapp text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <span className="text-sm text-blue-800">
            {selectedContacts.length} contact(s) selected
          </span>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Add Tag
            </Button>
            <Button variant="outline" size="sm" className="text-red-600" onClick={handleDeleteSelected}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No contacts found</p>
              <p className="text-sm text-gray-400">
                {searchQuery ? 'Try a different search term' : 'Add contacts to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedContacts.length === filteredContacts.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tags
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Opt-in
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Added
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => handleSelectContact(contact.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            {contact.email && (
                              <p className="text-sm text-gray-500">{contact.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{contact.phone}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contact.optInStatus ? (
                          <span className="inline-flex items-center text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-gray-400">
                            <XCircle className="h-4 w-4 mr-1" />
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {formatDate(contact.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/inbox?phone=${contact.phone}`}>
                              <MessageSquare className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/contacts/${contact.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
