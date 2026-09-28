import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * SNUL animation system.
 *
 * Provides a consistent, performant motion vocabulary across the platform and
 * respects `prefers-reduced-motion`. The matching CSS lives in
 * `src/assets/motion.css` — this composable only decides which class name to
 * apply and when, it never sets colours or shadows itself.
 */
export const useAnimation = () => {
  const prefersReducedMotion = ref(false)
  const isClient = ref(false)

  onMounted(() => {
    isClient.value = true
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mql.matches
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion.value = e.matches }
    mql.addEventListener?.('change', handler)
    onUnmounted(() => mql.removeEventListener?.('change', handler))
  })

  // Read reactively so duration/transition values collapse to `none` the moment
  // the user enables reduced motion, not just on first mount.
  const duration = computed(() => ({
    fast: prefersReducedMotion.value ? 0 : 120,
    base: prefersReducedMotion.value ? 0 : 180,
    slow: prefersReducedMotion.value ? 0 : 280,
  }))

  const easing = {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const stagger = (index: number, baseDelay = 40, maxItems = 16) => {
    if (prefersReducedMotion.value) return 0
    return Math.min(index % maxItems, maxItems - 1) * baseDelay
  }

  const transition = (props: string[] = ['transform', 'opacity', 'box-shadow', 'border-color']) => {
    if (prefersReducedMotion.value) return 'none'
    return props.map(p => `${p} ${duration.value.base}ms ${easing.out}`).join(', ')
  }

  return {
    prefersReducedMotion,
    isClient,
    duration,
    easing,
    stagger,
    transition,
    classes: {
      fadeIn: 'anim-fade-in',
      fadeInUp: 'anim-fade-in-up',
      scaleIn: 'anim-scale-in',
      cardHover: 'anim-card-hover',
      interactiveLift: 'interactive-lift',
      reveal: 'reveal-pending',
      move: 'anim-move',
      btnPress: 'btn-press',
      glowBrand: 'glow-brand',
    },
  }
}

/** Per-item delay values for a stagger group. */
export const useStagger = (count: number, baseDelay = 40) => {
  return computed(() => Array.from({ length: count }, (_, i) => i * baseDelay))
}

/** Reveal a single element once it scrolls into view. */
export const useReveal = (elementRef: Ref<HTMLElement | null>, options?: IntersectionObserverInit) => {
  const isVisible = ref(false)

  onMounted(() => {
    if (!elementRef.value) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          isVisible.value = true
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    )
    observer.observe(elementRef.value)
    onUnmounted(() => observer.disconnect())
  })

  return isVisible
}

/**
 * Transition classes for a <Transition name="page">.
 * SNUL defines the matching rules in main.css, so this only names them.
 */
export const usePageTransition = (name = 'page') => {
  return {
    enterActiveClass: `${name}-enter-active`,
    leaveActiveClass: `${name}-leave-active`,
    enterFromClass: `${name}-enter-from`,
    leaveToClass: `${name}-leave-to`,
    mode: 'out-in' as const,
  }
}

export const animationStyles = {
  getCardHover: () => ({
    transition:
      'transform var(--duration-fast, 120ms) var(--ease-out), ' +
      'box-shadow var(--duration-fast, 120ms) var(--ease-out), ' +
      'border-color var(--duration-fast, 120ms) var(--ease-out)',
  }) as Record<string, string>,

  getInteractiveLift: () => ({
    transition:
      'transform var(--duration-fast, 120ms) var(--ease-out), ' +
      'box-shadow var(--duration-fast, 120ms) var(--ease-out)',
  }) as Record<string, string>,

  getStaggerDelay: (index: number, base = 40, max = 16) => ({
    animationDelay: `${(index % max) * base}ms`,
  }) as Record<string, string>,
}
