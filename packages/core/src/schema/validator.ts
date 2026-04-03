import { prisma } from '../db.js';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates entry data against the content type's field definitions.
 * Returns array of errors (empty = valid).
 */
export async function validateEntryData(
  contentTypeId: string,
  data: Record<string, unknown>,
): Promise<ValidationError[]> {
  const fields = await prisma.field.findMany({
    where: { contentTypeId },
    orderBy: { sortOrder: 'asc' },
  });

  const errors: ValidationError[] = [];

  for (const field of fields) {
    const value = data[field.key];

    // Required check
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.key, message: `${field.name} is required` });
      continue;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null) continue;

    // Type checks
    switch (field.type) {
      case 'text':
      case 'slug':
        if (typeof value !== 'string') {
          errors.push({ field: field.key, message: `${field.name} must be a string` });
        } else {
          const validations = field.validations as Record<string, number> | null;
          if (validations?.minLength && value.length < validations.minLength) {
            errors.push({ field: field.key, message: `${field.name} must be at least ${validations.minLength} characters` });
          }
          if (validations?.maxLength && value.length > validations.maxLength) {
            errors.push({ field: field.key, message: `${field.name} must be at most ${validations.maxLength} characters` });
          }
          if (field.type === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
            errors.push({ field: field.key, message: `${field.name} must be a valid slug (lowercase, hyphens only)` });
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          errors.push({ field: field.key, message: `${field.name} must be a number` });
        } else {
          const validations = field.validations as Record<string, number> | null;
          if (validations?.min !== undefined && value < validations.min) {
            errors.push({ field: field.key, message: `${field.name} must be at least ${validations.min}` });
          }
          if (validations?.max !== undefined && value > validations.max) {
            errors.push({ field: field.key, message: `${field.name} must be at most ${validations.max}` });
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field: field.key, message: `${field.name} must be a boolean` });
        }
        break;

      case 'date':
        if (typeof value !== 'string' || isNaN(new Date(value).getTime())) {
          errors.push({ field: field.key, message: `${field.name} must be a valid ISO date string` });
        }
        break;

      case 'enum':
        if (field.enumValues) {
          const allowed = field.enumValues as string[];
          if (!allowed.includes(value as string)) {
            errors.push({ field: field.key, message: `${field.name} must be one of: ${allowed.join(', ')}` });
          }
        }
        break;

      case 'richtext':
        if (!Array.isArray(value)) {
          errors.push({ field: field.key, message: `${field.name} must be an array of blocks` });
        }
        break;

      case 'json':
        if (typeof value !== 'object') {
          errors.push({ field: field.key, message: `${field.name} must be a JSON object` });
        }
        break;

      case 'media':
      case 'reference':
        if (typeof value !== 'string') {
          errors.push({ field: field.key, message: `${field.name} must be a string (ID reference)` });
        }
        break;
    }
  }

  return errors;
}

/**
 * Validates that all required fields are present before publishing.
 */
export async function validateForPublish(
  contentTypeId: string,
  data: Record<string, unknown>,
): Promise<ValidationError[]> {
  return validateEntryData(contentTypeId, data);
}
