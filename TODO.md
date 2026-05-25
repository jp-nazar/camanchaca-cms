# TODO

## Translation Tasks

- [ ] Translate all user-facing guides to client's language
  - [x] android/KIOSK_SETUP.md → docs/KIOSK_SETUP.md
  - [ ] README.md

## Pending Tasks

- [ ] Replace `your-server-domain.com` with actual production domain
- [ ] Configure production `.env` file
- [ ] Set up SSL certificates
- [ ] Verify database migrations work on fresh install
- [ ] **Migrate email from Microsoft Graph to AWS SES**
  - [ ] Configure AWS SES in AWS Console (domain verification, sandbox removal, IAM user with `ses:SendEmail` permission)
  - [ ] Add `SES_*` env vars to `server/.env` (region, access key, secret key, from email)
  - [ ] Install `@aws-sdk/client-ses` dependency
  - [ ] Remove `@azure/msal-node` dependency from `server/package.json`
  - [ ] Remove all `GRAPH_*` env vars from `server/config.js`
  - [ ] Rewrite `server/services/email.js` to use `@aws-sdk/client-ses`
  - [ ] Update README and docs (GUIA_IT.md, ARCHITECTURE.md) to remove Graph references
  - [ ] Test email alerts with new SES provider
