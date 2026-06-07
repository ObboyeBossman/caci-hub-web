// src/modules/services/services/serviceService.ts
// Orchestrates multi-step operations like generating recurring services.

import { RepositoryError } from '../../../types/common.types'
import {
  getServiceTemplate,
  createService,
} from '../repository'
import type { ServiceWithTemplate } from '../../../types/service.types'

/**
 * Instantiates a single service record from a template for a given date.
 */
export async function createServiceFromTemplate(
  templateId: string,
  serviceDate: string
): Promise<ServiceWithTemplate> {
  const template = await getServiceTemplate(templateId)
  
  if (!template.is_active) {
    throw new RepositoryError('Cannot create service from an inactive template.', null, 'INVALID_STATE')
  }

  return createService({
    template_id:  template.id,
    group_id:     template.group_id,
    title:        template.title,
    service_type: template.service_type,
    service_date: serviceDate,
    start_time:   template.start_time,
    venue:        template.venue,
    status:       'scheduled',
  })
}

/**
 * Future expansion: generates multiple recurring instances ahead of time.
 * For now, this is a placeholder stub.
 */
export async function generateRecurringServices(
  templateId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  console.warn('[serviceService] generateRecurringServices is a stub:', { templateId, fromDate, toDate })
  // Implementation will depend on calculating recurrences locally or via Edge Function
}
