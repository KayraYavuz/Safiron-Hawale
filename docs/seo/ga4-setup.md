# Google Analytics 4 Setup

**Date:** 2026-05-30  
**Property ID:** G-P24EM92RFQ  
**Data Stream:** safironpay.com (web)

## Tracking Code

Already installed in `frontend/index.html` (lines 44-55):

```html
<!-- Google Analytics — Consent Mode (KVKK/GDPR uyumlu) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    wait_for_update: 2000,
  });
  gtag('js', new Date());
  gtag('config', 'G-P24EM92RFQ');
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-P24EM92RFQ"></script>
```

Status: ✅ Active (Consent Mode enabled for GDPR/KVKK compliance)

## Conversion Events

### Event Tracking

Track these custom events from `frontend/src/utils/analytics.js`:

**1. Contact Form Submission**
- Event: `contact_form_submit`
- Trigger: When contact form successfully submitted
- Value: [optional - form type]

**2. Demo Request**
- Event: `demo_request`
- Trigger: When demo/trial signup clicked
- Value: [optional - package selected]

**3. User Signup**
- Event: `user_signup`
- Trigger: After successful account creation
- Value: [optional - plan tier]

**4. Pricing Page Interaction**
- Event: `pricing_plan_viewed`
- Trigger: When user views pricing plans
- Value: plan_name (starter, professional, enterprise)

### Helper Functions

```javascript
// frontend/src/utils/analytics.js
export function trackEvent(eventName, eventParams = {}) {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

export function trackConversion(type, value) {
  trackEvent(`${type}_conversion`, {
    conversion_type: type,
    conversion_value: value
  });
}
```

## Monitoring Dashboard

### Key Metrics to Track (Monthly)

| Metric | Target | Current |
|--------|--------|---------|
| Organic Sessions | 500-1000 | TBD |
| Organic Users | 300-600 | TBD |
| Organic Bounce Rate | < 50% | TBD |
| Avg. Session Duration | > 2 min | TBD |
| Conversion Rate (contact form) | > 2% | TBD |
| Pageviews/Session | > 1.5 | TBD |

### Real-time Testing

Visit Google Analytics > Realtime to verify:
1. Events fire correctly
2. User journeys tracked
3. Conversion events appear in Realtime dashboard

**Test command:**
```javascript
// In browser console
window.gtag('event', 'test_event', {test: true})
```

Should appear in GA4 Realtime dashboard within 1-2 seconds.

## Segmentation

Create audience segments for:
- **Organic Traffic:** Users from search engines
- **MENA Users:** By country (EG, AE, SA, etc.)
- **High-Value:** Users who reached pricing page
- **Converters:** Users who submitted contact form

## Goals/Conversions

Setup goals in GA4 → Admin → Conversions:

1. **Contact Form Submission** → event: `contact_form_submit`
2. **Demo Request** → event: `demo_request`
3. **Pricing Page Visited** → event: `page_view` where page_path = `/pricing`

## Monthly Review Checklist

- [ ] Check organic traffic trend
- [ ] Review top landing pages (from organic)
- [ ] Check bounce rate by page
- [ ] Review conversion funnel
- [ ] Check MENA country breakdown
- [ ] Create monthly report for team

## Alerts

Setup alerts for:
- Organic traffic drop > 20% (red flag)
- Conversion rate drop > 50% (red flag)
- Bounce rate increase > 10% (warning)
