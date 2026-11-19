# DON’T GET CAUGHT!

A browser survival party game with a real WebSocket server, 2–20 human players per match, spectator seats, and a separate practice arena with nine labeled bots.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000. For a multiplayer smoke test, open a private or incognito browser window for the second player so both windows receive independent guest accounts. Create a private room in the first window, join with the displayed code in the second, then start from the host’s window. Quick Play waits for at least two connected people.

Use WASD, the arrow keys, or the touch direction pad. Use E or the on-screen action button in Imposter Hunt. An eliminated player can keep watching. Results are recorded at match completion. Ranked leaderboards count multiplayer finishes, including private rooms.

## Production deployment

Deploy one arena process on a Linux host with Docker Engine and the Docker Compose plugin. Point a DNS A or AAAA record at it and open ports 80 and 443. Copy `.env.example` to `.env`, set `GAME_DOMAIN` and an independent, randomly generated `ADMIN_KEY`, then run:

```sh
docker compose up -d --build
docker compose ps
curl --fail "https://YOUR_DOMAIN/health"
```

Caddy terminates TLS and proxies WebSockets. Use the HTTPS URL for PWA installation, invitations, sharing, and secure session cookies. Provide the same publicly accessible URL to every player. When hosting without Compose, set `PUBLIC_ORIGIN` explicitly and use a reverse proxy that forwards WebSocket upgrades. Enable `TRUST_PROXY` only when the app is directly reachable from a trusted reverse proxy. Never expose the application port and trusted forwarded headers directly to the internet.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP and WebSocket port. Defaults to 3000. |
| `DB_PATH` | Writable SQLite file path. Defaults to `game.sqlite`. The image uses `/data/game.sqlite`. |
| `PUBLIC_ORIGIN` | Canonical HTTPS origin with no trailing slash. Compose constructs it from `GAME_DOMAIN`. |
| `TRUST_PROXY` | Set to `1` behind a trusted proxy. |
| `ADMIN_KEY` | Random dashboard secret. Leaving it unset disables admin APIs. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional Stripe credentials for cosmetic checkout. |
| `STRIPE_CURRENCY` | Optional lowercase Stripe currency using two decimal places. Defaults to `usd`. |
| `PREMIUM_AMOUNT`, `PASS_AMOUNT` | Prices in minor currency units. Compose defaults to 399 and 599. |
| `GAME_DOMAIN` | DNS name used by Compose and Caddy. |

Use one active replica per installation. WebSocket room state is held in memory, while SQLite persists profiles, purchases, social relationships, and results. Restarting the process ends active matches and leaves completed results intact. Use a durable local volume and SQLite's online backup API, or stop the process before taking a file-system backup. Record backup recovery separately from the venue configuration. Do not mount this database on a shared network filesystem or run multiple authoritative replicas behind an ordinary load balancer. Horizontal deployment across regions would require room routing, durable match recovery, and shared identity and results storage.

Migrations run in sorted order when the server starts. The migration runner records applied filenames and applies each file in a transaction. Back up the database before upgrades and verify `/health` after starting the new release.

## Optional checkout and administration

With Stripe test credentials configured on an HTTPS installation, register your guest profile, go to Locker, and open cosmetic checkout. Configure Stripe to send `checkout.session.completed` to `https://YOUR_DOMAIN/api/stripe-webhook`. Purchases credit a skin or its current month's cosmetic pass only after a verified paid webhook. Verify fulfilment using a test purchase before enabling live mode. Rewards do not change arena movement, health, voting, or scoring. Referrals grant a cosmetic after the referred player finishes a human match. Rewarded advertising has no provider integration.

Register a profile and visit `/admin`, then enter the dashboard key. The dashboard shows operational activity, purchases by currency, recent users and reports, and allows account suspension, report resolution, mode and challenge availability, cosmetic coin price changes, announcements, and scheduled leaderboard tournaments. Tournament queues open and close on the configured dates and count results from their own matches.

## Testing

`npm test` runs deterministic engine and server integration tests. The server suite opens independent WebSocket sessions, checks room membership and spectators, sends movement, reconnects a client, finishes an accelerated match, and checks the persisted profile and leaderboard filters, public matchmaking, and tournament standings. Test the intended deployment in two separate browser sessions before inviting players. Live Stripe and browser-specific vertical recording require tests on the target installation.
