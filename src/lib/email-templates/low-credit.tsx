import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Replix AI'
const APP_URL = 'https://replixai.co.uk'

interface LowCreditProps {
  name?: string
  creditsRemaining?: number
}

const LowCreditEmail = ({ name, creditsRemaining = 2 }: LowCreditProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You have ${creditsRemaining} ad credits left`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Hey ${name},` : 'Heads up'} — you're running low on credits
        </Heading>
        <Text style={text}>
          You have <strong>{creditsRemaining} credit{creditsRemaining === 1 ? '' : 's'}</strong> remaining
          in your {SITE_NAME} account. Top up now to keep generating ads without
          interruption.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/billing`} style={button}>
            Top up credits
          </Button>
        </Section>
        <Text style={text}>
          Plans start at just a few dollars and include unlimited variant
          generation, all ad formats, and priority support.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LowCreditEmail,
  subject: 'You\'re running low on ad credits',
  displayName: 'Low credit warning',
  previewData: { name: 'Alex', creditsRemaining: 2 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }
const button = { backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '15px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0' }
