import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type DeviceBreakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop';
export type MobileScreenerLayout = 'cards' | 'table';

const MOBILE_LAYOUT_STORAGE_KEY = 'inversor_mobile_layout_pref';

export interface ViewportState {
  breakpoint: DeviceBreakpoint;
  width: number;
  height: number;
  isMobile: boolean;         // < 768px (Smartphones en vertical)
  isTablet: boolean;         // 768px - 1023px (Tablets / Smartphones en horizontal grande)
  isLaptop: boolean;         // 1024px - 1399px (Portátiles compactos)
  isDesktopWide: boolean;    // >= 1400px (Monitores amplios: tabla 28 cols 100% fija)
  isMobileOrTablet: boolean; // < 1024px
  isTouch: boolean;          // Pantalla táctil principal (pointer: coarse)
  mobileScreenerLayout: MobileScreenerLayout;
  setMobileScreenerLayout: (mode: MobileScreenerLayout) => void;
}

function resolveBreakpoint(w: number): DeviceBreakpoint {
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  if (w < 1400) return 'laptop';
  return 'desktop';
}

function getInitialViewport() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900, isTouch: false };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    isTouch: window.matchMedia?.('(pointer: coarse)')?.matches ?? false,
  };
}

const ViewportContext = createContext<ViewportState | undefined>(undefined);

export const ViewportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dimensions, setDimensions] = useState(getInitialViewport);
  const [mobileScreenerLayout, setMobileScreenerLayoutState] = useState<MobileScreenerLayout>(() => {
    try {
      const saved = localStorage.getItem(MOBILE_LAYOUT_STORAGE_KEY);
      if (saved === 'cards' || saved === 'table') return saved;
    } catch {
      // noop
    }
    return 'cards';
  });

  const setMobileScreenerLayout = useCallback((mode: MobileScreenerLayout) => {
    setMobileScreenerLayoutState(mode);
    try {
      localStorage.setItem(MOBILE_LAYOUT_STORAGE_KEY, mode);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const handleUpdate = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nextWidth = window.innerWidth;
        const nextHeight = window.innerHeight;
        const nextTouch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

        setDimensions(prev => {
          if (
            prev.width === nextWidth &&
            prev.height === nextHeight &&
            prev.isTouch === nextTouch
          ) {
            return prev;
          }
          return { width: nextWidth, height: nextHeight, isTouch: nextTouch };
        });
      });
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    const mqlMobile = window.matchMedia('(max-width: 767px)');
    const mqlTablet = window.matchMedia('(max-width: 1023px)');
    const mqlDesktop = window.matchMedia('(min-width: 1400px)');

    mqlMobile.addEventListener?.('change', handleUpdate);
    mqlTablet.addEventListener?.('change', handleUpdate);
    mqlDesktop.addEventListener?.('change', handleUpdate);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      mqlMobile.removeEventListener?.('change', handleUpdate);
      mqlTablet.removeEventListener?.('change', handleUpdate);
      mqlDesktop.removeEventListener?.('change', handleUpdate);
    };
  }, []);

  const breakpoint = resolveBreakpoint(dimensions.width);
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isLaptop = breakpoint === 'laptop';
  const isDesktopWide = breakpoint === 'desktop';
  const isMobileOrTablet = isMobile || isTablet;

  return (
    <ViewportContext.Provider
      value={{
        breakpoint,
        width: dimensions.width,
        height: dimensions.height,
        isMobile,
        isTablet,
        isLaptop,
        isDesktopWide,
        isMobileOrTablet,
        isTouch: dimensions.isTouch,
        mobileScreenerLayout,
        setMobileScreenerLayout,
      }}
    >
      {children}
    </ViewportContext.Provider>
  );
};

export function useViewport(): ViewportState {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    throw new Error('useViewport debe usarse dentro de un ViewportProvider');
  }
  return ctx;
}
