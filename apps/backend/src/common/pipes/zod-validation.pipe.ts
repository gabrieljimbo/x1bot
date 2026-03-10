import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private schema: ZodSchema) { }

    transform(value: any, metadata: ArgumentMetadata) {
        try {
            // parse handles both validation and stripping unknown fields
            // it returns the validated object with only the fields defined in the schema
            const parsedValue = this.schema.parse(value);
            return parsedValue;
        } catch (error) {
            if (error instanceof ZodError) {
                throw new BadRequestException({
                    message: 'Validation failed',
                    errors: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message,
                    })),
                });
            }
            throw new BadRequestException('Validation failed');
        }
    }
}
