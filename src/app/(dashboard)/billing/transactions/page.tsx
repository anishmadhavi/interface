/**
 * =============================================================================
 * FILE: src/app/(dashboard)/billing/transactions/page.tsx
 * PURPOSE: Transaction History - All Billing Transactions
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays complete transaction history
 * - Shows credits (wallet top-ups) and debits (charges)
 * - Filters by type, date range, status
 * - Shows detailed breakdown of charges
 * - Allows downloading invoices
 * - Export transaction history as CSV
 * 
 * KEY FEATURES:
 * - Transaction list with pagination
 * - Filter by type (Credit, Debit, Refund)
 * - Date range filter
 * - Search by transaction ID
 * - Invoice download links
 * - Export to CSV
 * - Running balance display
 * 
 * TRANSACTION TYPES:
 * - CREDIT: Wallet top-up
 * - DEBIT: WhatsApp charges, subscription, virtual number
 * - REFUND: Refunds to wallet
 * - SUBSCRIPTION: Monthly/Annual plan charges
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Download,
  Filter,
  Calendar,
  Receipt,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type TransactionType = 'CREDIT' | 'DEBIT' | 'REFUND' | 'SUBSCRIPTION';
type TransactionStatus = 'SUCCESS' | 'PENDING' | 'FAILED';

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balance: number;
  description: string;
  reference?: string;
  invoiceUrl?: string;
  createdAt: string;
  metadata?: {
    planName?: string;
    messages?: number;
    category?: string;
  };
}

const TYPE_CONFIG = {
  CREDIT: { label: 'Credit', icon: ArrowDownLeft, color: 'text-green-600 bg-green-50' },
  DEBIT: { label: 'Debit', icon: ArrowUpRight, color: 'text-red-600 bg-red-50' },
  REFUND: { label: 'Refund', icon: ArrowDownLeft, color: 'text-blue-600 bg-blue-50' },
  SUBSCRIPTION: { label: 'Subscription', icon: Receipt, color: 'text-purple-600 bg-purple-50' },
};

export default function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  useEffect(() => {
    const fetchTransactions = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (!userData?.organization_id) return;

      const { data, error, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('organization_id', userData.organization_id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTransactions(data.map((t: any) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          amount: t.amount,
          balance: t.balance_after,
          description: t.description,
          reference: t.reference_id,
          invoiceUrl: t.invoice_url,
          createdAt: t.created_at,
          metadata: t.metadata,
        })));
        setTotalPages(Math.ceil((count || 0) / perPage));
      }

      setLoading(false);
    };

    fetchTransactions();
  }, []);

  // Filter transactions
  useEffect(() => {
    let filtered = [...transactions];

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    if (dateRange.start) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(dateRange.start));
    }

    if (dateRange.end) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(dateRange.end + 'T23:59:59'));
    }

    setFilteredTransactions(filtered);
    setTotalPages(Math.ceil(filtered.length / perPage));
    setPage(1);
  }, [transactions, searchQuery, typeFilter, dateRange]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Balance', 'Status', 'Reference'];
    const rows = filteredTransactions.map(t => [
      formatDate(t.createdAt),
      t.type,
      t.description,
      t.amount,
      t.balance,
      t.status,
      t.reference || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
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

  const paginatedTransactions = filteredTransactions.slice((page - 1) * perPage, page * perPage);

  // Calculate summary
  const summary = {
    totalCredits: transactions.filter(t => t.type === 'CREDIT' || t.type === 'REFUND').reduce((sum, t) => sum + t.amount, 0),
    totalDebits: transactions.filter(t => t.type === 'DEBIT' || t.type === 'SUBSCRIPTION').reduce((sum, t) => sum + t.amount, 0),
    transactionCount: transactions.length,
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
            <p className="text-gray-500">All your billing transactions</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Credits</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCredits)}</p>
              </div>
              <ArrowDownLeft className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Debits</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDebits)}</p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Transactions</p>
                <p className="text-2xl font-bold">{summary.transactionCount}</p>
              </div>
              <Receipt className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by ID, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              {(['ALL', 'CREDIT', 'DEBIT', 'SUBSCRIPTION'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    typeFilter === type
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {type === 'ALL' ? 'All' : type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-36"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {paginatedTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Balance</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedTransactions.map((transaction) => {
                    const config = TYPE_CONFIG[transaction.type];
                    const TypeIcon = config.icon;

                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="text-sm">{formatDate(transaction.createdAt)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn(
                            'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                            config.color
                          )}>
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm">{transaction.description}</p>
                          {transaction.reference && (
                            <p className="text-xs text-gray-500">Ref: {transaction.reference}</p>
                          )}
                          {transaction.metadata?.messages && (
                            <p className="text-xs text-gray-500">
                              {transaction.metadata.messages} messages • {transaction.metadata.category}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            'font-medium',
                            transaction.type === 'CREDIT' || transaction.type === 'REFUND'
                              ? 'text-green-600'
                              : 'text-red-600'
                          )}>
                            {transaction.type === 'CREDIT' || transaction.type === 'REFUND' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm">
                          {formatCurrency(transaction.balance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            transaction.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                            transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {transaction.invoiceUrl ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={transaction.invoiceUrl} download>
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredTransactions.length)} of {filteredTransactions.length}
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
