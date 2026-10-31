import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as welcomeTemplate } from './welcome'
import { template as lowCreditTemplate } from './low-credit'
import { template as weeklyDigestTemplate } from './weekly-digest'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcomeTemplate,
  'low-credit': lowCreditTemplate,
  'weekly-digest': weeklyDigestTemplate,
}
