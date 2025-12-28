import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '@n9n/shared';

@Injectable()
export class ContextService {
  /**
   * Interpolate template string with variables
   * Example: "Hello {{variables.name}}" -> "Hello John"
   */
  interpolate(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getValueByPath(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Evaluate expression against context
   * Example: "variables.selectedOption === '2'"
   */
  evaluateExpression(expression: string, context: ExecutionContext): boolean {
    try {
      // Create safe evaluation context with all variables available at root level
      const safeContext = {
        variables: context.variables || {},
        globals: context.globals || {},
        input: context.input || {},
        output: context.output || {},
        // Spread variables to root level so they can be accessed directly
        ...(context.variables || {}),
      };

      console.log('[evaluateExpression] Expression:', expression);
      console.log('[evaluateExpression] Variables:', JSON.stringify(safeContext.variables, null, 2));

      // Use Function constructor for safe evaluation
      // Pass context as 'this' and individual properties as parameters
      const generatedCode = `
        // Make all variables available at root level
        ${Object.keys(safeContext.variables).map(key => `const ${key} = variables.${key};`).join('\n')}
        return ${expression};
      `;
      
      console.log('[evaluateExpression] Generated code:', generatedCode);

      const func = new Function(
        'variables',
        'globals',
        'input',
        'output',
        generatedCode,
      );

      const result = func(
        safeContext.variables,
        safeContext.globals,
        safeContext.input,
        safeContext.output,
      );

      console.log('[evaluateExpression] Result:', result);
      return result;
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Set variable in context
   */
  setVariable(context: ExecutionContext, key: string, value: any): void {
    context.variables[key] = value;
  }

  /**
   * Get variable from context
   */
  getVariable(context: ExecutionContext, key: string): any {
    return context.variables[key];
  }

  /**
   * Set input for current node
   */
  setInput(context: ExecutionContext, data: Record<string, any>): void {
    context.input = data;
  }

  /**
   * Set output from current node
   */
  setOutput(context: ExecutionContext, data: Record<string, any>): void {
    context.output = data;
  }

  /**
   * Get value by path (e.g., "variables.user.name" or "user.name")
   * If path doesn't start with a known root (variables, globals, input, output),
   * it will try to find it in variables first, then in other places
   */
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    const firstPart = parts[0];
    
    // If path starts with a known root, use it directly
    if (['variables', 'globals', 'input', 'output'].includes(firstPart)) {
      return parts.reduce((current, key) => current?.[key], obj);
    }
    
    // Otherwise, try to find in variables first
    const valueInVariables = parts.reduce((current, key) => current?.[key], obj.variables);
    if (valueInVariables !== undefined) {
      return valueInVariables;
    }
    
    // Then try in output
    const valueInOutput = parts.reduce((current, key) => current?.[key], obj.output);
    if (valueInOutput !== undefined) {
      return valueInOutput;
    }
    
    // Then try in input
    const valueInInput = parts.reduce((current, key) => current?.[key], obj.input);
    if (valueInInput !== undefined) {
      return valueInInput;
    }
    
    // Finally try in globals
    const valueInGlobals = parts.reduce((current, key) => current?.[key], obj.globals);
    return valueInGlobals;
  }
}

