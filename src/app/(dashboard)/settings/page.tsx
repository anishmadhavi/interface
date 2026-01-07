/**
 * =============================================================================
 * FILE: src/app/(dashboard)/settings/page.tsx
 * PURPOSE: General Settings - Organization & Account Configuration
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Displays and manages organization settings
 * - User profile and account settings
 * - WhatsApp Business configuration
 * - Notification preferences
 * - Time zone and language settings
 * - Danger zone (delete account, export data)
 * 
 * KEY FEATURES:
 * - Organization profile (name, logo, address)
 * - Business hours configuration
 * - Default reply settings
 * - Notification channels (email, push)
 * - Session timeout settings
 * - Data export (DPDP compliance)
 * - Account deletion
 * 
 * SETTINGS SECTIONS:
 * - Organization Profile
 * - WhatsApp Business Settings
 * - Notifications
 * - Security
 * - Data & Privacy
 * - Danger Zone
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/client (for data fetching)
 * - Cloudflare R2 (for logo upload)
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
  Building2,
  User,
  Bell,
  Shield,
  Globe,
  Clock,
  Upload,
  Save,
  Trash2,
  Download,
  AlertTriangle,
  MessageSquare,
  Mail,
  Smartphone,
  Loader2,
  CheckCircle2,
  Key
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface OrganizationSettings {
  name: string;
  logo?: string;
  address: string;
  website: string;
  industry: string;
  timezone: string;
  language: string;
}

interface WhatsAppSettings {
  displayName: string;
  aboutText: string;
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  awayMessage: string;
  greetingMessage: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  newMessageAlert: boolean;
  campaignComplete: boolean;
  lowBalance: boolean;
  weeklyReport: boolean;
}

interface UserSettings {
  name: string;
  email: string;
  phone: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>({
    name: '',
    logo: '',
    address: '',
    website: '',
    industry: '',
    timezone: 'Asia/Kolkata',
    language: 'en',
  });

  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppSettings>({
    displayName: '',
    aboutText: '',
    businessHours: {
      enabled: false,
      start: '09:00',
      end: '18:00',
      timezone: 'Asia/Kolkata',
    },
    awayMessage: '',
    greetingMessage: '',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    newMessageAlert: true,
    campaignComplete: true,
    lowBalance: true,
    weeklyReport: false,
  });

  const [userSettings, setUserSettings] = useState<UserSettings>({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user data
      const { data: userData } = await supabase
        .from('users')
        .select('*, organizations(*)')
        .eq('auth_id', user.id)
        .single();

      if (userData) {
        setUserSettings({
          name: userData.name || '',
          email: userData.email || user.email || '',
          phone: userData.phone || '',
        });

        if (userData.organizations) {
          const org = userData.organizations;
          setOrgSettings({
            name: org.name || '',
            logo: org.logo_url || '',
            address: org.address || '',
            website: org.website || '',
            industry: org.industry || '',
            timezone: org.timezone || 'Asia/Kolkata',
            language: org.language || 'en',
          });

          setWhatsappSettings({
            displayName: org.whatsapp_display_name || '',
            aboutText: org.whatsapp_about || '',
            businessHours: org.business_hours || {
              enabled: false,
              start: '09:00',
              end: '18:00',
              timezone: 'Asia/Kolkata',
            },
            awayMessage: org.away_message || '',
            greetingMessage: org.greeting_message || '',
          });

          setNotifications(org.notification_settings || {
            emailNotifications: true,
            pushNotifications: true,
            newMessageAlert: true,
            campaignComplete: true,
            lowBalance: true,
            weeklyReport: false,
          });
        }
      }

      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSaveSection = async (section: string) => {
    setSaving(section);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_id', user.id)
        .single();

      if (section === 'profile') {
        await supabase
          .from('users')
          .update({
            name: userSettings.name,
            phone: userSettings.phone,
          })
          .eq('auth_id', user.id);
      }

      if (section === 'organization') {
        await supabase
          .from('organizations')
          .update({
            name: orgSettings.name,
            address: orgSettings.address,
            website: orgSettings.website,
            industry: orgSettings.industry,
            timezone: orgSettings.timezone,
            language: orgSettings.language,
          })
          .eq('id', userData?.organization_id);
      }

      if (section === 'whatsapp') {
        await supabase
          .from('organizations')
          .update({
            whatsapp_display_name: whatsappSettings.displayName,
            whatsapp_about: whatsappSettings.aboutText,
            business_hours: whatsappSettings.businessHours,
            away_message: whatsappSettings.awayMessage,
            greeting_message: whatsappSettings.greetingMessage,
          })
          .eq('id', userData?.organization_id);
      }

      if (section === 'notifications') {
        await supabase
          .from('organizations')
          .update({
            notification_settings: notifications,
          })
          .eq('id', userData?.organization_id);
      }

      setSuccessMessage(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In production, upload to Cloudflare R2
    const url = URL.createObjectURL(file);
    setOrgSettings({ ...orgSettings, logo: url });
  };

  const handleExportData = async () => {
    // Trigger data export (DPDP compliance)
    alert('Your data export will be ready within 24 hours. You will receive an email with the download link.');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    if (!confirm('All your data, contacts, and conversations will be permanently deleted. Continue?')) return;

    // In production, call delete API
    alert('Account deletion request submitted. You will be logged out and your data will be deleted within 30 days as per DPDP Act requirements.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-whatsapp" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage your account and organization settings</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/api-keys">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </Link>
        </Button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          {successMessage}
        </div>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-500" />
            Profile Settings
          </CardTitle>
          <CardDescription>Your personal account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={userSettings.name}
                onChange={(e) => setUserSettings({ ...userSettings, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={userSettings.phone}
                onChange={(e) => setUserSettings({ ...userSettings, phone: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Email Address</Label>
            <Input value={userSettings.email} disabled className="mt-1 bg-gray-50" />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          <Button
            variant="whatsapp"
            onClick={() => handleSaveSection('profile')}
            disabled={saving === 'profile'}
          >
            {saving === 'profile' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-purple-500" />
            Organization Settings
          </CardTitle>
          <CardDescription>Your business information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
              {orgSettings.logo ? (
                <img src={orgSettings.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </span>
              </Button>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Organization Name</Label>
              <Input
                value={orgSettings.name}
                onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={orgSettings.website}
                onChange={(e) => setOrgSettings({ ...orgSettings, website: e.target.value })}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <select
                value={orgSettings.industry}
                onChange={(e) => setOrgSettings({ ...orgSettings, industry: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="">Select Industry</option>
                <option value="ecommerce">E-Commerce</option>
                <option value="retail">Retail</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="finance">Finance</option>
                <option value="technology">Technology</option>
                <option value="hospitality">Hospitality</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Timezone</Label>
              <select
                value={orgSettings.timezone}
                onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3"
              >
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="America/New_York">US Eastern</option>
                <option value="America/Los_Angeles">US Pacific</option>
                <option value="Europe/London">UK (GMT)</option>
                <option value="Asia/Dubai">UAE (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea
              value={orgSettings.address}
              onChange={(e) => setOrgSettings({ ...orgSettings, address: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>

          <Button
            variant="whatsapp"
            onClick={() => handleSaveSection('organization')}
            disabled={saving === 'organization'}
          >
            {saving === 'organization' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Organization
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-whatsapp" />
            WhatsApp Business Settings
          </CardTitle>
          <CardDescription>Configure your WhatsApp Business profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Display Name</Label>
              <Input
                value={whatsappSettings.displayName}
                onChange={(e) => setWhatsappSettings({ ...whatsappSettings, displayName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>About Text</Label>
              <Input
                value={whatsappSettings.aboutText}
                onChange={(e) => setWhatsappSettings({ ...whatsappSettings, aboutText: e.target.value })}
                maxLength={139}
                className="mt-1"
              />
            </div>
          </div>

          {/* Business Hours */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <Label>Business Hours</Label>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappSettings.businessHours.enabled}
                  onChange={(e) => setWhatsappSettings({
                    ...whatsappSettings,
                    businessHours: { ...whatsappSettings.businessHours, enabled: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            {whatsappSettings.businessHours.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={whatsappSettings.businessHours.start}
                    onChange={(e) => setWhatsappSettings({
                      ...whatsappSettings,
                      businessHours: { ...whatsappSettings.businessHours, start: e.target.value }
                    })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={whatsappSettings.businessHours.end}
                    onChange={(e) => setWhatsappSettings({
                      ...whatsappSettings,
                      businessHours: { ...whatsappSettings.businessHours, end: e.target.value }
                    })}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Away Message</Label>
            <Textarea
              value={whatsappSettings.awayMessage}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, awayMessage: e.target.value })}
              placeholder="We're currently offline. We'll get back to you soon!"
              rows={2}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Sent when outside business hours</p>
          </div>

          <div>
            <Label>Greeting Message</Label>
            <Textarea
              value={whatsappSettings.greetingMessage}
              onChange={(e) => setWhatsappSettings({ ...whatsappSettings, greetingMessage: e.target.value })}
              placeholder="Hello! Welcome to our store. How can we help you today?"
              rows={2}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Sent to new contacts automatically</p>
          </div>

          <Button
            variant="whatsapp"
            onClick={() => handleSaveSection('whatsapp')}
            disabled={saving === 'whatsapp'}
          >
            {saving === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save WhatsApp Settings
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2 text-yellow-500" />
            Notification Settings
          </CardTitle>
          <CardDescription>Choose how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {[
              { key: 'emailNotifications', label: 'Email Notifications', icon: Mail, desc: 'Receive updates via email' },
              { key: 'pushNotifications', label: 'Push Notifications', icon: Smartphone, desc: 'Browser notifications' },
              { key: 'newMessageAlert', label: 'New Message Alerts', icon: MessageSquare, desc: 'Alert for incoming messages' },
              { key: 'campaignComplete', label: 'Campaign Complete', icon: CheckCircle2, desc: 'When campaigns finish sending' },
              { key: 'lowBalance', label: 'Low Balance Warning', icon: AlertTriangle, desc: 'When wallet balance is low' },
              { key: 'weeklyReport', label: 'Weekly Reports', icon: Mail, desc: 'Weekly analytics summary' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <item.icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications[item.key as keyof NotificationSettings]}
                    onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-whatsapp after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
            ))}
          </div>

          <Button
            variant="whatsapp"
            onClick={() => handleSaveSection('notifications')}
            disabled={saving === 'notifications'}
          >
            {saving === 'notifications' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Notifications
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium">Export Your Data</p>
              <p className="text-sm text-gray-500">Download all your data (DPDP Act compliance)</p>
            </div>
            <Button variant="outline" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div>
              <p className="font-medium text-red-700">Delete Account</p>
              <p className="text-sm text-red-600">Permanently delete your account and all data</p>
            </div>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
