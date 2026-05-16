import { ref, type Ref } from 'vue'

export type AuthErrorMap = Partial<
  Record<number | 'default' | 'network', string>
>

interface AuthResult<T> {
  data?: T
  error?: { status?: number; message?: string } | null
}

export interface UseAuthActionReturn {
  isLoading: Ref<boolean>
  errorMessage: Ref<string | null>
  runWithErrorHandling: <T>(
    action: () => Promise<AuthResult<T>>,
    errorMap: AuthErrorMap,
  ) => Promise<T | null>
}

function resolveErrorMessage(
  errorMap: AuthErrorMap,
  key: number | 'network' | undefined,
): string | null {
  const fromKey = key === undefined ? undefined : errorMap[key]
  return fromKey ?? errorMap.default ?? null
}

export function useAuthAction(): UseAuthActionReturn {
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function runWithErrorHandling<T>(
    action: () => Promise<AuthResult<T>>,
    errorMap: AuthErrorMap,
  ): Promise<T | null> {
    isLoading.value = true
    errorMessage.value = null

    try {
      const result = await action()
      if (result.error) {
        errorMessage.value = resolveErrorMessage(errorMap, result.error.status)
        return null
      }
      return result.data ?? null
    } catch {
      errorMessage.value = resolveErrorMessage(errorMap, 'network')
      return null
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, errorMessage, runWithErrorHandling }
}
