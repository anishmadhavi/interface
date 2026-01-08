/**
 * =============================================================================
 * FILE: src/app/api/billing/webhook/route.ts
 * PURPOSE: Cashfree Payment Webhook Handler
 * =============================================================================
 * 
 * WHAT THIS FILE DOES:
 * - Receives payment notifications from Cashfree
 * - Verifies webhook signature for security
 * - Updates transaction status in database
 * - Credits wallet on successful payments
 * - Activates/renews subscriptions
 * - Generates invoices automatically
 * 
 * WEBHOOK EVENTS HANDLED:
 * - PAYMENT_SUCCESS_WEBHOOK: Payment completed
 * - PAYMENT_FAILED_WEBHOOK: Payment failed
 * - PAYMENT_USER_DROPPED_WEBHOOK: User abandoned
 * - REFUND_WEBHOOK: Refund processed
 * - SUBSCRIPTION_NEW_WEBHOOK: New subscription
 * - SUBSCRIPTION_PAYMENT_SUCCESS_WEBHOOK: Subscription renewed
 * - SUBSCRIPTION_CANCELLED_WEBHOOK: Subscription cancelled
 * 
 * CASHFREE SETUP:
 * 1. Go to Cashfree Dashboard > Developers > Webhooks
 * 2. Add Webhook URL: https://interface.techsoftwares.in/api/billing/webhook
 * 3. Select events to subscribe
 * 4. Copy webhook secret for signature verification
 * 
 * PRICING PLANS:
 * - Starter: ₹999/month
 * - Growth: ₹2,499/month
 * - Business: ₹4,999/month
 * 
 * DEPENDENCIES:
 * - @/lib/supabase/admin
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cashfree credentials
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

// Plan details
const PLANS: Record<string, { name: string; price: number; conversations: number }> = {
  STARTER: { name: 'Starter', price: 999, conversations: 1000 },
  GROWTH: { name: 'Growth', price: 2499, conversations: 5000 },
  BUSINESS: { name: 'Business', price: 4999, conversations: 15000 },
};

/**
 * POST - Cashfree Webhook Handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const timestamp = request.headers.get('x-webhook-timestamp');
    const signature = request.headers.get('x-webhook-signature');

    // Verify webhook signature
    if (CASHFREE_SECRET_KEY && signature) {
      const isValid = verifyWebhookSignature(body, timestamp, signature);
      if (!isValid) {
        console.error('[Billing Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const data = JSON.parse(body);
    const eventType = data.type;

    console.log('[Billing Webhook] Received:', eventType);

    // Process based on event type
    switch (eventType) {
      case 'PAYMENT_SUCCESS_WEBHOOK':
        await handlePaymentSuccess(data.data);
        break;

      case 'PAYMENT_FAILED_WEBHOOK':
        await handlePaymentFailed(data.data);
        break;

      case 'PAYMENT_USER_DROPPED_WEBHOOK':
        await handlePaymentDropped(data.data);
        break;

      case 'REFUND_WEBHOOK':
        await handleRefund(data.data);
        break;

      case 'SUBSCRIPTION_NEW_WEBHOOK':
        await handleNewSubscription(data.data);
        break;

      case 'SUBSCRIPTION_PAYMENT_SUCCESS_WEBHOOK':
        await handleSubscriptionPayment(data.data);
        break;

      case 'SUBSCRIPTION_CANCELLED_WEBHOOK':
        await handleSubscriptionCancelled(data.data);
        break;

      default:
        console.log('[Billing Webhook] Unhandled event:', eventType);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Billing Webhook] Error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ success: true });
  }
}

/**
 * Verify Cashfree webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  timestamp: string | null,
  signature: string
): boolean {
  if (!CASHFREE_SECRET_KEY || !timestamp) return true;

  try {
    const signatureData = timestamp + payload;
    const expectedSignature = crypto
      .createHmac('sha256', CASHFREE_SECRET_KEY)
      .update(signatureData)
      .digest('base64');

    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(data: any) {
  const { order, payment } = data;
  const orderId = order.order_id;
  const paymentId = payment.cf_payment_id;

  console.log('[Billing Webhook] Payment success:', orderId);

  // Get transaction from database
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (txError || !transaction) {
    console.error('[Billing Webhook] Transaction not found:', orderId);
    return;
  }

  // Check if already processed
  if (transaction.status === 'COMPLETED') {
    console.log('[Billing Webhook] Transaction already processed:', orderId);
    return;
  }

  // Update transaction status
  await supabaseAdmin
    .from('transactions')
    .update({
      status: 'COMPLETED',
      payment_id: paymentId,
      payment_method: payment.payment_method?.type || 'UNKNOWN',
      completed_at: new Date().toISOString(),
      payment_details: {
        bank_reference: payment.bank_reference,
        payment_group: payment.payment_group,
      },
    })
    .eq('id', transaction.id);

  // Process based on transaction type
  switch (transaction.type) {
    case 'WALLET_TOPUP':
      await creditWallet(transaction.organization_id, transaction.amount);
      break;

    case 'PLAN_UPGRADE':
      await activatePlan(transaction.organization_id, transaction.metadata?.plan);
      break;

    case 'SUBSCRIPTION':
      await renewSubscription(transaction.organization_id);
      break;
  }

  // Generate invoice
  await generateInvoice(transaction, payment);

  console.log('[Billing Webhook] Processed payment:', orderId);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(data: any) {
  const { order, payment } = data;
  const orderId = order.order_id;

  console.log('[Billing Webhook] Payment failed:', orderId);

  await supabaseAdmin
    .from('transactions')
    .update({
      status: 'FAILED',
      error_message: payment.payment_message || 'Payment failed',
      error_code: payment.payment_status,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);
}

/**
 * Handle user dropped payment
 */
async function handlePaymentDropped(data: any) {
  const { order } = data;
  const orderId = order.order_id;

  console.log('[Billing Webhook] Payment dropped:', orderId);

  await supabaseAdmin
    .from('transactions')
    .update({
      status: 'CANCELLED',
      error_message: 'User abandoned payment',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);
}

/**
 * Handle refund
 */
async function handleRefund(data: any) {
  const { refund } = data;
  const orderId = refund.order_id;
  const refundStatus = refund.refund_status;

  console.log('[Billing Webhook] Refund:', orderId, refundStatus);

  // Get original transaction
  const { data: transaction } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (!transaction) return;

  // Create refund record
  await supabaseAdmin.from('refunds').insert({
    organization_id: transaction.organization_id,
    transaction_id: transaction.id,
    refund_id: refund.cf_refund_id,
    amount: refund.refund_amount,
    status: refundStatus,
    reason: refund.refund_note || 'Customer request',
    processed_at: refundStatus === 'SUCCESS' ? new Date().toISOString() : null,
  });

  // If refund successful and was wallet topup, deduct from wallet
  if (refundStatus === 'SUCCESS' && transaction.type === 'WALLET_TOPUP') {
    await deductWallet(transaction.organization_id, refund.refund_amount);
  }

  // Update transaction
  await supabaseAdmin
    .from('transactions')
    .update({
      status: 'REFUNDED',
      refund_amount: refund.refund_amount,
      refund_id: refund.cf_refund_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);
}

/**
 * Handle new subscription
 */
async function handleNewSubscription(data: any) {
  const { subscription } = data;

  console.log('[Billing Webhook] New subscription:', subscription.subscription_id);

  // Find organization by customer email/phone
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('subscription_id', subscription.subscription_id)
    .single();

  if (!org) return;

  await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'ACTIVE',
      subscription_id: subscription.subscription_id,
      billing_period_start: new Date().toISOString(),
      billing_period_end: getNextBillingDate(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);
}

/**
 * Handle subscription payment success
 */
async function handleSubscriptionPayment(data: any) {
  const { subscription, payment } = data;

  console.log('[Billing Webhook] Subscription payment:', subscription.subscription_id);

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('subscription_id', subscription.subscription_id)
    .single();

  if (!org) return;

  // Renew subscription period
  await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'ACTIVE',
      billing_period_start: new Date().toISOString(),
      billing_period_end: getNextBillingDate(),
      next_billing_date: getNextBillingDate(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', org.id);

  // Create transaction record
  const plan = PLANS[org.plan] || PLANS.STARTER;
  
  await supabaseAdmin.from('transactions').insert({
    organization_id: org.id,
    order_id: `sub_${Date.now()}`,
    amount: plan.price,
    type: 'SUBSCRIPTION',
    status: 'COMPLETED',
    payment_id: payment.cf_payment_id,
    completed_at: new Date().toISOString(),
  });

  // Generate invoice
  await generateSubscriptionInvoice(org.id, plan);
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(data: any) {
  const { subscription } = data;

  console.log('[Billing Webhook] Subscription cancelled:', subscription.subscription_id);

  await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'CANCELLED',
      cancellation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscription.subscription_id);
}

/**
 * Credit wallet balance
 */
async function creditWallet(organizationId: string, amount: number) {
  // Get current balance
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('wallet_balance')
    .eq('id', organizationId)
    .single();

  const newBalance = (org?.wallet_balance || 0) + amount;

  // Update balance
  await supabaseAdmin
    .from('organizations')
    .update({
      wallet_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  // Log wallet transaction
  await supabaseAdmin.from('wallet_transactions').insert({
    organization_id: organizationId,
    type: 'CREDIT',
    amount,
    balance_after: newBalance,
    description: 'Wallet top-up',
  });

  console.log('[Billing Webhook] Wallet credited:', organizationId, amount);
}

/**
 * Deduct from wallet (for refunds)
 */
async function deductWallet(organizationId: string, amount: number) {
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('wallet_balance')
    .eq('id', organizationId)
    .single();

  const newBalance = Math.max(0, (org?.wallet_balance || 0) - amount);

  await supabaseAdmin
    .from('organizations')
    .update({
      wallet_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  await supabaseAdmin.from('wallet_transactions').insert({
    organization_id: organizationId,
    type: 'DEBIT',
    amount,
    balance_after: newBalance,
    description: 'Refund processed',
  });

  console.log('[Billing Webhook] Wallet debited:', organizationId, amount);
}

/**
 * Activate plan upgrade
 */
async function activatePlan(organizationId: string, plan: string) {
  if (!plan || !PLANS[plan]) return;

  await supabaseAdmin
    .from('organizations')
    .update({
      plan,
      subscription_status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  console.log('[Billing Webhook] Plan activated:', organizationId, plan);
}

/**
 * Renew subscription
 */
async function renewSubscription(organizationId: string) {
  await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'ACTIVE',
      billing_period_start: new Date().toISOString(),
      billing_period_end: getNextBillingDate(),
      next_billing_date: getNextBillingDate(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  console.log('[Billing Webhook] Subscription renewed:', organizationId);
}

/**
 * Generate invoice for payment
 */
async function generateInvoice(transaction: any, payment: any) {
  const invoiceNumber = generateInvoiceNumber();

  // Get organization details
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('name, billing_address, gstin')
    .eq('id', transaction.organization_id)
    .single();

  // Calculate tax (18% GST)
  const baseAmount = Math.round((transaction.amount / 1.18) * 100) / 100;
  const taxAmount = transaction.amount - baseAmount;

  await supabaseAdmin.from('invoices').insert({
    organization_id: transaction.organization_id,
    transaction_id: transaction.id,
    invoice_number: invoiceNumber,
    amount: transaction.amount,
    base_amount: baseAmount,
    tax_amount: taxAmount,
    tax_type: 'GST',
    tax_rate: 18,
    status: 'PAID',
    billing_name: org?.name,
    billing_address: org?.billing_address,
    gstin: org?.gstin,
    items: [
      {
        description: getInvoiceDescription(transaction.type),
        quantity: 1,
        unit_price: baseAmount,
        total: transaction.amount,
      },
    ],
    paid_at: new Date().toISOString(),
    payment_method: payment.payment_method?.type,
  });

  console.log('[Billing Webhook] Invoice generated:', invoiceNumber);
}

/**
 * Generate subscription invoice
 */
async function generateSubscriptionInvoice(
  organizationId: string,
  plan: { name: string; price: number }
) {
  const invoiceNumber = generateInvoiceNumber();

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('name, billing_address, gstin')
    .eq('id', organizationId)
    .single();

  const baseAmount = Math.round((plan.price / 1.18) * 100) / 100;
  const taxAmount = plan.price - baseAmount;

  await supabaseAdmin.from('invoices').insert({
    organization_id: organizationId,
    invoice_number: invoiceNumber,
    amount: plan.price,
    base_amount: baseAmount,
    tax_amount: taxAmount,
    tax_type: 'GST',
    tax_rate: 18,
    status: 'PAID',
    billing_name: org?.name,
    billing_address: org?.billing_address,
    gstin: org?.gstin,
    items: [
      {
        description: `${plan.name} Plan - Monthly Subscription`,
        quantity: 1,
        unit_price: baseAmount,
        total: plan.price,
      },
    ],
    paid_at: new Date().toISOString(),
  });
}

/**
 * Get invoice description based on transaction type
 */
function getInvoiceDescription(type: string): string {
  switch (type) {
    case 'WALLET_TOPUP':
      return 'Wallet Top-up';
    case 'PLAN_UPGRADE':
      return 'Plan Upgrade';
    case 'SUBSCRIPTION':
      return 'Monthly Subscription';
    default:
      return 'Service Charge';
  }
}

/**
 * Generate unique invoice number
 */
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}

/**
 * Get next billing date (1 month from now)
 */
function getNextBillingDate(): string {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}
