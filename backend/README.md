Backend notes for this repo

- `backend/lambda/send-email/` contains the local source for the contact-form Lambda.
- The static site deployed from Amplify only publishes the files listed in `amplify.yml`, so this folder stays out of the web root on purpose.
- The live frontend currently posts directly to the deployed API Gateway endpoint configured in `js/main.js`.
