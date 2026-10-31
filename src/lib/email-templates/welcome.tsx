import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Replix AI'
const APP_URL = 'https://replixai.co.uk'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let's create your first ad</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Welcome, ${name}!` : `Welcome to ${SITE_NAME}!`}
        </Heading>
        <Text style={text}>
          You're all set to start generating high-converting ad creatives in
          seconds. Connect your Shopify store, pick a product, and let our AI
          craft scroll-stopping ads tailored to your brand.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/dashboard`} style={button}>
            Generate your first ad
          </Button>
        </Section>
        <Text style={text}>
          You have <strong>3 free credits</strong> to get started. Need help?
          Check out our help center anytime.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME} 🎉`,
  displayName: 'Welcome email',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }
const button = { backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '15px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0' }
