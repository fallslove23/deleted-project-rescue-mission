import { ReactNode } from 'react';
import logo from '@/assets/logo.png';

interface LoadingScreenProps {
  title?: string;
  description?: string;
  showSpinner?: boolean;
  children?: ReactNode;
}

const LoadingScreen = ({
  title = 'BS 피드백',
  description = '교육과정 피드백 시스템',
  showSpinner = true,
  children,
}: LoadingScreenProps) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-primary text-primary-foreground overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/40 via-primary/30 to-primary/40 opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/40 blur-3xl opacity-30"
        aria-hidden="true"
      />
      <div className="relative z-10 text-center space-y-6 w-full px-6">
        <div className="relative w-24 h-24 mx-auto">
          <img
            src={logo}
            alt="BS 피드백 로고"
            className="w-24 h-24 mx-auto animate-pulse drop-shadow-xl"
          />
          <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping" aria-hidden="true"></div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-primary-foreground/80">{description}</p>
        </div>
        {showSpinner && (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-foreground/80"></div>
          </div>
        )}
        {children && (
          <div className="max-w-4xl mx-auto w-full text-left space-y-4 bg-background/30 backdrop-blur-sm border border-primary/20 rounded-2xl p-6 shadow-xl">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
