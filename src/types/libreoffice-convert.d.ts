declare module 'libreoffice-convert' {
  export default function convert(
    docx: Buffer,
    format: string,
    undefined: undefined,
    callback: (err: Error | null, buf?: Buffer) => void
  ): void
}
