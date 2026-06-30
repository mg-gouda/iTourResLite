import { PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

// Usage: @Body(new ZodValidationPipe(schema)) — throws ZodError, caught by HttpErrorFilter (422).
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
