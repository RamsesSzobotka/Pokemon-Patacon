import { Hono } from 'hono';
import Stripe from 'stripe';
import { getClerkUserId } from '../middleware/auth';
import { updateUser, getUserByClerkId } from '../db/users';

const storeRoutes = new Hono();

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecret, { apiVersion: '2022-11-15' });

/**
 * POST /api/store/checkout
 * Body: { product: 'shiny_pack', session_id: '...' }
 */
storeRoutes.post('/checkout', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { product, session_id } = body as any;

    if (!product || product !== 'shiny_pack') {
      return c.json({ success: false, error: 'Producto inválido' }, 400);
    }
    if (!session_id) {
      return c.json({ success: false, error: 'session_id requerido' }, 400);
    }

    // Define price for product (in cents)
    const PRICE_CENTS = 5999; // $59.99

    const origin = process.env.CORS_ORIGIN || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Shiny Pokémon Pack',
              description: 'Desbloquea sprites shiny en tu cuenta',
            },
            unit_amount: PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      client_reference_id: session_id,
      metadata: {
        clerk_user_id: clerkUserId,
        product,
      },
      success_url: `${origin}/menu?checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/menu?checkout_canceled=1`,
    });

    return c.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return c.json({ success: false, error: 'Error creating checkout session' }, 500);
  }
});

/**
 * POST /api/store/confirm
 * Body: { checkout_session_id: '...' }
 * Confirma el pago consultando Stripe (no webhooks en fase 1)
 */
storeRoutes.post('/confirm', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { checkout_session_id } = body as any;
    if (!checkout_session_id) {
      return c.json({ success: false, error: 'checkout_session_id requerido' }, 400);
    }

    const session = await stripe.checkout.sessions.retrieve(checkout_session_id, {
      expand: ['payment_intent'],
    });

    // Verificar estado de pago
    const paid = session.payment_status === 'paid' || (session.payment_intent && (session.payment_intent as any).status === 'succeeded');

    if (!paid) {
      return c.json({ success: false, paid: false, message: 'Pago no completado' }, 400);
    }

    // Seguridad: comprobar que la sesión pertenece al usuario autenticado
    const sessionClerk = session.metadata?.clerk_user_id;
    if (sessionClerk && sessionClerk !== clerkUserId) {
      console.warn('Session clerk mismatch:', sessionClerk, clerkUserId);
      return c.json({ success: false, error: 'Sesion de pago no corresponde al usuario' }, 403);
    }

    // Marcar shiny_pack en la cuenta
    await updateUser(clerkUserId, { shiny_pack: true });

    return c.json({ success: true, paid: true });
  } catch (error) {
    console.error('Error confirming checkout session:', error);
    return c.json({ success: false, error: 'Error confirming checkout session' }, 500);
  }
});

export default storeRoutes;
