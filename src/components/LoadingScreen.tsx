import logo from '@/assets/logo.png';

const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-primary-variant">
      <div className="text-center space-y-6">
        <div className="relative">
          <img 
            src={logo} 
            alt="BS 피드백 로고" 
            className="w-24 h-24 mx-auto animate-pulse"
          />
          <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">BS 피드백</h1>
          <p className="text-white/80">교육과정 피드백 시스템</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;