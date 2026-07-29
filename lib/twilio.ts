import twilio from 'twilio'

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) throw new Error('Twilio credentials are not configured')
  return twilio(accountSid, authToken)
}

function getServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID is not set')
  return sid
}

export async function sendOtp(phone: string): Promise<void> {
  await getClient().verify.v2.services(getServiceSid()).verifications.create({ to: phone, channel: 'sms' })
}

export async function checkOtp(phone: string, code: string): Promise<boolean> {
  try {
    const result = await getClient().verify.v2.services(getServiceSid()).verificationChecks.create({ to: phone, code })
    return result.status === 'approved'
  } catch (err) {
    console.error('[OTP CHECK ERROR]:', err)
    return false
  }
}
