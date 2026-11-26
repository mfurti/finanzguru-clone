import { Global, Module } from '@nestjs/common'
import { CryptoService } from './crypto.service'

/** App-wide services without their own domain module. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CommonModule {}
