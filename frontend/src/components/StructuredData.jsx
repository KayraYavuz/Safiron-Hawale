import { useEffect } from 'react'

// Organization schema for Safiron
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  'name': 'Safiron Global Solutions',
  'url': 'https://safironpay.com',
  'logo': 'https://safironpay.com/logo.png',
  'description': 'Hawala, forex, and SWIFT management platform',
  'sameAs': [
    'https://twitter.com/safironsolutions',
    'https://linkedin.com/company/safiron'
  ],
  'contactPoint': {
    '@type': 'ContactPoint',
    'contactType': 'Sales',
    'email': 'sales@safironpay.com',
    'telephone': '+90-212-XXXX-XXXX'
  }
}

// SoftwareApplication schema for the platform
export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  'name': 'Safiron',
  'description': 'Multi-tenant hawala, forex, and SWIFT management platform',
  'operatingSystem': 'Web-based (all OS)',
  'applicationCategory': 'FinanceApplication',
  'offers': {
    '@type': 'Offer',
    'price': 'Contact for pricing'
  }
}

/**
 * StructuredData Component
 * Renders Schema.org structured data as JSON-LD script tags
 * @param {Object} schema - The schema object to render
 */
export default function StructuredData({ schema }) {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(schema)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [schema])

  return null
}
