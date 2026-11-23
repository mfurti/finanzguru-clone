import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { ZodValidationException } from 'nestjs-zod'
import type { ZodError } from 'zod'

/** Error body of every failed request (contracts/http-api.md). */
export interface ApiErrorBody {
  statusCode: number
  statusMessage: string
  data?: { issues: { path: string; message: string }[] }
}

/**
 * Maps all exceptions to `{ statusCode, statusMessage, data?: { issues } }`.
 * Unknown errors become 500 without leaking internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>()
    const body = this.toBody(exception)
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
    }
    void reply.status(body.statusCode).send(body)
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError() as ZodError
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        statusMessage: 'Validation failed',
        data: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      }
    }
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response && 'message' in response
            ? String(
                Array.isArray(response.message) ? response.message.join('; ') : response.message,
              )
            : exception.message
      return { statusCode: exception.getStatus(), statusMessage: message }
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      statusMessage: 'Internal server error',
    }
  }
}
