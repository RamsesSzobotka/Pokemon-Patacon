import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const CLERK_JWT_ISSUER = process.env.CLERK_JWT_ISSUER || '';

// JWKS remoto de Clerk — se cachea automáticamente (solo una petición HTTP)
const JWKS = createRemoteJWKSet(
  new URL(`${CLERK_JWT_ISSUER}/.well-known/jwks.json`)
);

export const clerkAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: CLERK_JWT_ISSUER,
        algorithms: ['RS256'],
      });

      if (payload.sub) {
        c.set('clerkUserId', payload.sub as string);
      }
    } catch (e) {
      console.warn('[clerkAuth] JWT verification failed:', (e as Error).message);
    }
  }

  await next();
});

export function getClerkUserId(c: any): string | null {
  return c.get('clerkUserId') || null;
}
