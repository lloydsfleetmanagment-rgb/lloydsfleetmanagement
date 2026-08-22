import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EmergencyAlertProps {
  alertId?: string
  employeeName?: string
  employeeId?: string
  loginId?: string
  shift?: string
  equipment?: string
  material?: string
  destination?: string
  message?: string
  raisedAt?: string
}

const label: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #e3e8ee',
  color: '#5b6472',
  fontSize: '13px',
  width: '42%',
}

const value: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid #e3e8ee',
  color: '#12161b',
  fontSize: '14px',
  fontWeight: 700,
}

export function EmergencyAlertEmail(props: EmergencyAlertProps) {
  const rows: [string, string][] = [
    ['Alert ID', props.alertId || '—'],
    ['Employee name', props.employeeName || '—'],
    ['Employee ID', props.employeeId || '—'],
    ['Login / email', props.loginId || '—'],
    ['Shift', props.shift || '—'],
    ['Equipment', props.equipment || '—'],
    ['Material', props.material || '—'],
    ['Destination / location', props.destination || '—'],
    ['Raised at (IST)', props.raisedAt || '—'],
    ['Message', props.message || '—'],
  ]

  return (
    <Html>
      <Head />
      <Preview>
        EMERGENCY · {props.employeeName || 'Operator'} · {props.destination || 'Surjagarh mine'}
      </Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ padding: '24px', maxWidth: '640px' }}>
          <Heading style={{ color: '#c81e1e', fontSize: '20px', margin: '0 0 4px' }}>
            EMERGENCY ALERT — LLOYDS FLEETIQ
          </Heading>
          <Text style={{ margin: '0 0 16px', color: '#5b6472', fontSize: '13px' }}>
            Surjagarh Iron Ore Mine · an operator raised an emergency
          </Text>
          <Section
            style={{
              border: '1px solid #e3e8ee',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {rows.map(([k, v]) => (
              <Row key={k}>
                <Column style={label}>{k}</Column>
                <Column style={value}>{v}</Column>
              </Row>
            ))}
          </Section>
          <Text style={{ marginTop: '16px', color: '#5b6472', fontSize: '12px' }}>
            Automated alert from LLOYDS FLEETIQ control room.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EmergencyAlertEmail,
  displayName: 'Emergency alert',
  subject: (data: Record<string, any>) =>
    `EMERGENCY · ${data['employeeName'] || 'Operator'} · ${data['destination'] || 'Surjagarh mine'} · Shift ${data['shift'] || '—'}`,
  to: 'sweja06@gmail.com',
  previewData: {
    alertId: 'a1b2c3d4',
    employeeName: 'R. Kumar',
    employeeId: 'EMP-1042',
    loginId: 'r.kumar@example.com',
    shift: 'B',
    equipment: 'Dumper 312',
    material: 'ROM',
    destination: 'TH-3 Crusher',
    message: 'Vehicle breakdown on haul road, assistance needed.',
    raisedAt: '22 Aug 2026, 14:35 IST',
  },
} satisfies TemplateEntry
