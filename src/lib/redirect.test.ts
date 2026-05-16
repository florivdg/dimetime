import { describe, expect, it } from 'bun:test'
import { getSafeRedirectUrl } from './redirect'

describe('getSafeRedirectUrl', () => {
  it('returns the fallback when url is null', () => {
    expect(getSafeRedirectUrl(null)).toBe('/')
  })

  it('returns the fallback when url is undefined', () => {
    expect(getSafeRedirectUrl(undefined)).toBe('/')
  })

  it('returns the fallback when url is empty', () => {
    expect(getSafeRedirectUrl('')).toBe('/')
  })

  it('returns the fallback when url is not rooted', () => {
    expect(getSafeRedirectUrl('relative')).toBe('/')
  })

  it('rejects protocol-relative URLs that could escape origin', () => {
    expect(getSafeRedirectUrl('//evil.example.com/x')).toBe('/')
  })

  it('rejects javascript: URLs', () => {
    expect(getSafeRedirectUrl('/x?next=javascript:alert(1)')).toBe('/')
  })

  it('rejects data: URLs anywhere in the path', () => {
    expect(getSafeRedirectUrl('/data:text/html,foo')).toBe('/')
  })

  it('rejects vbscript: URLs anywhere in the path', () => {
    expect(getSafeRedirectUrl('/vbscript:evil')).toBe('/')
  })

  it('rejects absolute URLs with a scheme', () => {
    expect(getSafeRedirectUrl('https://example.com')).toBe('/')
  })

  it('accepts a safe rooted relative URL', () => {
    expect(getSafeRedirectUrl('/dashboard')).toBe('/dashboard')
  })

  it('accepts a safe rooted relative URL with query string', () => {
    expect(getSafeRedirectUrl('/plans?archived=true')).toBe(
      '/plans?archived=true',
    )
  })

  it('honors a custom fallback', () => {
    expect(getSafeRedirectUrl(null, '/login')).toBe('/login')
    expect(getSafeRedirectUrl('//evil', '/login')).toBe('/login')
  })
})
