import { createApp } from './app'
import { config } from './config'
import { logger } from './logger'

const app = createApp()

app.listen(config.port, () => {
  logger.info(
    { port: config.port, authMode: config.authMode, expiryEnabled: config.rules.expiryEnabled },
    'Träningsreturen backend listening',
  )
})
