import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function getBaseUrl(): string {
  // 프로덕션 환경에서는 실제 도메인 사용
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // 서버사이드에서는 기본값 사용
  return 'https://sseducationfeedback.info';
}

export function getSurveyUrl(surveyId: string): string {
  return `${getBaseUrl()}/survey/${surveyId}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
