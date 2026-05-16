import { useForm } from 'vee-validate'
import { z } from 'zod'

export function usePasswordForm() {
  const passwordSchema = z.object({
    password: z.string().min(1, 'Passwort ist erforderlich'),
  })

  const passwordForm = useForm({
    validationSchema: passwordSchema,
    initialValues: { password: '' },
  })

  return { passwordSchema, passwordForm }
}
