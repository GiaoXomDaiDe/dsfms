import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { S3Service } from './s3.service'
import * as libre from 'libreoffice-convert'
import { promisify } from 'util'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const convertAsync = promisify(libre.convert)

@Injectable()
export class PdfConverterService {
  constructor(private readonly s3Service: S3Service) {
    // Log LibreOffice availability on startup
    this.checkLibreOfficeAvailability()
  }

  /**
   * Check if LibreOffice is available (non-blocking)
   */
  private checkLibreOfficeAvailability(): void {
    try {
      const testBuffer = Buffer.from('test')
      libre.convert(testBuffer, '.pdf', undefined, (err) => {
        if (err) {
          console.warn('⚠️  LibreOffice not available:', err.message)
          console.warn('📝 To enable PDF conversion, please:')
          console.warn('   1. Download LibreOffice from: https://www.libreoffice.org/download/')
          console.warn('   2. Install it on your system')
          console.warn('   3. Restart this application')
        } else {
          console.log('✅ LibreOffice is available for PDF conversion')
        }
      })
    } catch (error) {
      console.warn('⚠️  LibreOffice not detected. PDF conversion will not work.')
    }
  }

  /**
   * Convert DOCX from S3 URL to PDF buffer
   */
  async convertDocxToPdfFromS3(s3Url: string): Promise<Buffer> {
    try {
      // Validate S3 URL format
      if (!this.isValidS3Url(s3Url)) {
        throw new BadRequestException('Invalid S3 URL format')
      }

      // Download DOCX file from S3
      const docxBuffer = await this.downloadFileFromS3(s3Url)
      
      if (!docxBuffer || docxBuffer.length === 0) {
        throw new BadRequestException('Failed to download DOCX file from S3')
      }

      // Convert DOCX to PDF
      const pdfBuffer = await this.convertDocxBufferToPdf(docxBuffer)
      
      return pdfBuffer
    } catch (error) {
      console.error('Error converting DOCX to PDF:', error)
      
      if (error instanceof BadRequestException) {
        throw error
      }
      
      throw new InternalServerErrorException('Failed to convert DOCX to PDF')
    }
  }

  /**
   * Convert multiple DOCX files from S3 URLs to PDF buffers
   */
  async convertMultipleDocxToPdfFromS3(s3Urls: string[]): Promise<{ url: string; pdfBuffer: Buffer; filename: string }[]> {
    const results: { url: string; pdfBuffer: Buffer; filename: string }[] = []
    
    for (const url of s3Urls) {
      try {
        const pdfBuffer = await this.convertDocxToPdfFromS3(url)
        const filename = this.extractFilenameFromS3Url(url).replace('.docx', '.pdf')
        
        results.push({
          url,
          pdfBuffer,
          filename
        })
      } catch (error) {
        console.error(`Failed to convert ${url}:`, error)
        // Continue with other files even if one fails
      }
    }
    
    return results
  }

  /**
   * Download file from S3 URL
   */
  private async downloadFileFromS3(s3Url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      
      const request = https.get(s3Url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: Failed to download file from S3`))
          return
        }

        response.on('data', (chunk) => {
          chunks.push(chunk)
        })

        response.on('end', () => {
          resolve(Buffer.concat(chunks))
        })

        response.on('error', (error) => {
          reject(error)
        })
      })

      request.on('error', (error) => {
        reject(error)
      })

      request.setTimeout(30000, () => {
        request.destroy()
        reject(new Error('Download timeout'))
      })
    })
  }

  /**
   * Convert DOCX buffer to PDF using LibreOffice - public method
   */
  async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    return this.convertDocxBufferToPdf(docxBuffer)
  }

  /**
   * Convert DOCX buffer to PDF using LibreOffice
   */
  private async convertDocxBufferToPdf(docxBuffer: Buffer): Promise<Buffer> {
    try {
      // Create temporary file for LibreOffice conversion
      const tempDir = os.tmpdir()
      const tempDocxPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.docx`)
      
      try {
        // Write DOCX buffer to temporary file
        fs.writeFileSync(tempDocxPath, docxBuffer)
        
        // Read the file back as buffer for LibreOffice
        const docxFileBuffer = fs.readFileSync(tempDocxPath)
        
        // Convert DOCX to PDF using LibreOffice
        const pdfBuffer = await this.convertWithLibreOffice(docxFileBuffer)
        
        return pdfBuffer
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempDocxPath)) {
          fs.unlinkSync(tempDocxPath)
        }
      }
    } catch (error) {
      console.error('LibreOffice conversion error:', error)
      throw new InternalServerErrorException('PDF conversion failed')
    }
  }

  /**
   * Convert buffer using LibreOffice with proper error handling
   */
  private async convertWithLibreOffice(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Validate buffer
      if (!buffer || buffer.length === 0) {
        reject(new BadRequestException('Invalid or empty document buffer'))
        return
      }

      // Check if LibreOffice is available
      try {
        libre.convert(buffer, '.pdf', undefined, (err, result) => {
          if (err) {
            console.error('LibreOffice conversion error:', err)
            
            // Provide better error messages for common issues
            if (err.message.includes('Document is empty')) {
              reject(new BadRequestException('The document appears to be empty or corrupted'))
            } else if (err.message.includes('Could not find platform independent libraries')) {
              reject(new InternalServerErrorException('LibreOffice is not properly installed or configured. Please install LibreOffice and restart the application.'))
            } else if (err.message.includes('soffice')) {
              reject(new InternalServerErrorException('LibreOffice executable not found. Please ensure LibreOffice is installed and accessible in PATH.'))
            } else {
              reject(new InternalServerErrorException(`PDF conversion failed: ${err.message}`))
            }
          } else {
            resolve(result)
          }
        })
      } catch (error) {
        console.error('LibreOffice setup error:', error)
        reject(new InternalServerErrorException('LibreOffice is not available. Please install LibreOffice to enable PDF conversion.'))
      }
    })  
  }

  /**
   * Validate S3 URL format
   */
  private isValidS3Url(url: string): boolean {
    try {
      const urlObj = new URL(url)
      
      // Check if it's a valid S3 URL pattern
      const s3Patterns = [
        /^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*\.docx$/,
        /^https:\/\/s3\..*\.amazonaws\.com\/.*\/.*\.docx$/,
        /^https:\/\/.*\.s3-.*\.amazonaws\.com\/.*\.docx$/
      ]
      
      return s3Patterns.some(pattern => pattern.test(url))
    } catch {
      return false
    }
  }

  /**
   * Extract filename from S3 URL
   */
  private extractFilenameFromS3Url(s3Url: string): string {
    try {
      const url = new URL(s3Url)
      const pathname = url.pathname
      const filename = pathname.split('/').pop() || 'document.docx'
      return filename
    } catch {
      return 'document.docx'
    }
  }

  /**
   * Get content type for PDF response
   */
  getPdfContentType(): string {
    return 'application/pdf'
  }

  /**
   * Create PDF response headers
   */
  createPdfResponseHeaders(filename: string): Record<string, string> {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-_]/g, '_')
    
    return {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
}