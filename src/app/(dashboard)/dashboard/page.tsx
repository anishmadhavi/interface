export const runtime = 'edge';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageSquare,
  Users,
  Send,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const stats = [
  {
    name: 'Total Conversations',
    value: '2,847',
    change: '+12.5%',
    trend: 'up',
    icon: MessageSquare,
    color: 'bg-blue-500',
  },
  {
    name: 'Active Contacts',
    value: '14,523',
    change: '+5.2%',
    trend: 'up',
    icon: Users,
    color: 'bg-green-500',
  },
  {
    name: 'Messages Sent',
    value: '48,293',
    change: '+18.7%',
    trend: 'up',
    icon: Send,
    color: 'bg-purple-500',
  },
  {
    name: 'Response Rate',
    value: '94.2%',
    change: '-2.1%',
    trend: 'down',
    icon: TrendingUp,
    color: 'bg-orange-500',
  },
];

const recentConversations = [
  {
    id: 1,
    contact: 'Rahul Sharma',
    phone: '+91 98765 43210',
    lastMessage: 'Thank you for your help!',
    time: '2 min ago',
    unread: true,
  },
  {
    id: 2,
    contact: 'Priya Patel',
    phone: '+91 87654 32109',
    lastMessage: 'When will my order arrive?',
    time: '15 min ago',
    unread: true,
  },
  {
    id: 3,
    contact: 'Amit Kumar',
    phone: '+91 76543 21098',
    lastMessage: 'I want to return this product',
    time: '1 hour ago',
    unread: false,
  },
  {
    id: 4,
    contact: 'Sneha Gupta',
    phone: '+91 65432 10987',
    lastMessage: 'Great service!',
    time: '2 hours ago',
    unread: false,
  },
];

const pendingTasks = [
  {
    id: 1,
    title: '12 unassigned conversations',
    description: 'Conversations waiting for agent assignment',
    icon: MessageSquare,
    action: 'View',
    href: '/inbox?filter=unassigned',
  },
  {
    id: 2,
    title: '3 templates pending approval',
    description: 'Templates submitted to Meta for review',
    icon: Clock,
    action: 'View',
    href: '/templates?status=pending',
  },
  {
    id: 3,
    title: 'Scheduled campaign at 6:00 PM',
    description: 'Diwali Sale campaign to 5,234 contacts',
    icon: Send,
    action: 'View',
    href: '/campaigns',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg ${stat.color} p-2`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div
                  className={`flex items-center text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.change}
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="ml-1 h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.name}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Conversations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Conversations</CardTitle>
            <a href="/inbox" className="text-sm font-medium text-whatsapp hover:underline">
              View all
            </a>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center justify-between rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-medium text-gray-600">
                      {conversation.contact.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{conversation.contact}</p>
                        {conversation.unread && (
                          <span className="h-2 w-2 rounded-full bg-whatsapp"></span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1">
                        {conversation.lastMessage}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{conversation.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Tasks</CardTitle>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-600">
              {pendingTasks.length} pending
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex items-start space-x-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <task.icon className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-sm text-gray-500">{task.description}</p>
                    </div>
                  </div>
                  <a
                    href={task.href}
                    className="text-sm font-medium text-whatsapp hover:underline"
                  >
                    {task.action}
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Connection Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">WhatsApp Connected</p>
                <p className="text-sm text-gray-500">+91 98765 43210 • Quality: Green</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Messaging Tier</p>
              <p className="font-medium text-gray-900">10,000 / day</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
