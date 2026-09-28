<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ProviderLayout from '../../components/layout/ProviderLayout.vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { toastService } from '../../infrastructure/feedback/toast.service'
import { t } from '../../i18n'
import { contentService } from '../../di/container'
import type { SupportContactDto, SupportTicketDto } from '../../domain/models/content'

const subject = ref('')
const category = ref('quotes_negotiation')
const priority = ref('high')
const message = ref('')
const submitting = ref(false)

const tickets = ref<SupportTicketDto[]>([])
const loadingTickets = ref(false)
const supportContact = ref<SupportContactDto | null>(null)

const categories = [
  { value: 'quotes_negotiation', label: 'Quote & Price Negotiation Issue' },
  { value: 'orders_fulfillment', label: 'Order Dispatch & Tracking' },
  { value: 'catalog_inventory', label: 'Catalog Products & Specifications' },
  { value: 'client_inquiry', label: 'Urgent Client Inquiry' },
  { value: 'system_technical', label: 'Technical or Portal Issue' },
]

const priorities = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High Priority' },
  { value: 'urgent', label: 'Urgent / Blocker' },
]

const categoryLabel = computed(
  () => categories.find((c) => c.value === category.value)?.label ?? category.value,
)
const priorityLabel = computed(
  () => priorities.find((p) => p.value === priority.value)?.label ?? priority.value,
)

/** The ticket API stores a single subject + message body, so the routing
 *  metadata is prefixed into the body rather than silently discarded. */
const composedMessage = computed(() => {
  const body = message.value.trim()
  return `[${categoryLabel.value}] Â· [${priorityLabel.value}]\n${body}`
})

const hasContactDetails = computed(
  () => !!(supportContact.value?.phoneNumber || supportContact.value?.whatsAppNumber),
)
const openTickets = computed(() => tickets.value.filter((tk) => tk.status !== 'Closed'))

const telHref = computed(() => {
  const raw = (supportContact.value?.phoneNumber || '').replace(/[^\d+]/g, '')
  return raw ? `tel:${raw}` : ''
})
const waHref = computed(() => {
  const raw = (supportContact.value?.whatsAppNumber || '').replace(/[^\d]/g, '')
  if (!raw) return ''
  return `https://wa.me/${raw}?text=${encodeURIComponent('Provider Escalation Inquiry from SNUL Network')}`
})

async function loadTickets() {
  loadingTickets.value = true
  try {
    await contentService.loadMyTickets()
    tickets.value = [...contentService.myTickets.value]
  } finally {
    loadingTickets.value = false
  }
}

async function loadContact() {
  supportContact.value = await contentService.loadSupportContact()
}

const submitEscalation = async () => {
  if (!subject.value.trim() || !message.value.trim()) {
    toastService.info('Please fill in both the subject and message.')
    return
  }

  submitting.value = true
  try {
    await contentService.createTicket(subject.value.trim(), composedMessage.value)
    toastService.success(t('provider.issueSentSuccess'))
    subject.value = ''
    message.value = ''
    category.value = 'quotes_negotiation'
    priority.value = 'high'
    await loadTickets()
  } catch {
    toastService.error('Could not submit the ticket. Please try again.')
  } finally {
    submitting.value = false
  }
}

async function closeTicket(id: string) {
  try {
    await contentService.closeTicket(id)
    tickets.value = [...contentService.myTickets.value]
  } catch {
    toastService.error('Could not close the ticket.')
  }
}

onMounted(async () => {
  await Promise.all([loadContact(), loadTickets()])
})
</script>

<template>
  <ProviderLayout>
    <div class="provider-support-view">
      <!-- Header -->
      <header class="view-header">
        <div>
          <span class="mono eyebrow">{{ t('provider.dashboard') }} Â· {{ t('provider.support') }}</span>
          <h1 class="view-title">{{ t('provider.contactAdmin') }}</h1>
          <p class="view-desc">{{ t('provider.supportDesc') }}</p>
        </div>
      </header>

      <!-- Channels Grid â€” values come from the SupportContact record, which an
           admin maintains via PUT /api/v1/support/contact. Nothing is invented
           here; if no record exists yet the cards are simply not shown. -->
      <div v-if="hasContactDetails" class="channels-grid">
        <!-- Hotline Card -->
        <div v-if="telHref" class="channel-card">
          <div class="channel-icon bg-blue-soft">
            <span class="material-symbols-outlined text-blue-600">support_agent</span>
          </div>
          <div class="channel-info">
            <span class="channel-label mono">{{ t('provider.callAdminSupport') }}</span>
            <strong class="channel-main mono">{{ supportContact?.phoneNumber }}</strong>
            <p v-if="supportContact?.workingHours" class="channel-sub">{{ supportContact.workingHours }}</p>
          </div>
          <a :href="telHref" class="btn-channel btn-call mono">
            <span class="material-symbols-outlined text-[16px]">call</span>
            <span>Call Hotline</span>
          </a>
        </div>

        <!-- WhatsApp Card -->
        <div v-if="waHref" class="channel-card">
          <div class="channel-icon bg-emerald-soft">
            <span class="material-symbols-outlined text-emerald-600">chat</span>
          </div>
          <div class="channel-info">
            <span class="channel-label mono">Instant WhatsApp Desk</span>
            <strong class="channel-main mono">{{ supportContact?.whatsAppNumber }}</strong>
          </div>
          <a
            :href="waHref"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-channel btn-wa mono"
          >
            <span class="material-symbols-outlined text-[16px]">forum</span>
            <span>Open WhatsApp</span>
          </a>
        </div>

        <div v-if="supportContact?.supportEmail" class="channel-card">
          <div class="channel-icon bg-blue-soft">
            <span class="material-symbols-outlined text-blue-600">mail</span>
          </div>
          <div class="channel-info">
            <span class="channel-label mono">Support Email</span>
            <strong class="channel-main mono">{{ supportContact.supportEmail }}</strong>
          </div>
          <a :href="`mailto:${supportContact.supportEmail}`" class="btn-channel btn-call mono">
            <span class="material-symbols-outlined text-[16px]">send</span>
            <span>Email Support</span>
          </a>
        </div>
      </div>

      <!-- Admin Authority & Management Guarantee Notice -->
      <div class="admin-notice-card">
        <span class="material-symbols-outlined text-amber-600 text-[26px]">admin_panel_settings</span>
        <div class="notice-content">
          <strong class="notice-title mono">Full Central Admin Oversight & Provider Management</strong>
          <p class="notice-desc">
            SNUL Central Administration maintains 360Â° operational access across the network. If your team encounters any logistics bottlenecks, client disputes, or quote calculation constraints, SNUL Admins can manage quotes on your behalf, update shipment states, track all your client interactions, and directly resolve procurement discrepancies.
          </p>
        </div>
      </div>

      <!-- Escalation Ticket Form -->
      <div class="ticket-card">
        <div class="ticket-card-head">
          <h2 class="ticket-heading">{{ t('provider.escalateIssue') }}</h2>
          <p class="ticket-sub">Submit an expedited ticket directly to the SNUL Admin executive queue.</p>
        </div>

        <form class="ticket-form" @submit.prevent="submitEscalation">
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-lbl mono">Category *</label>
              <select v-model="category" class="form-select mono">
                <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>

            <div class="form-group w-44">
              <label class="form-lbl mono">Priority *</label>
              <select v-model="priority" class="form-select mono">
                <option v-for="p in priorities" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.issueSubject') }} *</label>
            <input
              v-model="subject"
              type="text"
              class="form-input"
              placeholder="e.g. Need assistance with counter-offer for RFQ #RFQ-2026-081"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-lbl mono">{{ t('provider.issueMessage') }} *</label>
            <textarea
              v-model="message"
              rows="5"
              class="form-textarea"
              :placeholder="t('provider.issueMessage')"
              required
            ></textarea>
            <p class="form-hint mono">
              Sent as: [{{ categoryLabel }}] Â· [{{ priorityLabel }}] + your message
            </p>
          </div>

          <div class="form-actions">
            <BaseButton variant="primary" type="submit" :loading="submitting">
              <span class="material-symbols-outlined text-[16px]">send</span>
              <span>{{ t('provider.sendIssue') }}</span>
            </BaseButton>
          </div>
        </form>
      </div>

      <!-- Submitted tickets -->
      <div class="ticket-card">
        <div class="ticket-card-head">
          <h2 class="ticket-heading">My support tickets</h2>
          <p class="ticket-sub">
            {{ openTickets.length }} open Â· {{ tickets.length }} total
          </p>
        </div>

        <p v-if="loadingTickets" class="empty-note mono">{{ t('common.loading') }}</p>
        <p v-else-if="!tickets.length" class="empty-note mono">
          No tickets yet. Anything you escalate above appears here.
        </p>
        <ul v-else class="ticket-list">
          <li v-for="tk in tickets" :key="tk.id" class="ticket-row">
            <div class="ticket-row-main">
              <div class="ticket-row-head">
                <strong class="ticket-row-subject">{{ tk.subject }}</strong>
                <span class="status-chip mono" :class="tk.status === 'Closed' ? 'is-closed' : 'is-open'">
                  {{ tk.status }}
                </span>
              </div>
              <p class="ticket-row-body">{{ tk.message }}</p>
              <p v-if="tk.reply" class="ticket-row-reply">
                <span class="mono">SNUL:</span> {{ tk.reply }}
              </p>
            </div>
            <BaseButton
              v-if="tk.status !== 'Closed'"
              variant="ghost"
              class="shrink-0"
              @click="closeTicket(tk.id)"
            >
              {{ t('help.closeTicket') }}
            </BaseButton>
          </li>
        </ul>
      </div>
    </div>
  </ProviderLayout>
</template>

<style scoped>
.provider-support-view {
  width: 100%;
}

.view-header {
  margin-bottom: var(--space-5);
}

.eyebrow {
  font-size: var(--step--1);
  color: var(--wl-primary);
  font-weight: 700;
  letter-spacing: 0.05em;
  display: block;
}

.view-title {
  font-family: var(--wl-font-display);
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--wl-ink-strong);
  margin: var(--space-1) 0;
}

.view-desc {
  font-size: var(--step-0);
  color: var(--wl-muted);
  max-width: 600px;
}

/* Channels Grid */
.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.channel-card {
  display: flex;
  flex-direction: column;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  gap: var(--space-3);
  position: relative;
  transition: all 0.18s ease;
}

.channel-card:hover {
  border-color: var(--wl-border-strong);
  transform: translateY(-2px);
}

.channel-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}

.bg-blue-soft { background: var(--wl-info-soft); }
.bg-emerald-soft { background: var(--wl-success-soft); }

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-label {
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.channel-main {
  font-size: 1.25rem;
  color: var(--wl-ink-strong);
}

.channel-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: var(--space-1) 0 0;
  line-height: 1.5;
}

.btn-channel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s ease;
  margin-top: auto;
}

.btn-call {
  background: var(--wl-surface-soft);
  color: var(--wl-ink-strong);
  border: 1px solid var(--wl-border);
}
.btn-call:hover {
  background: var(--wl-border);
}

.btn-wa {
  background: var(--wl-success);
  color: #fff;
  border: 1px solid var(--wl-success);
}
.btn-wa:hover {
  background: color-mix(in srgb, var(--wl-success) 88%, black);
  border-color: color-mix(in srgb, var(--wl-success) 88%, black);
}

.btn-channel:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* Admin Oversight Notice */
.admin-notice-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--wl-warning-soft);
  border: 1px solid rgba(var(--wl-warning-rgb), 0.35);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
}

.notice-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.notice-title {
  color: color-mix(in srgb, var(--wl-warning) 65%, black);
  font-size: var(--step-0);
}

.notice-desc {
  font-size: var(--step--1);
  color: color-mix(in srgb, var(--wl-warning) 80%, black);
  line-height: 1.5;
  margin: 0;
}

/* Ticket Card */
.ticket-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.ticket-card-head {
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--wl-border);
  padding-bottom: var(--space-3);
}

.ticket-heading {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.ticket-sub {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 4px 0 0;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.flex-1 { flex: 1; }
.w-44 { width: 180px; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
}

.form-select,
.form-input,
.form-textarea {
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-textarea {
  min-height: 0;
  line-height: 1.5;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.form-select:focus-visible,
.form-input:focus-visible,
.form-textarea:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 1px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

.form-hint {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 0;
}

/* Submitted ticket list */
.ticket-card + .ticket-card {
  margin-top: var(--space-5);
}

.empty-note {
  color: var(--wl-muted);
  font-size: var(--step-0);
  margin: 0;
}

.ticket-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ticket-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  justify-content: space-between;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: var(--wl-surface-soft);
}

.ticket-row-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.ticket-row-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ticket-row-subject {
  color: var(--wl-ink-strong);
  font-size: var(--step-0);
}

.ticket-row-body,
.ticket-row-reply {
  font-size: var(--step--1);
  color: var(--wl-muted);
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ticket-row-reply {
  color: var(--wl-ink-strong);
  border-inline-start: 2px solid var(--wl-primary);
  padding-inline-start: var(--space-2);
}

.status-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--wl-border);
}

.status-chip.is-open {
  color: var(--wl-success);
  border-color: var(--wl-success);
}

.status-chip.is-closed {
  color: var(--wl-muted);
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
  .w-44 {
    width: 100%;
  }
  .channels-grid {
    grid-template-columns: 1fr;
  }
  .ticket-card {
    padding: var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .channel-card,
  .btn-channel {
    transition: none;
  }
  .channel-card:hover {
    transform: none;
  }
}
</style>
