import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // If you wish to attach user context (optional)
  // beforeSend(event) {
  //   if (event.user) {
  //     event.user = { ...event.user, ip_address: undefined };
  //   }
  //   return event;
  // },
});
