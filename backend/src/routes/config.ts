import Router from '@koa/router'
import { config } from '../config'

export const configRouter = new Router({ prefix: '/api/config' })

/**
 * @openapi GET /api/config — rule parameters and feature flags the frontend
 * needs (weekly cap, return share, expiry concept flag, auth mode).
 */
configRouter.get('/', async (ctx) => {
  ctx.body = {
    rules: {
      returnSharePercent: config.rules.returnSharePercent,
      weeklyCapMinutes: config.rules.weeklyCapMinutes,
      maxBackdateDays: config.rules.maxBackdateDays,
      expiryMonths: config.rules.expiryMonths,
      expiryWarningMonths: config.rules.expiryWarningMonths,
    },
    features: {
      expiryEnabled: config.rules.expiryEnabled,
    },
    authMode: config.authMode,
  }
})
