import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useResponsive,
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
} from '../../hooks/useResponsive';

describe('Responsive Hooks', () => {
  beforeEach(() => {
    // Set default window size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useResponsive', () => {
    it('should detect desktop by default', () => {
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
    });

    it('should detect mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect landscape mode', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.isLandscape).toBe(true);
    });

    it('should update on window resize', () => {
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isDesktop).toBe(true);

      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 375,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isMobile).toBe(true);
    });
  });

  describe('useMediaQuery', () => {
    it('should match media query', () => {
      const matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });

      const { result } = renderHook(() =>
        useMediaQuery('(min-width: 1024px)')
      );

      expect(result.current).toBe(true);
    });
  });

  describe('useIsMobile', () => {
    it('should return true for mobile viewport', () => {
      const matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 639px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });

      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });
  });

  describe('useIsTablet', () => {
    it('should return true for tablet viewport', () => {
      const matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 640px) and (max-width: 1023px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });

      const { result } = renderHook(() => useIsTablet());
      expect(result.current).toBe(true);
    });
  });

  describe('useIsDesktop', () => {
    it('should return true for desktop viewport', () => {
      const matchMediaMock = vi.fn().mockImplementation((query) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: matchMediaMock,
      });

      const { result } = renderHook(() => useIsDesktop());
      expect(result.current).toBe(true);
    });
  });
});
