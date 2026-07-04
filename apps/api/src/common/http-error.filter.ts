import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { ZodError } from "zod";

// Uniform error envelope: { error: { code, message, details? } } (brief §API).
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        error: { code: "VALIDATION", message: "Validation failed", details: exception.flatten() },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === "string" ? body : (body as any).message ?? exception.message;
      const details = typeof body === "object" ? (body as any).details ?? undefined : undefined;
      return res.status(status).json({
        error: { code: codeFor(status), message: Array.isArray(message) ? message.join(", ") : message, details },
      });
    }

    // eslint-disable-next-line no-console
    console.error("Unhandled error:", exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  }
}

function codeFor(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 422: return "VALIDATION";
    default: return "ERROR";
  }
}
