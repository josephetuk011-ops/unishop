# Unishop

Unishop is a Uyo, Akwa Ibom marketplace for products, local services and delivery.

## Run locally

```powershell
cd e-marketplace
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` to a random value and set `PAYSTACK_SECRET_KEY` in `.env` to a **rotated Paystack test secret**. The key pasted into chat should be revoked and must not be reused. Never put a secret key in browser code, source control, screenshots or support messages. `PUBLIC_APP_URL` must be the public HTTPS origin in deployment; Paystack redirects back to `/?payment=return`.

Start the server with `npm start`; open `http://localhost:3000`. Paystack sends webhook events to `https://your-domain/api/payments/webhook`. Configure this URL in the Paystack dashboard for the same test/live environment as the server key. The app verifies the webhook signature and also verifies callback references directly with Paystack before marking an order paid.

The server stores users, bookings and orders in `.data/marketplace.json` by default. This JSON store is for local development only: deploy with a transactional database, backups, HTTPS, rate limiting and operational monitoring before accepting live traffic.

## Payment flow

1. The server validates product IDs and quantities against its catalog, adds the buyer's ₦500 dispatch fee, and calculates the NGN total; browser-submitted prices are ignored. Service bookings also add the customer's ₦500 fee.
2. Product checkout requires a signed-in customer account so delivery confirmation is tied to the correct order owner.
3. Paystack initialization runs server-side with `PAYSTACK_SECRET_KEY`, and the customer is redirected to Paystack-hosted checkout.
4. The callback is verified against Paystack's transaction API. Only a successful NGN transaction with the expected amount and email marks the order as paid.
5. Signed webhook events provide a second delivery path. Customer payments remain held in the Unishop ledger until the customer confirms delivery or confirms a completed booking.
6. Each seller/provider subtotal earns a 5% Unishop commission below ₦10,000, 10% from ₦10,000 to ₦29,999, or 15% at ₦30,000 and above. Commission excludes dispatch fees. Product sellers contribute ₦500 each from their settlement; the rider's product-delivery earnings are the buyer's ₦500 plus seller contributions. Service providers contribute ₦500, which Unishop retains along with the customer's ₦500 service dispatch fee.
7. After customer confirmation, net earnings become withdrawable in the seller/provider/rider dashboard. Bank accounts are resolved with Paystack and withdrawals use the Paystack Transfers API from the Unishop integration balance. Transfer events update withdrawal status; customer order history is available from `GET /api/me/orders`.

Service providers can choose only these niches: Barbing, Cleaning, Cooking, Hair dressing, Decorating, Grass clearing, Mechanic, Electrician, Plumber, Photographer, Makeup, Fashion designing, Manicure and pedicure, and Therapist. Providers can upload portfolio photos, receive customer bookings, accept paid work and see ratings/comments. Customers can pay service bookings through the same Paystack flow. Sellers can upload products and track paid sales. Riders can claim paid product deliveries and update delivery status; the customer must confirm delivery before those earnings are withdrawable.

The listings bundled into the starter storefront are preview examples. Paystack checkout pays the Unishop merchant integration; it is not an escrow service. Transfers draw from that integration's available Paystack balance, so a dashboard balance does not guarantee funds remain available if Paystack has already settled them to the merchant's bank. Enable Paystack Transfers, ensure the integration retains enough balance, and disable transfer OTP only if automated withdrawals are intended. If OTP is enabled, transfers may require manual action in Paystack.

The current marketplace ledger is stored in a JSON file on a single persistent disk. It is suitable for a prototype, not concurrent or production-grade financial accounting. Before accepting live money, migrate balances and withdrawals to a transactional database, add reconciliation/admin operations and dispute/refund handling, and obtain legal/compliance review for the delayed-release model.

## Tests

`npm run test:payments` runs local integration smoke tests with Paystack mocked. It verifies checkout fees, held earnings, customer confirmations, bank-recipient setup, withdrawals, reversals, callback verification, webhook signatures and the safe no-key response; it does not charge a card or transfer money. For a real Paystack test transaction, configure a rotated test secret in `.env`, enable Transfers for the test integration, restart the server and use Paystack's test checkout details from the Paystack documentation.

Each role profile has its own unique username. The same email address may be used for separate customer, seller, service-provider and dispatch profiles; choose a different username for each profile. Sign-in needs only that username and password, and opens the saved role automatically. Older accounts without a username use a generated `<email-name>-<role>` username.

## Publish on Render

The included `render.yaml` creates a web service with a persistent disk for marketplace records and seller uploads. Push this project to a GitHub repository, then in Render choose **New → Blueprint** and connect that repository. Render will ask for `PAYSTACK_SECRET_KEY`; enter a newly rotated test key (or live key only after the business is approved and launch checks are complete). Never commit `.env` or paste the secret into source files. The Blueprint generates `JWT_SECRET` and assigns `PUBLIC_APP_URL` through `RENDER_EXTERNAL_URL` for payment callbacks.

After the first deploy, configure the Paystack webhook URL as `https://<your-render-service>.onrender.com/api/payments/webhook`, using the same test/live mode as the configured key. Enable Transfers and configure the intended OTP policy in Paystack. Check `/api/health` shows payments `configured`, then test a small checkout, customer confirmation, and withdrawal using test mode before sharing the site.

I cannot trigger the public deployment from the current workspace because no Git remote or hosting account is connected. Render's persistent disk requires a paid instance and is single-instance storage; for reliable production scale, replace the local JSON store and disk uploads with a managed transactional database and object storage before accepting real customer traffic.