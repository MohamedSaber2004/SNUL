<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import BaseModal from '../../components/ui/BaseModal.vue'
import DataState from '../../components/ui/DataState.vue'
import AppPagination from '../../components/ui/AppPagination.vue'
import { auditLogService } from '../../di/container'
import { useUserLookup } from '../../composables/useUserLookup'
import { t, locale } from '../../i18n'
import type { AuditLogDto, AuditAction } from '../../domain/models/audit-log'

const { getUserInfo, resolveLogsUsers, getRoleBadgeClass } = useUserLookup()

const filters = ref<{ entity: string; action: string; search: string }>({ entity: '', action: '', search: '' })
const selectedLog = ref<AuditLogDto | null>(null)

const ACTIONS: { value: AuditAction; labelKey: string }[] = [
  { value: 'CREATE', labelKey: 'admin.auditActionCreate' },
  { value: 'UPDATE', labelKey: 'admin.auditActionUpdate' },
  { value: 'DELETE', labelKey: 'admin.auditActionDelete' },
  { value: 'APPROVE', labelKey: 'admin.auditActionApprove' },
  { value: 'REJECT', labelKey: 'admin.auditActionReject' },
  { value: 'LOGIN', labelKey: 'admin.auditActionLogin' },
  { value: 'LOGOUT', labelKey: 'admin.auditActionLogout' },
  { value: 'STATUS_CHANGE', labelKey: 'admin.auditActionStatusChange' },
  { value: 'UPLOAD', labelKey: 'admin.auditActionUpload' },
  { value: 'DOWNLOAD', labelKey: 'admin.auditActionDownload' },
  { value: 'ASSIGN', labelKey: 'admin.auditActionAssign' },
]

const ENTITY_TYPES = ['Product', 'Category', 'Order', 'RFQ', 'Quote', 'User', 'Company', 'Certification', 'Document', 'Ticket', 'Cart', 'Address', 'DistributorApplication']

const localPage = ref(1)
const localPageSize = 15

const filteredLogs = computed(() => {
  const rawList = Array.isArray(auditLogService.logs.value) ? auditLogService.logs.value : []
  let list = rawList
  if (filters.value.entity) {
    list = list.filter((l) => l && l.entityName === filters.value.entity)
  }
  if (filters.value.action) {
    list = list.filter((l) => l && l.action === filters.value.action)
  }
  if (filters.value.search.trim()) {
    const q = filters.value.search.trim().toLowerCase()
    list = list.filter((l) => {
      if (!l) return false
      const user = getUserInfo(l.performedById || l.performedBy)
      const entity = l.entityName ? String(l.entityName).toLowerCase().includes(q) : false
      const action = l.action ? String(l.action).toLowerCase().includes(q) : false
      const ip = l.ipAddress ? String(l.ipAddress).toLowerCase().includes(q) : false
      const uName = user?.name ? String(user.name).toLowerCase().includes(q) : false
      const uRole = user?.role ? String(user.role).toLowerCase().includes(q) : false
      let detailsMatch = false
      try {
        if (l.details) detailsMatch = JSON.stringify(l.details).toLowerCase().includes(q)
      } catch {
        detailsMatch = false
      }
      return entity || action || ip || uName || uRole || detailsMatch
    })
  }
  return list
})

/* ── Filter state UX: answer-back count, one-click reset, empty recovery ── */
const hasActiveFilters = computed(() => !!(filters.value.entity || filters.value.action || filters.value.search.trim()))
const activeFilterCount = computed(() =>
  [filters.value.entity, filters.value.action, filters.value.search.trim()].filter(Boolean).length,
)
const totalLoaded = computed(() => (Array.isArray(auditLogService.logs.value) ? auditLogService.logs.value.length : 0))

function clearFilters() {
  filters.value = { entity: '', action: '', search: '' }
}

function clearSearch() {
  filters.value.search = ''
}

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / localPageSize)))
const paginatedLogs = computed(() => {
  const start = (localPage.value - 1) * localPageSize
  return filteredLogs.value.slice(start, start + localPageSize)
})
const isEmpty = computed(() => !auditLogService.loading.value && filteredLogs.value.length === 0 && !auditLogService.error.value)
const isLoading = computed(() => auditLogService.loading.value)
const isError = computed(() => auditLogService.error.value ?? undefined)

async function loadLogs() {
  await auditLogService.loadLogs({ pageNumber: 1, pageSize: 50 } as never)
  if (auditLogService.logs.value.length > 0) {
    void resolveLogsUsers(auditLogService.logs.value)
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(locale.value === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function openDetails(log: AuditLogDto) {
  selectedLog.value = log
}

function closeDetails() {
  selectedLog.value = null
}

function actionLabel(action: string): string {
  const found = ACTIONS.find((a) => a.value === action)
  return found ? t(found.labelKey as never) : action
}

function actionBadgeClass(action: string): string {
  const map: Record<string, string> = {
    CREATE: 'action-badge--teal',
    UPDATE: 'action-badge--indigo',
    DELETE: 'action-badge--rose',
    APPROVE: 'action-badge--emerald',
    REJECT: 'action-badge--rose',
    LOGIN: 'action-badge--amber',
    LOGOUT: 'action-badge--slate',
    STATUS_CHANGE: 'action-badge--indigo',
    UPLOAD: 'action-badge--teal',
    DOWNLOAD: 'action-badge--slate',
    ASSIGN: 'action-badge--amber',
  }
  return map[action] ?? 'action-badge--slate'
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  localPage.value = p
}

// Payload snapshots may embed raw database identifiers — mask any
// GUID-shaped value so no internal IDs are shown to viewers.
const maskedDetails = computed(() => {
  const details = selectedLog.value?.details
  if (!details) return ''
  return details.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '••••••••',
  )
})

onMounted(() => void loadLogs())
watch([() => filters.value.entity, () => filters.value.action, () => filters.value.search], () => {
  localPage.value = 1
})
</script>

<template>
  <AdminLayout>
    <div class="audit-view">
      <!-- Executive Header -->
      <header class="audit-head">
        <div>
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>{{ t('admin.auditLedgerEyebrow') }}</span>
          </div>
          <h1 class="head-title">{{ t('admin.auditLogs') }}</h1>
          <p class="head-subtitle">{{ t('admin.auditLogsDesc') }}</p>
        </div>

        <div class="head-actions">
          <span class="mono count-badge" role="status">
            {{ t('common.showing') }} {{ filteredLogs.length }} / {{ totalLoaded }}
          </span>
        </div>
      </header>

      <!-- Search & Filter Bar (admin-wide pattern: one row, no labels, 38px controls) -->
      <div class="search-filter-bar" role="search" :aria-label="t('admin.auditFilter')">
        <div class="search-wrap">
          <span class="material-symbols-outlined search-icon" aria-hidden="true">search</span>
          <input
            v-model="filters.search"
            type="search"
            class="search-input"
            :placeholder="t('admin.auditSearchPlaceholder')"
            :aria-label="t('admin.auditFilter')"
            autocomplete="off"
          />
          <button
            v-if="filters.search"
            type="button"
            class="clear-btn"
            :aria-label="t('common.clearInput')"
            @click="clearSearch"
          >
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
          </button>
        </div>
        <select v-model="filters.entity" class="filter-select mono" :aria-label="t('admin.auditEntity')">
          <option value="">{{ t('admin.auditAllEntities') }}</option>
          <option v-for="e in ENTITY_TYPES" :key="e" :value="e">{{ e }}</option>
        </select>
        <select v-model="filters.action" class="filter-select mono" :aria-label="t('admin.auditAction')">
          <option value="">{{ t('admin.auditAllActions') }}</option>
          <option v-for="a in ACTIONS" :key="a.value" :value="a.value">{{ t(a.labelKey as never) }}</option>
        </select>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="clear-filters-btn mono"
          @click="clearFilters"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">filter_alt_off</span>
          <span>{{ t('common.clearFilters') }}</span>
          <span class="clear-filters-count" aria-hidden="true">{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- Executive Data Table -->
      <DataState
        :loading="isLoading"
        :error="isError"
        :empty="isEmpty"
        :empty-title="hasActiveFilters ? t('common.noResults') : t('admin.auditNoLogs')"
        :empty-description="hasActiveFilters ? t('admin.auditSearchPlaceholder') : t('admin.auditNoLogsDesc')"
        :action-text="hasActiveFilters ? t('common.clearFilters') : undefined"
        skeleton-type="table"
        :skeleton-count="6"
        min-height="320px"
        @retry="loadLogs"
        @action="clearFilters"
      >
        <div class="table-card">
          <div class="table-wrap">
            <table class="exec-table">
              <thead>
                <tr>
                  <th>{{ t('admin.auditTimestamp') }}</th>
                  <th>{{ t('admin.auditEntity') }}</th>
                  <th>{{ t('admin.auditAction') }}</th>
                  <th>{{ t('admin.auditPerformedBy') }}</th>
                  <th class="text-end">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in paginatedLogs" :key="log.id" class="exec-row">
                  <td class="mono text-xs text-slate-500">{{ formatTime(log.createdAt) }}</td>
                  <td>
                    <span class="entity-pill mono">{{ log.entityName }}</span>
                  </td>
                  <td>
                    <span class="action-badge mono" :class="actionBadgeClass(log.action)">
                      {{ actionLabel(log.action) }}
                    </span>
                  </td>
                  <td>
                    <div class="actor-cell">
                      <div class="actor-top">
                        <strong class="actor-name">{{ getUserInfo(log.performedById || log.performedBy).name }}</strong>
                        <span
                          class="actor-role mono"
                          :class="getRoleBadgeClass(getUserInfo(log.performedById || log.performedBy).roleKey)"
                        >
                          {{ getUserInfo(log.performedById || log.performedBy).role }}
                        </span>
                      </div>
                      <span v-if="log.ipAddress" class="actor-ip mono">{{ log.ipAddress }}</span>
                    </div>
                  </td>
                  <td class="text-end">
                    <div class="row-actions">
                      <button
                        type="button"
                        class="row-action-btn"
                        :title="t('admin.viewDetails')"
                        :aria-label="t('admin.viewDetails')"
                        @click="openDetails(log)"
                      >
                        <span class="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Integrated Pagination -->
          <AppPagination
            :page="localPage"
            :total-pages="totalPages"
            :total-items="filteredLogs.length"
            :page-size="localPageSize"
            variant="table"
            @change="goPage"
          />
        </div>
      </DataState>

      <!-- Details Modal -->
      <BaseModal
        :model-value="!!selectedLog"
        :title="t('admin.auditLogs')"
        max-width="640px"
        @update:model-value="(v: boolean) => { if (!v) closeDetails() }"
      >
        <div v-if="selectedLog" class="modal-detail-stack">
          <div class="detail-grid mono">
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditEntity') }}</span>
              <strong class="detail-v">{{ selectedLog.entityName }}</strong>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditAction') }}</span>
              <span class="action-badge mono" :class="actionBadgeClass(selectedLog.action)">
                {{ actionLabel(selectedLog.action) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditTimestamp') }}</span>
              <span class="detail-v">{{ formatTime(selectedLog.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-k">{{ t('admin.auditPerformedBy') }}</span>
              <span class="detail-v">{{ getUserInfo(selectedLog.performedById || selectedLog.performedBy).name }}</span>
            </div>
          </div>

          <div v-if="maskedDetails" class="detail-code-block">
            <span class="detail-code-label mono">{{ t('admin.payloadSnapshot') }}</span>
            <pre class="detail-pre mono">{{ maskedDetails }}</pre>
          </div>
        </div>
      </BaseModal>
    </div>
  </AdminLayout>
</template>

<style scoped>
.audit-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.audit-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

/* ── Search & Filter Bar (admin-wide pattern: bare row, 38px controls) ── */
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
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

.clear-btn:hover { color: var(--brand); }
.clear-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 1px;
}

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
.clear-filters-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.clear-filters-count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 9999px;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

/* ── Head Actions ── */
.head-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.count-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .search-input,
  .filter-select,
  .clear-filters-btn,
  .exec-row {
    transition: none;
  }
}

/* Executive Table */
.table-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--wl-shadow-card);
}

.table-wrap {
  overflow-x: auto;
}

.exec-table {
  width: 100%;
  border-collapse: collapse;
  text-align: start;
}

.exec-table thead th {
  background: var(--wl-surface-soft);
  border-bottom: 1px solid var(--wl-border);
  padding: 0.85rem 1.25rem;
  font-family: var(--wl-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.exec-row {
  height: 52px;
  border-bottom: 1px solid var(--wl-border);
  transition: background 0.15s ease;
}

.exec-row:hover {
  background: var(--wl-surface-soft);
}

.exec-row td {
  padding: 0.65rem 1.25rem;
  vertical-align: middle;
}

.entity-pill {
  font-size: 11px;
  font-weight: 700;
  color: var(--wl-ink-strong);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.action-badge {
  display: inline-flex;
  font-size: 10px;
  font-weight: 800;
  padding: 0.18rem 0.5rem;
  border-radius: 9999px;
  letter-spacing: 0.04em;
}

.action-badge--indigo { background: var(--wl-primary-soft); color: var(--wl-primary); }
.action-badge--teal { background: var(--wl-primary-faint); color: var(--wl-primary); }
.action-badge--emerald { background: var(--wl-success-faint); color: var(--wl-success); }
.action-badge--amber { background: var(--wl-warning-faint); color: var(--wl-warning); }
.action-badge--rose { background: var(--wl-danger-faint); color: var(--wl-danger); }
.action-badge--slate { background: var(--wl-surface-soft); color: var(--wl-ink-soft); }

.actor-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.actor-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.actor-name {
  font-size: 13px;
  color: var(--wl-ink-strong);
}

.actor-role {
  font-size: 9.5px;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.actor-ip {
  font-size: 10.5px;
  color: var(--wl-muted);
}

.role-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  display: inline-block;
}

.role-badge--admin {
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  border: 1px solid var(--wl-primary-ring);
}

.role-badge--staff {
  background: var(--wl-success-faint);
  color: var(--wl-success);
  border: 1px solid var(--wl-success-border);
}

.role-badge--org {
  background: var(--wl-warning-faint);
  color: var(--wl-warning);
  border: 1px solid var(--wl-warning-border);
}

.role-badge--system {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
}

.role-badge--default {
  background: var(--wl-surface-soft);
  color: var(--wl-muted);
  border: 1px solid var(--wl-border);
}

.text-end {
  text-align: end;
}

/* Modal Detail Stack */
.modal-detail-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: var(--wl-surface-soft);
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--wl-border);
}

.detail-k {
  font-size: 10px;
  color: var(--wl-muted);
}

.detail-v {
  font-size: 12px;
  color: var(--wl-ink-strong);
}

.detail-code-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.detail-code-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--wl-muted);
}

.detail-pre {
  background: var(--wl-surface-card);
  color: var(--wl-text);
  border: 1px solid var(--wl-border);
  padding: 1rem;
  border-radius: 10px;
  font-size: 11.5px;
  overflow-x: auto;
  max-height: 280px;
}

@media (max-width: 640px) {
  .search-wrap {
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>
