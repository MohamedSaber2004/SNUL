<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { t, locale } from '../../i18n'
import { contentService } from '../../di/container'
import { toUploadPlace } from '../../application/attachment.service'
import FileUpload from '../../components/ui/FileUpload.vue'
import DataState from '../../components/ui/DataState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import BackButton from '../../components/ui/BackButton.vue'

const loading = ref(true)
const subject = ref('')
const message = ref('')
const ticketAttachment = ref<string | null>(null)
const submitting = ref(false)
const myTickets = contentService.myTickets

const searchQuery = ref('')
const statusFilter = ref('')

const filteredMyTickets = computed(() => {
  const rawList = Array.isArray(myTickets.value) ? myTickets.value : []
  let list = rawList
  if (statusFilter.value) {
    list = list.filter((tk) => tk && String(tk.status || '').toLowerCase() === String(statusFilter.value).toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter((tk) => {
      if (!tk) return false
      const sub = tk.subject ? String(tk.subject).toLowerCase().includes(q) : false
      const msg = tk.message ? String(tk.message).toLowerCase().includes(q) : false
      const rep = tk.reply ? String(tk.reply).toLowerCase().includes(q) : false
      const id = tk.id ? String(tk.id).toLowerCase().includes(q) : false
      return sub || msg || rep || id
    })
  }
  return list
})

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
}

onMounted(async () => {
  try {
    await contentService.loadMyTickets()
  } finally {
    loading.value = false
  }
})

async function create() {
  if (!subject.value.trim() || !message.value.trim()) return
  submitting.value = true
  try {
    const payloadMessage = ticketAttachment.value
      ? `${message.value.trim()}\n[attachment: ${ticketAttachment.value}]`
      : message.value.trim()
    await contentService.createTicket(subject.value.trim(), payloadMessage)
    subject.value = ''
    message.value = ''
    ticketAttachment.value = null
  } finally {
    submitting.value = false
  }
}

async function closeTicket(id: string) {
  await contentService.closeTicket(id)
}
</script>

<template>
  <div class="page-shell my-tickets-view">
    <BackButton fallback="/help" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/help">{{ t('nav.help') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('help.myTickets') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="tickets-head">
      <div>
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('help.ticketsEyebrow') }}</span>
        </div>
        <h1 class="head-title">{{ t('help.myTickets') }}</h1>
        <p class="head-subtitle">{{ t('help.myTicketsDesc') }}</p>
      </div>

      <span class="mono count-badge">{{ t('help.activeInquiries', { count: myTickets.length }) }}</span>
    </header>

    <div class="tickets-grid">
      <!-- Left Column: Submit New Ticket Form -->
      <section class="card form-card">
        <div class="form-head">
          <span class="material-symbols-outlined text-[18px] text-indigo-600">edit_note</span>
          <h2 class="form-title">{{ t('help.createTicket') }}</h2>
        </div>

        <form class="ticket-form" @submit.prevent="create">
          <div class="field-item">
            <label class="vip-field-label mono">{{ t('help.subject') }} *</label>
            <input
              v-model="subject"
              class="vip-48-input"
              :placeholder="t('help.subject')"
              required
            />
          </div>

          <div class="field-item">
            <label class="vip-field-label mono">{{ t('help.message') }} *</label>
            <textarea
              v-model="message"
              class="vip-textarea"
              rows="5"
              :placeholder="t('help.message')"
              required
            ></textarea>
          </div>

          <div class="field-item">
            <span class="vip-field-label mono">{{ t('attachment.uploadFile') }}</span>
            <FileUpload v-model="ticketAttachment" :place="toUploadPlace('ticket')" />
          </div>

          <button
            type="submit"
            :disabled="submitting || !subject.trim() || !message.trim()"
            class="btn-send-ticket mono"
          >
            <span class="material-symbols-outlined text-[18px]">send</span>
            <span>{{ submitting ? t('common.loading') : t('help.createTicket') }}</span>
          </button>
        </form>
      </section>

      <!-- Right Column: Ticket History -->
      <section class="history-column">
        <div class="history-head">
          <h2 class="history-title">{{ t('help.ticketsLedger') }}</h2>
          <span class="mono history-count">{{ t('help.ticketsCount', { count: filteredMyTickets.length }) }}</span>
        </div>

        <!-- Search & Filter Bar -->
        <div class="search-filter-bar">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              v-model="searchQuery"
              type="text"
              class="search-input mono"
              :placeholder="t('common.searchPlaceholder') + ' — ' + t('help.subject')"
            />
            <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''">
              <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          <select v-model="statusFilter" class="filter-select mono">
            <option value="">{{ t('common.all') }} {{ t('commerce.status') }}</option>
            <option value="Open">{{ t('help.open') }}</option>
            <option value="Answered">{{ t('help.answered') }}</option>
            <option value="Closed">{{ t('help.closed') }}</option>
          </select>
          <button v-if="searchQuery || statusFilter" type="button" class="clear-filters-btn mono" @click="clearFilters">
            <span class="material-symbols-outlined text-[14px]">filter_alt_off</span>
            {{ t('common.clearFilters') }}
          </button>
        </div>

        <SkeletonLoader v-if="loading" type="ticket" :count="4" />

        <DataState
          v-else
          :empty="!filteredMyTickets.length"
          :empty-title="searchQuery || statusFilter ? t('common.noResults') : t('help.noTickets')"
          :empty-description="t('help.noTicketsDesc')"
          min-height="180px"
        >
          <div class="tickets-stack">
            <article v-for="tk in filteredMyTickets" :key="tk.id" class="ticket-card">
              <div class="ticket-card-top">
                <div class="ticket-header-info">
                  <h3 class="ticket-subject">{{ tk.subject }}</h3>
                  <span class="mono ticket-date">{{ new Date(tk.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US') }}</span>
                </div>

                <div class="ticket-status-actions">
                  <span
                    class="status-pill mono"
                    :class="{
                      'status-pill--open': tk.status === 'Open',
                      'status-pill--answered': tk.status === 'Answered',
                      'status-pill--closed': tk.status === 'Closed',
                    }"
                  >
                    <span class="dot"></span>
                    <span>{{ tk.status === 'Open' ? t('help.open') : tk.status === 'Answered' ? t('help.answered') : tk.status === 'Closed' ? t('help.closed') : tk.status }}</span>
                  </span>

                  <button
                    v-if="tk.status !== 'Closed'"
                    type="button"
                    class="btn-close-ticket mono"
                    @click="closeTicket(tk.id)"
                  >
                    {{ t('help.closeTicket') }}
                  </button>
                </div>
              </div>

              <p class="ticket-body-text">{{ tk.message }}</p>

              <!-- Official Response Thread -->
              <div v-if="tk.reply" class="reply-thread-card">
                <div class="reply-head mono">
                  <span class="material-symbols-outlined text-[15px]">support_agent</span>
                  <span>{{ t('help.deskResponse') }}</span>
                </div>
                <p class="reply-body-text">{{ tk.reply }}</p>
              </div>
            </article>
          </div>
        </DataState>
      </section>
    </div>
  </div>
</template>

<style scoped>
.my-tickets-view {
  width: 100%;
}

/* ── Search & Filter Bar ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 180px;
}

.search-icon {
  position: absolute;
  inset-inline-start: 0.75rem;
  font-size: 18px;
  color: var(--wl-muted-soft);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 0 2.2rem 0 2.5rem;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input:focus {
  border-color: var(--border-focus);
  box-shadow: var(--ring-focus);
  background: var(--bg-surface);
}

.clear-btn {
  position: absolute;
  inset-inline-end: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wl-muted-soft);
  display: flex;
  align-items: center;
  padding: 0.2rem;
  border-radius: 4px;
}

.clear-btn:hover { color: var(--wl-primary); }

.filter-select {
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.filter-select:focus { border-color: var(--border-focus); box-shadow: var(--ring-focus); }

.clear-filters-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 38px;
  padding: 0 0.85rem;
  border: 1px solid var(--border-danger, #FFDAD6);
  border-radius: var(--radius-sm, 4px);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-danger, #DC3545);
  background: var(--color-danger-50, #FFF8F7);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-filters-btn:hover { background: var(--color-danger-100, #FFDAD6); }

.crumb-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-sep {
  color: var(--wl-muted-soft);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.tickets-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  letter-spacing: 0.06em;
  width: fit-content;
  margin-bottom: 0.5rem;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: 1.68rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
}

.head-subtitle {
  font-size: 13.5px;
  color: var(--wl-muted);
  margin: 0.25rem 0 0;
}

.count-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
}

/* 2-Column Responsive Grid */
.tickets-grid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: var(--wl-page-gap, 1.5rem);
  align-items: start;
}

.card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  padding: var(--wl-card-padding, 1.5rem);
  box-shadow: var(--shadow-sm);
}

/* Form Card */
.form-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--wl-border);
}

.form-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.ticket-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vip-field-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vip-48-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--wl-ink-strong);
  outline: none;
  resize: vertical;
  line-height: 1.55;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-48-input:focus,
.vip-textarea:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(105, 169, 255, 0.12);
}

.btn-send-ticket {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 48px;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px -2px rgba(105, 169, 255, 0.35);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-send-ticket:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

.btn-send-ticket:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* History Column */
.history-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.history-count {
  font-size: 11px;
  color: var(--wl-muted);
  font-weight: 700;
}

.tickets-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ticket-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-card, 8px);
  padding: var(--wl-card-padding, 1.25rem 1.5rem);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: all 0.18s ease;
}

.ticket-card:hover {
  border-color: var(--primary, #0F3D56);
  box-shadow: var(--shadow-md);
}

.ticket-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.ticket-header-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.ticket-subject {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--fg-heading, #102A43);
  margin: 0;
}

.ticket-date {
  font-size: 11px;
  color: var(--fg-muted, #627D98);
}

.ticket-status-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 11px;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-xs, 3px);
}

.status-pill .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--open {
  background: var(--color-warning-50, #FFF8E1);
  color: var(--fg-warning, #E67E22);
}
.status-pill--open .dot { background: var(--color-warning-500, #E67E22); }

.status-pill--answered {
  background: var(--color-success-50, #E8F5E9);
  color: var(--fg-success, #198754);
}
.status-pill--answered .dot { background: var(--color-success-500, #198754); }

.status-pill--closed {
  background: var(--surface-subtle, #F7F9FB);
  color: var(--fg-muted, #627D98);
}
.status-pill--closed .dot { background: var(--fg-muted, #627D98); }

.btn-close-ticket {
  border: 1px solid var(--border-danger, #FFDAD6);
  background: var(--color-danger-50, #FFF8F7);
  color: var(--fg-danger, #DC3545);
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-xs, 3px);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-close-ticket:hover {
  background: var(--wl-danger-soft);
}

.ticket-body-text {
  font-size: 13px;
  color: var(--wl-ink-soft);
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.reply-thread-card {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 12px;
  padding: 0.85rem 1.15rem;
}

.reply-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 11px;
  font-weight: 800;
  color: var(--wl-primary);
  margin-bottom: 0.35rem;
}

.reply-body-text {
  font-size: 13px;
  color: var(--wl-ink);
  line-height: 1.55;
  white-space: pre-wrap;
  margin: 0;
}

@media (max-width: 900px) {
  .tickets-grid {
    grid-template-columns: 1fr;
  }
}
</style>

