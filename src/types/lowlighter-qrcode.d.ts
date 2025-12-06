declare module '@lowlighter/qrcode' {
  export function qrcode(
    data: string,
    options?: { output?: 'svg' | 'console' },
  ): string
}
