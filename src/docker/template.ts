// Template variable substitution for Docker commands

/**
 * Apply template variables to a template
 */
export function applyTemplateVariables(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, String(value));
    }
  }
  return result;
}
