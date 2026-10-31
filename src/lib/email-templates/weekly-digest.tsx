import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Row, Column, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Replix AI'
const APP_URL = 'https://replixai.co.uk'

interface WeeklyDigestProps {
  name?: string
  adsGenerated?: number
  topHook?: string
  creditsUsed?: number
  weekRange?: string
}

const WeeklyDigestEmail = ({
  name,
  adsGenerated = 12,
  topHook = 'Stop scrolling — this changed everything',
  creditsUsed = 12,
  weekRange = 'this week',
}: WeeklyDigestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Your ${SITE_NAME} weekly digest — ${adsGenerated} ads generated`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `${name}, here's your week` : 'Your weekly ad performance'}
        </Heading>
        <Text style={text}>
          Here's a snapshot of your activity on {SITE_NAME} for {weekRange}.
        </Text>

        <Section style={statsCard}>
          <Row>
            <Column style={statCol}>
              <Text style={statValue}>{adsGenerated}</Text>
              <Text style={statLabel}>Ads generated</Text>
            </Column>
            <Column style={statCol}>
              <Text style={statValue}>{creditsUsed}</Text>
              <Text style={statLabel}>Credits used</Text>
            </Column>
          </Row>
        </Section>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>Top performing hook</Heading>
        <Text style={quote}>"{topHook}"</Text>

        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${APP_URL}/gallery`} style={button}>
            View your gallery
          </Button>
        </Section>

        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyDigestEmail,
  subject: `Your ${SITE_NAME} weekly digest 📊`,
  displayName: 'Weekly performance digest',
  previewData: {
    name: 'Alex',
    adsGenerated: 12,
    topHook: 'Stop scrolling — this changed everything',
    creditsUsed: 12,
    weekRange: 'Nov 18 – Nov 24',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 12px' }
const h2 = { fontSize: '17px', fontWeight: '600', color: '#0f172a', margin: '24px 0 8px' }
const text = { fontSize: '15px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }
const statsCard = { backgroundColor: '#f8fafc', borderRadius: '12px', padding: '24px', margin: '24px 0' }
const statCol = { textAlign: 'center' as const, padding: '0 12px' }
const statValue = { fontSize: '32px', fontWeight: 'bold', color: '#6366f1', margin: '0' }
const statLabel = { fontSize: '13px', color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const quote = { fontSize: '17px', fontStyle: 'italic', color: '#0f172a', borderLeft: '3px solid #6366f1', paddingLeft: '16px', margin: '12px 0 24px' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const button = { backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '15px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0' }
