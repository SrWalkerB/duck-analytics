import { toast as sonnerToast } from 'sonner'

const SUCCESS_STYLE = { background: '#16a34a', color: '#fff', border: 'none' } as const
const ERROR_STYLE = { background: '#dc2626', color: '#fff', border: 'none' } as const

export const toast = {
  success: (message: string) => sonnerToast.success(message, { style: SUCCESS_STYLE }),
  error: (message: string) => sonnerToast.error(message, { style: ERROR_STYLE }),
  info: (message: string) => sonnerToast(message),
}
