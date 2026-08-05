const ANNOTATE_ROLES = new Set(["department", "admin", "legal", "iro_admin"]);
const VIEW_ROLES = new Set(["department", "admin", "legal", "iro_admin", "staff"]);

export function canAnnotateDocument(roleKey) {
  return ANNOTATE_ROLES.has(roleKey);
}

export function canViewDocumentReview(roleKey) {
  return VIEW_ROLES.has(roleKey);
}

export function normalizeHighlightCoordinates(clientRects, pageRect) {
  if (!pageRect?.width || !pageRect?.height) return null;

  const rects = Array.from(clientRects)
    .map((rect) => {
      const x = (rect.left - pageRect.left) / pageRect.width;
      const y = (rect.top - pageRect.top) / pageRect.height;
      const w = rect.width / pageRect.width;
      const h = rect.height / pageRect.height;
      if (w <= 0 || h <= 0) return null;
      return {
        x: clamp01(x),
        y: clamp01(y),
        w: clamp01(w),
        h: clamp01(h),
      };
    })
    .filter(Boolean);

  if (!rects.length) return null;

  return {
    version: 1,
    page_width: pageRect.width,
    page_height: pageRect.height,
    rects,
  };
}

export function getHighlightRects(coordinates, pageRect) {
  if (!coordinates || !pageRect?.width || !pageRect?.height) return [];

  const source = Array.isArray(coordinates?.rects)
    ? coordinates.rects
    : Array.isArray(coordinates)
      ? coordinates
      : [];

  return source
    .map((rect) => {
      const x = Number(rect.x ?? rect.left ?? 0);
      const y = Number(rect.y ?? rect.top ?? 0);
      const w = Number(rect.w ?? rect.width ?? 0);
      const h = Number(rect.h ?? rect.height ?? 0);
      if (!w || !h) return null;

      const usesNormalized = x <= 1 && y <= 1 && w <= 1 && h <= 1;
      if (usesNormalized) {
        return {
          left: x * pageRect.width,
          top: y * pageRect.height,
          width: w * pageRect.width,
          height: h * pageRect.height,
        };
      }

      const scaleX = pageRect.width / (coordinates.page_width || pageRect.width);
      const scaleY = pageRect.height / (coordinates.page_height || pageRect.height);
      return {
        left: x * scaleX,
        top: y * scaleY,
        width: w * scaleX,
        height: h * scaleY,
      };
    })
    .filter(Boolean);
}

export function findPageShellFromNode(node) {
  let current = node;
  while (current) {
    if (current instanceof HTMLElement && current.dataset?.page) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function getPageLayerRect(pageShell) {
  const layer = pageShell?.querySelector(".document-viewer__page-layer");
  if (!layer) return null;
  return {
    left: layer.offsetLeft,
    top: layer.offsetTop,
    width: layer.clientWidth,
    height: layer.clientHeight,
    getBoundingClientRect: () => layer.getBoundingClientRect(),
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
