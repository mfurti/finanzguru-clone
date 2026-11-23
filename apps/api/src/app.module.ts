import { Module, RequestMethod } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { CommonModule } from './common/common.module'
import { validateEnv } from './config/env.schema'
import { DrizzleModule } from './database/drizzle.module'
import { AccountsModule } from './modules/accounts/accounts.module'
import { AuthModule } from './modules/auth/auth.module'
import { BudgetsModule } from './modules/budgets/budgets.module'
import { CashflowModule } from './modules/cashflow/cashflow.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { HealthModule } from './modules/health/health.module'
import { ImportModule } from './modules/import/import.module'
import { InsuranceModule } from './modules/insurance/insurance.module'
import { InstrumentsModule } from './modules/instruments/instruments.module'
import { AnalysisModule } from './modules/analysis/analysis.module'
import { DividendsModule } from './modules/dividends/dividends.module'
import { TaxesModule } from './modules/taxes/taxes.module'
import { InvestmentsModule } from './modules/investments/investments.module'
import { OverviewModule } from './modules/overview/overview.module'
import { TransactionsModule } from './modules/transactions/transactions.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests set their env explicitly; a developer's .env must not leak into them.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV')
        return {
          // Docker polls /api/health every 30 s; keep it out of the request log.
          exclude: [{ method: RequestMethod.GET, path: 'health' }],
          pinoHttp: {
            level: env === 'test' ? 'silent' : 'info',
            // Never log session cookies or auth headers.
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers.authorization',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            transport:
              env === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
          },
        }
      },
    }),
    CommonModule,
    DrizzleModule,
    HealthModule,
    AuthModule,
    OverviewModule,
    AccountsModule,
    TransactionsModule,
    ImportModule,
    InvestmentsModule,
    CashflowModule,
    CategoriesModule,
    BudgetsModule,
    InsuranceModule,
    InstrumentsModule,
    AnalysisModule,
    DividendsModule,
    TaxesModule,
  ],
})
export class AppModule {}
