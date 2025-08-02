import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRoles: string[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // 사용자 역할 가져오기 함수
  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', { target_user_id: userId });
      if (!error && data) {
        setUserRoles(data.map((item: any) => item.role));
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setUserRoles([]);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 역할 정보를 비동기로 가져오기
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setUserRoles([]);
        }
        setLoading(false);
      }
    );

    // Check for existing session first
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRoles(session.user.id);
      }
      setLoading(false);
    };

    checkExistingSession();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // 상태 정리
      setUserRoles([]);
      setUser(null);
      setSession(null);
      
      // 로컬 스토리지 정리
      localStorage.clear();
      sessionStorage.clear();
      
      // Supabase 로그아웃
      await supabase.auth.signOut({ scope: 'global' });
      
      // 강제 리디렉션
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout error:', error);
      // 오류가 발생해도 로컬 상태는 정리하고 리디렉션
      window.location.href = '/auth';
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};