import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import { koaSwagger } from 'koa2-swagger-ui'
import { ZodError } from 'zod'
import { config } from './config'
import { logger } from './logger'
import { authMiddleware } from './auth/middleware'
import { openApiSpec } from './openapi/spec'
import { activitiesRouter } from './routes/activities'
import { adminRouter } from './routes/admin'
import { configRouter } from './routes/config'
import { leavesRouter } from './routes/leaves'
import { managerRouter } from './routes/manager'
import { meRouter } from './routes/me'
import { workoutsRouter } from './routes/workouts'

export function createApp(): Koa {
  const app = new Koa()

  app.use(cors({ origin: config.corsOrigin, credentials: true }))
  app.use(bodyParser())

  // Central error handling: zod → 400 with details, everything else → 500.
  app.use(async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      if (err instanceof ZodError) {
        ctx.status = 400
        ctx.body = { error: 'validation', details: err.issues }
        return
      }
      logger.error({ err, path: ctx.path }, 'app.unhandledError')
      ctx.status = 500
      ctx.body = { error: 'internal' }
    }
  })

  const publicRouter = new Router()
  publicRouter.get('/health', (ctx) => {
    ctx.body = { status: 'ok' }
  })
  publicRouter.get('/api/openapi.json', (ctx) => {
    ctx.body = openApiSpec
  })
  app.use(publicRouter.routes()).use(publicRouter.allowedMethods())
  app.use(
    koaSwagger({
      routePrefix: '/swagger',
      swaggerOptions: { url: '/api/openapi.json' },
    }),
  )
  app.use(configRouter.routes()).use(configRouter.allowedMethods())

  // Everything below requires an authenticated user (JWT validated per call).
  app.use(authMiddleware())
  for (const router of [
    meRouter,
    workoutsRouter,
    leavesRouter,
    managerRouter,
    adminRouter,
    activitiesRouter,
  ]) {
    app.use(router.routes()).use(router.allowedMethods())
  }

  return app
}
