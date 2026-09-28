<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { t, locale } from '../i18n'
import { contentRepository } from '../di/container'
import type { LandingPageDto } from '../domain/models/content'
import BackButton from '../components/ui/BackButton.vue'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import { useSiteLogo } from '../composables/useSiteLogo'

const { logoUrl: siteLogoUrl, altText: siteLogoAlt } = useSiteLogo()
const aboutPage = ref<LandingPageDto | null>(null)
const loading = ref(true)
const FOUNDING_YEAR = 1994

onMounted(async () => {
  loading.value = true
  try {
    const page = await contentRepository.getLandingPageBySlug('about-us')
    if (page && page.isActive !== false) {
      aboutPage.value = page
    }
  } catch {
    // Non-blocking fallback to i18n
  } finally {
    loading.value = false
  }
})

const heroTitle = computed(() => aboutPage.value?.heroTitle || t('home.aboutTitle'))
const heroBody = computed(() => aboutPage.value?.heroBody || t('home.aboutBody'))

const storyParagraphs = computed(() => {
  if (aboutPage.value?.contentBlock) {
    const split = aboutPage.value.contentBlock
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (split.length > 0) return split
  }
  return null
})

const yearsOfExperience = computed(() => `${new Date().getFullYear() - FOUNDING_YEAR}+`)

const pillars = computed(() => [
  {
    icon: 'precision_manufacturing',
    title: t('about.mfgTitle'),
    desc: t('about.mfgDesc'),
    badge: 'AISI 410 / 420',
  },
  {
    icon: 'verified',
    title: t('about.qualityTitle'),
    desc: t('about.qualityDesc'),
    badge: 'ISO 13485 · CE MDR',
  },
  {
    icon: 'public',
    title: t('about.globalTitle'),
    desc: t('about.globalDesc'),
    badge: locale.value === 'ar' ? '+40 دولة' : '40+ COUNTRIES',
  },
  {
    icon: 'token',
    title: t('about.oemTitle'),
    desc: t('about.oemDesc'),
    badge: locale.value === 'ar' ? 'UDI مخصص' : 'CUSTOM UDI',
  },
])
</script>

<template>
  <div class="page-shell about-view">
    <BackButton fallback="/" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('nav.about') }}</span>
    </nav>

    <!-- Loading State -->
    <div v-if="loading" class="about-loading-wrap">
      <SkeletonLoader type="about" />
    </div>

    <template v-else>
      <!-- Hero Section -->
      <header class="about-hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="head-chip mono">
              <span class="pulse-dot"></span>
              <span>{{ t('home.aboutEyebrow') }}</span>
            </div>

            <h1 class="hero-title">{{ heroTitle }}</h1>
            <p class="hero-desc">{{ heroBody }}</p>

            <div class="hero-badges mono">
              <div class="hero-badge">
                <span class="material-symbols-outlined text-[16px] text-[var(--wl-success)]">verified</span>
                <span>{{ t('about.statCerts') }}</span>
              </div>
              <div class="hero-badge">
                <span class="material-symbols-outlined text-[16px] text-[var(--wl-primary)]">history_edu</span>
                <span>{{ t('about.statYears') }}</span>
              </div>
              <div class="hero-badge">
                <span class="material-symbols-outlined text-[16px] text-[var(--wl-primary)]">public</span>
                <span>{{ t('about.statGlobal') }}</span>
              </div>
            </div>
          </div>

          <div class="hero-media-card">
            <div class="media-frame">
              <img v-if="siteLogoUrl" :src="siteLogoUrl" :alt="siteLogoAlt" class="media-img" loading="eager" />
              <div v-else class="no-logo-placeholder">
                <span class="material-symbols-outlined no-logo-icon">image_not_supported</span>
                <span class="no-logo-text mono">{{ locale === 'ar' ? 'لم يتم تعيين صورة بعد' : 'No image set yet' }}</span>
              </div>
              <div class="media-overlay">
                <span class="mono media-tag">DIRECT METALLURGY</span>
                <span class="mono media-badge">{{ yearsOfExperience }} · {{ t('about.statEst') }}</span>
              </div>
            </div>
            <div class="media-caption mono">
              <span>Lot-Stamped · High-Chromium Martensitic Alloys</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Stats Strip -->
      <section class="stats-strip" aria-label="Key Performance Indicators">
        <div class="stat-cell">
          <span class="stat-num mono">1994</span>
          <span class="stat-lbl mono">{{ t('about.statEst') }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-cell">
          <span class="stat-num mono">{{ yearsOfExperience }}</span>
          <span class="stat-lbl mono">{{ t('about.statYears') }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-cell">
          <span class="stat-num mono">ISO 13485</span>
          <span class="stat-lbl mono">CE MDR CLASS IIa</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-cell">
          <span class="stat-num mono">40+</span>
          <span class="stat-lbl mono">{{ t('about.statGlobal') }}</span>
        </div>
      </section>

      <!-- Story Section -->
      <section class="about-section story-section">
        <div class="story-card">
          <div class="section-head">
            <div class="head-chip mono">
              <span class="pulse-dot"></span>
              <span>HERITAGE & CAPABILITY</span>
            </div>
            <h2 class="section-title">{{ t('about.ourStory') }}</h2>
          </div>

          <div class="story-content">
            <template v-if="storyParagraphs">
              <p v-for="(p, idx) in storyParagraphs" :key="idx" class="story-paragraph">
                {{ p }}
              </p>
            </template>
            <template v-else>
              <p class="story-paragraph">
                {{ locale === 'ar'
                  ? 'منذ انطلاق سنول (SNUL)، ارتبط اسمنا بالدقة الجراحية والمصنعية الطبية العالية. بدأنا كمنظومة متخصصة في توفير وتوريد حلول الفولاذ الطبي المقاوم للصدأ، واليوم نوفر أدوات جراحية متقدمة لأكثر من 40 دولة عبر شراكات موثوقة مع المستشفيات والمراكز الجراحية والموزعين المعتمدين.'
                  : 'Founded in 1994, SNUL was established on a single principle: surgical instruments must be measured in microns and built for lifelong clinical endurance. What began as an artisan medical metallurgy workshop has grown into a state-of-the-art instrument manufacturing and supply enterprise trusted across 40+ countries.'
                }}
              </p>
              <p class="story-paragraph">
                {{ locale === 'ar'
                  ? 'يخضع كل طقم وأداة جراحية لرقابة صارمة في كل مرحلة: من اختبار سبائك الفولاذ المارتنزيتي عالي الكروم (AISI 410 و AISI 420)، مروراً بالتفريز الدقيق والمعالجة الحرارية، وصولاً إلى الخمول الكيميائي ASTM A967 والتعقيم النهائي بالليزر وفق معايير التتبع الدولية UDI.'
                  : 'Every instrument undergoes rigorous multi-point validation: from vacuum-controlled heat treatment and sub-zero cryogenic quenching, to micro-tolerance artisan hand-grinding, ASTM A967 chemical passivation, and GS1-compliant UDI laser engraving.'
                }}
              </p>
              <p class="story-paragraph">
                {{ locale === 'ar'
                  ? 'تتيح لنا قدراتنا التصنيعية والتوريدية المباشرة تقديم حلول العلامة الخاصة (OEM) وتوفير أسعار عادلة ومباشرة للمؤسسات الصحية دون وسطاء، مع ملفات توثيق فني واعتمادات كاملة لكل شحنة.'
                  : 'By maintaining direct control over forging, machining, and cleanroom quality inspection, SNUL eliminates unnecessary intermediary margins, guarantees predictable dispatch timelines, and provides complete regulatory dossiers for every delivery batch.'
                }}
              </p>
            </template>
          </div>
        </div>
      </section>

      <!-- Clinical Foundations / Pillars Grid -->
      <section class="about-section pillars-section">
        <div class="section-head text-center">
          <div class="head-chip mono">
            <span class="pulse-dot"></span>
            <span>MANUFACTURING STANDARDS</span>
          </div>
          <h2 class="section-title">{{ t('about.pillarsTitle') }}</h2>
        </div>

        <div class="pillars-grid">
          <article v-for="(pillar, idx) in pillars" :key="idx" class="pillar-card">
            <div class="pillar-card__top">
              <div class="pillar-icon-box">
                <span class="material-symbols-outlined text-[24px]">{{ pillar.icon }}</span>
              </div>
              <span class="mono pillar-badge">{{ pillar.badge }}</span>
            </div>
            <h3 class="pillar-title">{{ pillar.title }}</h3>
            <p class="pillar-desc">{{ pillar.desc }}</p>
          </article>
        </div>
      </section>

      <!-- Teasers & Cross-Links Row -->
      <section class="about-section cross-links-section">
        <div class="cross-grid">
          <!-- Certifications Teaser -->
          <div class="cross-card">
            <div class="cross-card__head">
              <span class="material-symbols-outlined cross-icon text-emerald-500">verified</span>
              <div>
                <span class="mono cross-tag">REGULATORY DOSSIERS</span>
                <h3 class="cross-title">{{ t('about.exploreCerts') }}</h3>
              </div>
            </div>
            <p class="cross-desc">
              {{ locale === 'ar'
                ? 'اطّلع على شهادات الجودة الرسمية، تراخيص ISO 13485:2016، ومطابقة التوجيهات الأوروبية CE MDR للأجهزة الطبية.'
                : 'Inspect active regulatory dossiers, ISO 13485:2016 certificates, and CE MDR declarations of conformity.'
              }}
            </p>
            <router-link to="/certifications" class="cross-link">
              <span>{{ t('about.exploreCerts') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
          </div>

          <!-- OEM Teaser -->
          <div class="cross-card">
            <div class="cross-card__head">
              <span class="material-symbols-outlined cross-icon text-indigo-500">precision_manufacturing</span>
              <div>
                <span class="mono cross-tag">{{ locale === 'ar' ? 'تشغيل معادن مخصص' : 'CUSTOM METALLURGY' }}</span>
                <h3 class="cross-title">{{ t('about.exploreOem') }}</h3>
              </div>
            </div>
            <p class="cross-desc">
              {{ locale === 'ar'
                ? 'خدمات التصنيع المخصص، النقش بالليزر بعلامتك التجارية، وتجهيز أطقم جراحية كاملة بعبوات معقمة جاهزة.'
                : 'Custom private-label production, tailored CAD geometry, tungsten carbide brazing, and customized laser etching.'
              }}
            </p>
            <router-link to="/oem" class="cross-link">
              <span>{{ t('about.exploreOem') }}</span>
              <span class="icon--directional">→</span>
            </router-link>
          </div>
        </div>
      </section>

      <!-- CTA Bottom Banner -->
      <section class="about-cta-banner">
        <div class="cta-inner">
          <div class="cta-copy">
            <span class="mono cta-eyebrow">{{ locale === 'ar' ? 'التوريد والتوزيع الطبي السريري' : 'CLINICAL PROCUREMENT & DISTRIBUTION' }}</span>
            <h2 class="cta-title">
              {{ locale === 'ar'
                ? 'جاهز لتجهيز منشأتك الصحية بأدوات جراحية معتمدة؟'
                : 'Ready to equip your surgical theatre or clinical distribution network?'
              }}
            </h2>
            <p class="cta-desc">
              {{ locale === 'ar'
                ? 'تصفح الكتالوج الكامل، اطلب تسعيراً مؤسسياً فورياً، أو تواصل مع مكتب التجارة والتوريد الجراحي.'
                : 'Browse our complete instrument catalog, submit an institutional RFQ, or speak directly with our clinical supply desk.'
              }}
            </p>
          </div>

          <div class="cta-actions">
            <router-link to="/marketplace" class="btn btn-primary">
              <span class="material-symbols-outlined text-[18px]">inventory_2</span>
              <span>{{ t('about.browseCatalog') }}</span>
            </router-link>
            <router-link to="/help" class="btn btn-secondary">
              <span class="material-symbols-outlined text-[18px]">support_agent</span>
              <span>{{ t('about.contactSupport') }}</span>
            </router-link>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.about-view {
  display: flex;
  flex-direction: column;
  gap: var(--wl-section-gap, 2.5rem);
}

.about-loading-wrap {
  padding: 3rem 0;
}

/* Breadcrumb */
.crumb-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
  letter-spacing: 0.04em;
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-bar a:active:not(:disabled) {
  color: var(--wl-primary-hover);
}

.crumb-bar a:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.crumb-bar a:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.crumb-bar a[aria-busy="true"] {
  pointer-events: none;
}

.crumb-sep {
  color: var(--wl-border-strong);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

/* Hero Section */
.about-hero {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.about-hero::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: var(--space-8);
  align-items: center;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-gold);
  background: var(--wl-gold-soft);
  border: 1px solid rgba(255, 209, 102, 0.35);
  padding: 0.25rem 0.65rem;
  border-radius: var(--radius-pill);
  letter-spacing: 0.06em;
  width: fit-content;
  text-shadow: var(--wl-gold-text-shadow);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-gold);
  box-shadow: var(--wl-gold-glow-soft);
}

.hero-title {
  font-family: var(--wl-font-display);
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  font-weight: 800;
  letter-spacing: -0.028em;
  line-height: 1.12;
  margin: 0;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.hero-desc {
  font-size: var(--step-0);
  line-height: 1.65;
  color: var(--wl-text-secondary);
  margin: 0;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: 0.5rem;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-ink);
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-md);
}

/* Media Card */
.hero-media-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.media-frame {
  position: relative;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.media-img {
  max-width: 100%;
  max-height: 140px;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.no-logo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem 2.5rem;
  text-align: center;
  color: var(--wl-muted, #94a3b8);
  width: 100%;
  min-height: 140px;
}
.no-logo-icon {
  font-size: 2.5rem !important;
  opacity: 0.75;
}
.no-logo-text {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  opacity: 0.9;
}

.media-overlay {
  position: absolute;
  bottom: 10px;
  inset-inline: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.media-tag {
  color: var(--wl-muted);
}

.media-badge {
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-sm);
}

.media-caption {
  font-size: var(--step--1);
  color: var(--wl-muted);
  text-align: center;
  letter-spacing: 0.04em;
}

/* Stats Strip */
.stats-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-card);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.25rem;
}

.stat-num {
  font-size: var(--step-3);
  font-weight: 800;
  color: var(--wl-ink-strong);
  letter-spacing: -0.02em;
}

.stat-lbl {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.stat-divider {
  width: 1px;
  height: 36px;
  background: var(--wl-border);
}

/* Story Section */
.story-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.story-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.story-paragraph {
  font-size: var(--step-0);
  line-height: 1.75;
  color: var(--wl-ink);
  margin: 0;
  text-wrap: pretty;
}

/* Section Head */
.section-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-head.text-center {
  align-items: center;
  text-align: center;
}

.section-title {
  font-family: var(--wl-font-display);
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--wl-gold-text);
  text-shadow: var(--wl-gold-text-shadow);
}

/* Pillars Grid */
.pillars-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.pillar-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.pillar-card:hover {
  transform: translateY(-2px);
  border-color: var(--wl-primary);
  box-shadow: var(--shadow-hover);
}

.pillar-card:active:not(:disabled) {
  transform: translateY(-1px);
}

.pillar-card:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.pillar-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none !important;
}

.pillar-card[aria-busy="true"] {
  pointer-events: none;
}

.pillar-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pillar-icon-box {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
}

.pillar-badge {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-muted);
  background: var(--wl-surface-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.pillar-title {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
}

.pillar-desc {
  font-size: var(--step--1);
  line-height: 1.55;
  color: var(--wl-muted);
  margin: 0;
}

/* Cross-links Teasers */
.cross-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.cross-card {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-card);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.cross-card:hover {
  border-color: var(--wl-border-strong);
  box-shadow: var(--shadow-hover);
}

.cross-card__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cross-icon {
  font-size: 32px;
}

.cross-tag {
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--wl-muted);
  display: block;
}

.cross-title {
  font-size: var(--step-1);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0.15rem 0 0;
}

.cross-desc {
  font-size: var(--step-0);
  line-height: 1.6;
  color: var(--wl-text-secondary);
  margin: 0;
  flex: 1;
}

.cross-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  text-decoration: none;
  margin-top: 0.5rem;
  transition: gap 0.15s ease;
}

.cross-link:hover {
  gap: 0.65rem;
}

.cross-link:active:not(:disabled) {
  gap: 0.45rem;
}

.cross-link:focus-visible {
  outline: none;
  box-shadow: var(--wl-focus-ring);
}

.cross-link:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cross-link[aria-busy="true"] {
  pointer-events: none;
}

/* CTA Bottom Banner */
.about-cta-banner {
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}

.about-cta-banner::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--wl-laser-sweep);
}

.cta-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.cta-copy {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-width: 640px;
}

.cta-eyebrow {
  font-size: var(--step--1);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--wl-gold);
  text-shadow: var(--wl-gold-text-shadow);
}

.cta-title {
  font-family: var(--wl-font-display);
  font-size: var(--step-2);
  font-weight: 800;
  margin: 0;
  line-height: 1.25;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: var(--wl-gold-text-filter);
}

.cta-desc {
  font-size: var(--step-0);
  line-height: 1.6;
  color: var(--wl-text-secondary);
  margin: 0;
}

.cta-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 1024px) {
  .hero-grid {
    grid-template-columns: 1fr;
    justify-items: center;
  }
  .hero-copy {
    align-items: center;
    text-align: center;
  }
  .head-chip {
    margin-inline: auto;
  }
  .hero-badges {
    justify-content: center;
  }
  .hero-media-card {
    max-width: 540px;
    width: 100%;
    margin-inline: auto;
  }
  .media-caption {
    text-align: center;
  }
  .pillars-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .section-head {
    align-items: center;
    text-align: center;
  }
  .section-head .head-chip {
    margin-inline: auto;
  }
  .section-head .section-title {
    text-align: center;
  }
  .story-content {
    text-align: center;
  }
  .cross-grid {
    grid-template-columns: 1fr;
  }
  .stats-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
  .stat-divider {
    display: none;
  }
  .cta-inner {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .cta-actions {
    width: 100%;
    justify-content: center;
  }
  .cta-actions .btn {
    flex: 1;
  }
}

@media (max-width: 520px) {
  .pillars-grid {
    grid-template-columns: 1fr;
  }
  .about-hero, .story-card, .about-cta-banner {
    padding: var(--space-4);
  }
}
</style>
