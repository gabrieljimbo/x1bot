import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '@n9n/shared';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

@Injectable()
export class ContextService {
  /**
   * Interpolate template string with variables
   * Example: "Hello {{variables.name}}" -> "Hello John"
   */
  interpolate(template: string, context: ExecutionContext): string {
    if (!template) return '';
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getValueByPath(context, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Evaluate expression against context
   * Example: "variables.selectedOption === '2'"
   * 
   * Available helper functions for business hours:
   * - isDayEnabled([1,2,3,4,5]) - Check if current day is in enabled days array (0=Sunday, 1=Monday, ..., 6=Saturday)
   * - isWithinBusinessHours(9, 0, 18, 0, [1,2,3,4,5]) - Check if current time is within business hours (startHour, startMinute, endHour, endMinute, enabledDays)
   * - isOutsideBusinessHours(9, 0, 18, 0, [1,2,3,4,5]) - Check if current time is outside business hours
   * - getCurrentDayName() - Get current day name ('sunday', 'monday', etc.)
   * - getCurrentDay() - Get current day number (0-6)
   * - getCurrentHour() - Get current hour (0-23)
   * - getCurrentMinute() - Get current minute (0-59)
   * 
   * Examples:
   * - "isOutsideBusinessHours(9, 0, 18, 0, [1,2,3,4,5])" - Outside business hours (Mon-Fri 9am-6pm)
   * - "isOutsideBusinessHours(9, 0, 18, 0, [1,2,3,4,5,6])" - Outside business hours (Mon-Sat 9am-6pm)
   * - "!isDayEnabled([1,2,3,4,5])" - Weekend (not Mon-Fri)
   * - "getCurrentDay() === 6" - Saturday
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

      // Helper functions for business hours checking
      // Use São Paulo timezone (America/Sao_Paulo)
      const timezone = 'America/Sao_Paulo';
      const now = new Date();
      const nowInSaoPaulo = toZonedTime(now, timezone);
      const currentDay = nowInSaoPaulo.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentHour = nowInSaoPaulo.getHours();
      const currentMinute = nowInSaoPaulo.getMinutes();
      const currentTime = currentHour * 60 + currentMinute; // Total minutes since midnight

      // Debug log (can be removed in production)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[TIMEZONE] Current time in São Paulo: ${nowInSaoPaulo.toLocaleString('pt-BR', { timeZone: timezone })} | Day: ${currentDay} (${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][currentDay]}) | Hour: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      }

      // Helper function to check if current day is enabled
      const isDayEnabled = (enabledDays: number[]): boolean => {
        return enabledDays.includes(currentDay);
      };

      // Helper function to check if current time is within business hours
      const isWithinBusinessHours = (
        startHour: number,
        startMinute: number,
        endHour: number,
        endMinute: number,
        enabledDays: number[] = [1, 2, 3, 4, 5] // Default: Monday to Friday
      ): boolean => {
        // First check if current day is enabled
        if (!isDayEnabled(enabledDays)) {
          return false;
        }

        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        return currentTime >= startTime && currentTime <= endTime;
      };

      // Helper function to check if current time is outside business hours
      const isOutsideBusinessHours = (
        startHour: number,
        startMinute: number,
        endHour: number,
        endMinute: number,
        enabledDays: number[] = [1, 2, 3, 4, 5] // Default: Monday to Friday
      ): boolean => {
        const result = !isWithinBusinessHours(startHour, startMinute, endHour, endMinute, enabledDays);
        
        // Debug log (can be removed in production)
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[BUSINESS_HOURS] isOutsideBusinessHours(${startHour}:${startMinute}, ${endHour}:${endMinute}, [${enabledDays.join(',')}]) = ${result}`);
          console.log(`[BUSINESS_HOURS] Current: Day ${currentDay}, Time ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Day enabled: ${enabledDays.includes(currentDay)}`);
        }
        
        return result;
      };

      // Helper function to get current day name
      const getCurrentDayName = (): string => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[currentDay];
      };

      // Helper function to get current day number (0-6)
      const getCurrentDay = (): number => {
        return currentDay;
      };

      // Helper function to get current hour (0-23)
      const getCurrentHour = (): number => {
        return currentHour;
      };

      // Helper function to get current minute (0-59)
      const getCurrentMinute = (): number => {
        return currentMinute;
      };

      // Use Function constructor for safe evaluation
      // Pass context as 'this' and individual properties as parameters
      const generatedCode = `
        // Make all variables available at root level
        ${Object.keys(safeContext.variables).map(key => `const ${key} = variables.${key};`).join('\n')}
        return ${expression};
      `;

      const func = new Function(
        'variables',
        'globals',
        'input',
        'output',
        'isDayEnabled',
        'isWithinBusinessHours',
        'isOutsideBusinessHours',
        'getCurrentDayName',
        'getCurrentDay',
        'getCurrentHour',
        'getCurrentMinute',
        generatedCode,
      );

      const result = func(
        safeContext.variables,
        safeContext.globals,
        safeContext.input,
        safeContext.output,
        isDayEnabled,
        isWithinBusinessHours,
        isOutsideBusinessHours,
        getCurrentDayName,
        getCurrentDay,
        getCurrentHour,
        getCurrentMinute,
      );
      
      return Boolean(result);
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
   * Supports both simple keys (e.g., "userName") and nested paths (e.g., "codeOutput.products")
   */
  getVariable(context: ExecutionContext, key: string): any {
    // If key contains dots, use path resolution
    if (key.includes('.')) {
      return this.getValueByPath(context, key);
    }
    // Otherwise, use simple variable lookup
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

