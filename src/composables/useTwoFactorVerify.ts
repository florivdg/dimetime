import { ref } from 'vue'
import { authClient } from '@/lib/auth-client'
import type { UseAuthActionReturn } from '@/composables/useAuthAction'

const INVALID_CODE_MESSAGE = 'Ungültiger Code. Bitte versuchen Sie es erneut.'

export function useTwoFactorVerify(
  auth: UseAuthActionReturn,
  onSuccess: () => void | Promise<void>,
) {
  const { errorMessage, runWithErrorHandling } = auth
  const totpCode = ref<string[]>([])

  async function verifyTotp() {
    const code = totpCode.value.join('')
    if (code.length !== 6) {
      errorMessage.value = 'Bitte geben Sie einen 6-stelligen Code ein'
      return
    }

    const data = await runWithErrorHandling(
      () => authClient.twoFactor.verifyTotp({ code, trustDevice: true }),
      {
        default: INVALID_CODE_MESSAGE,
        network: 'Ein Fehler ist aufgetreten',
      },
    )

    if (data) {
      await onSuccess()
    } else if (errorMessage.value === INVALID_CODE_MESSAGE) {
      totpCode.value = []
    }
  }

  function handlePinComplete(value: string[]) {
    totpCode.value = value
    if (value.join('').length === 6) {
      void verifyTotp()
    }
  }

  return { totpCode, verifyTotp, handlePinComplete }
}
