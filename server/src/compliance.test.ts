import { z } from 'zod'

const PasswordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/)

export function runComplianceVerification() {
  if (PasswordSchema.safeParse('Weak1!').success) throw new Error('Password validation failed on short password')
  if (PasswordSchema.safeParse('simplepassword123').success) throw new Error('Password validation failed on missing uppercase/special')
  if (PasswordSchema.safeParse('NoSpecial12345').success) throw new Error('Password validation failed on missing special char')
  if (!PasswordSchema.safeParse('ValidP@ssword123').success) throw new Error('Password validation failed on valid complex password')
  console.log('[Compliance Verification] All password security rules verified successfully.')
}

if (require.main === module) {
  runComplianceVerification()
}
