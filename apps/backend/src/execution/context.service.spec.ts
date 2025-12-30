import { ContextService } from './context.service';
import { ExecutionContext } from '@n9n/shared';

describe('ContextService', () => {
  let service: ContextService;

  beforeEach(() => {
    service = new ContextService();
  });

  describe('interpolate', () => {
    it('should interpolate single variable', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { name: 'John' },
      };

      const result = service.interpolate('Hello {{variables.name}}', context);
      expect(result).toBe('Hello John');
    });

    it('should interpolate multiple variables', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { firstName: 'John', lastName: 'Doe' },
      };

      const result = service.interpolate(
        'Hello {{variables.firstName}} {{variables.lastName}}',
        context,
      );
      expect(result).toBe('Hello John Doe');
    });

    it('should handle nested properties', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { user: { name: 'John', age: 30 } },
      };

      const result = service.interpolate('Name: {{variables.user.name}}', context);
      expect(result).toBe('Name: John');
    });

    it('should keep placeholder if variable not found', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const result = service.interpolate('Hello {{variables.name}}', context);
      expect(result).toBe('Hello {{variables.name}}');
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple equality', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { option: '1' },
      };

      const result = service.evaluateExpression("variables.option === '1'", context);
      expect(result).toBe(true);
    });

    it('should evaluate comparison', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { age: 25 },
      };

      const result = service.evaluateExpression('variables.age > 18', context);
      expect(result).toBe(true);
    });

    it('should evaluate complex expression', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { age: 25, hasLicense: true },
      };

      const result = service.evaluateExpression(
        'variables.age >= 18 && variables.hasLicense === true',
        context,
      );
      expect(result).toBe(true);
    });

    it('should return false on invalid expression', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const result = service.evaluateExpression('invalid expression', context);
      expect(result).toBe(false);
    });
  });

  describe('setVariable and getVariable', () => {
    it('should set and get variable', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      service.setVariable(context, 'userName', 'John');
      const result = service.getVariable(context, 'userName');

      expect(result).toBe('John');
    });

    it('should overwrite existing variable', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { userName: 'John' },
      };

      service.setVariable(context, 'userName', 'Jane');
      const result = service.getVariable(context, 'userName');

      expect(result).toBe('Jane');
    });
  });

  describe('setInput and setOutput', () => {
    it('should set input data', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      service.setInput(context, { message: 'Hello' });

      expect(context.input).toEqual({ message: 'Hello' });
    });

    it('should set output data', () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      service.setOutput(context, { result: 'Success' });

      expect(context.output).toEqual({ result: 'Success' });
    });
  });
});




