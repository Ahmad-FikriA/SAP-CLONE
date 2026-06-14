import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getMediaUrl(path) {
  if (!path) return '';
  let cleanPath = path;
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    try {
      const url = new URL(cleanPath);
      if (url.pathname.includes('/uploads/')) {
        const index = url.pathname.indexOf('/uploads/');
        cleanPath = url.pathname.substring(index); // starts with /uploads/
      } else {
        return cleanPath;
      }
    } catch (e) {
      return cleanPath;
    }
  }

  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const relative = cleanPath.replace(/^\/+/, '');
  if (relative.startsWith('uploads/')) return `${base}/${relative}`;
  return `${base}/uploads/${relative}`;
}
