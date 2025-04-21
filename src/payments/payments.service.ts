import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs, NATS_SERVICE } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}
  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });
    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });
    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
  }
  async stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature']!;
    const endpointSecret = envs.stripeEndpointSecret;
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        endpointSecret,
      );
      console.log(event, 'event');
    } catch (error) {
      console.log('error', error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
    console.log(event, 'event');
    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeeded = event.data.object;
        const payload = {
          stripePaymentId: chargeSucceeeded.id,
          orderId: chargeSucceeeded.metadata.orderId,
          receiptUrl: chargeSucceeeded.receipt_url,
        };
        this.client.emit('payment.succeeded',payload)
        console.log('payload', payload);
        console.log('eventd', event);
        break;
      default:
        console.log(`Event ${event.type} not handled`);
    }
    return res.status(200).json({ signature });
  }
}
