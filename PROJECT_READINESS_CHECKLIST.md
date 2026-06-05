# Project Readiness Checklist

## Done in cleanup pass
- Frontend type-check script is used as a minimal test command.
- CI no longer ignores backend test failures.
- Homepage slides moved toward backend-managed data.
- Repeated Tailwind utility classes and mojibake UI symbols cleaned.

## Still recommended before production
- Replace browser confirm dialogs with in-app confirmation modals.
- Add real backend integration tests for auth, product creation, upload, checkout, payment timeout, reviews, and seller orders.
- Add frontend component/e2e tests for buyer checkout, seller product creation, category filtering, and review reply.
- Store homepage slide images in object storage through an upload endpoint, not pasted external URLs.
- Review payment webhooks with real Stripe/Omise sandbox credentials.
- Move real secrets out of .env and keep only .env.example in source control.
