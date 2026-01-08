/**
 * =============================================================================
 * FILE: src/app/(dashboard)/quick-replies/page.tsx
 * PURPOSE: Quick Replies / Canned Responses Management Page
 * =============================================================================
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Tag,
  Clock,
  X,
} from 'lucide-react';

interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  message: string;
  category: string;
  usageCount: number;
  lastUsed: string | null;
}

export default function QuickRepliesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);

  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    {
      id: '1',
      shortcut: '/greeting',
      title: 'Greeting',
      message: 'Hello! 👋 Thank you for reaching out to us. How can I help you today?',
      category: 'General',
      usageCount: 234,
      lastUsed: '5 minutes ago',
    },
    {
      id: '2',
      shortcut: '/hours',
      title: 'Business Hours',
      message: 'Our business hours are Monday to Saturday, 9 AM to 6 PM IST. We\'ll get back to you during working hours.',
      category: 'General',
      usageCount: 156,
      lastUsed: '1 hour ago',
    },
    {
      id: '3',
      shortcut: '/thanks',
      title: 'Thank You',
      message: 'Thank you for your order! 🎉 We appreciate your business. Your order will be processed shortly.',
      category: 'Orders',
      usageCount: 89,
      lastUsed: '2 hours ago',
    },
    {
      id: '4',
      shortcut: '/track',
      title: 'Track Order',
      message: 'You can track your order using this link: {{tracking_link}}. Let me know if you need any help!',
      category: 'Orders',
      usageCount: 67,
      lastUsed: '3 hours ago',
    },
    {
      id: '5',
      shortcut: '/refund',
      title: 'Refund Policy',
      message: 'Our refund policy allows returns within 7 days of delivery. Please share your order ID and reason for return.',
      category: 'Support',
      usageCount: 45,
      lastUsed: 'Yesterday',
    },
    {
      id: '6',
      shortcut: '/bye',
      title: 'Closing',
      message: 'Is there anything else I can help you with? Feel free to reach out anytime. Have a great day! 😊',
      category: 'General',
      usageCount: 123,
      lastUsed: '30 minutes ago',
    },
  ]);

  const [newReply, setNewReply] = useState({
    shortcut: '',
    title: '',
    message: '',
    category: 'General',
  });

  const categories = ['all', 'General', 'Orders', 'Support', 'Sales'];

  const filteredReplies = quickReplies.filter(reply => {
    const matchesSearch = 
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || reply.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    if (!newReply.shortcut || !newReply.message) return;
    
    const reply: QuickReply = {
      id: Date.now().toString(),
      shortcut: newReply.shortcut.startsWith('/') ? newReply.shortcut : `/${newReply.shortcut}`,
      title: newReply.title || newReply.shortcut.replace('/', ''),
      message: newReply.message,
      category: newReply.category,
      usageCount: 0,
      lastUsed: null,
    };
    
    setQuickReplies([reply, ...quickReplies]);
    setNewReply({ shortcut: '', title: '', message: '', category: 'General' });
    setShowCreateModal(false);
  };

  const handleDelete = (id: string) => {
    setQuickReplies(quickReplies.filter(r => r.id !== id));
  };

  const handleCopy = (message: string) => {
    navigator.clipboard.writeText(message);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quick Replies</h1>
          <p className="text-gray-600">Save time with pre-written message templates</p>
        </div>
        <Button 
          className="bg-[#25D366] hover:bg-[#128C7E]"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Quick Reply
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{quickReplies.length}</p>
                <p className="text-sm text-gray-500">Total Replies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {quickReplies.reduce((sum, r) => sum + r.usageCount, 0)}
                </p>
                <p className="text-sm text-gray-500">Times Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Tag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.length - 1}</p>
                <p className="text-sm text-gray-500">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by shortcut, title, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? 'bg-[#25D366] hover:bg-[#128C7E]' : ''}
            >
              {category === 'all' ? 'All' : category}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Replies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReplies.map((reply) => (
          <Card key={reply.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 text-green-600 px-2 py-0.5 rounded text-sm font-mono">
                      {reply.shortcut}
                    </code>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {reply.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-1">{reply.title}</h3>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(reply.message)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingReply(reply)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(reply.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {reply.message}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span>Used {reply.usageCount} times</span>
                {reply.lastUsed && (
                  <>
                    <span>•</span>
                    <span>Last used {reply.lastUsed}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredReplies.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quick replies found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Create your first quick reply to get started'}
            </p>
            {!searchQuery && (
              <Button 
                className="bg-[#25D366] hover:bg-[#128C7E]"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Quick Reply
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingReply) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editingReply ? 'Edit Quick Reply' : 'Create Quick Reply'}
                </h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingReply(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Shortcut</Label>
                  <Input
                    placeholder="/greeting"
                    value={editingReply?.shortcut || newReply.shortcut}
                    onChange={(e) => editingReply 
                      ? setEditingReply({ ...editingReply, shortcut: e.target.value })
                      : setNewReply({ ...newReply, shortcut: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Type this shortcut in chat to insert the message
                  </p>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    placeholder="Greeting Message"
                    value={editingReply?.title || newReply.title}
                    onChange={(e) => editingReply
                      ? setEditingReply({ ...editingReply, title: e.target.value })
                      : setNewReply({ ...newReply, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Hello! How can I help you today?"
                    value={editingReply?.message || newReply.message}
                    onChange={(e) => editingReply
                      ? setEditingReply({ ...editingReply, message: e.target.value })
                      : setNewReply({ ...newReply, message: e.target.value })
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{variable}}'} for dynamic content
                  </p>
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editingReply?.category || newReply.category}
                    onChange={(e) => editingReply
                      ? setEditingReply({ ...editingReply, category: e.target.value })
                      : setNewReply({ ...newReply, category: e.target.value })
                    }
                  >
                    {categories.filter(c => c !== 'all').map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingReply(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-[#25D366] hover:bg-[#128C7E]"
                    onClick={handleCreate}
                  >
                    {editingReply ? 'Save Changes' : 'Create'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Tip */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">Pro Tip</h3>
              <p className="text-sm text-blue-700">
                Type your shortcut (e.g., <code className="bg-blue-100 px-1 rounded">/greeting</code>) 
                in the chat box and press Enter to instantly insert the quick reply message.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
