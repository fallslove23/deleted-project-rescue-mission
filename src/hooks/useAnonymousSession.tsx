import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnonymousSession {
  anonId: string;
  userAgentHash?: string;
}

const ANON_SESSION_KEY = 'bs-feedback-anon-session';

export const useAnonymousSession = () => {
  const [session, setSession] = useState<AnonymousSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate a simple hash from user agent
  const generateUserAgentHash = (userAgent: string): string => {
    let hash = 0;
    for (let i = 0; i < userAgent.length; i++) {
      const char = userAgent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  // Initialize or retrieve anonymous session
  useEffect(() => {
    const initSession = async () => {
      try {
        // Check localStorage first
        const storedSession = localStorage.getItem(ANON_SESSION_KEY);
        
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          setSession(parsed);
          
          // Update last seen in database
          await supabase
            .from('anon_sessions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('anon_id', parsed.anonId);
        } else {
          // Create new anonymous session
          const userAgent = navigator.userAgent;
          const userAgentHash = generateUserAgentHash(userAgent);
          
          const { data, error } = await supabase
            .from('anon_sessions')
            .insert({
              user_agent_hash: userAgentHash
            })
            .select('anon_id')
            .single();

          if (error) {
            console.error('Error creating anonymous session:', error);
            // Fallback to client-side only session
            const fallbackSession = {
              anonId: crypto.randomUUID(),
              userAgentHash
            };
            setSession(fallbackSession);
            localStorage.setItem(ANON_SESSION_KEY, JSON.stringify(fallbackSession));
          } else {
            const newSession = {
              anonId: data.anon_id,
              userAgentHash
            };
            setSession(newSession);
            localStorage.setItem(ANON_SESSION_KEY, JSON.stringify(newSession));
          }
        }
      } catch (error) {
        console.error('Error initializing anonymous session:', error);
        // Fallback session
        const fallbackSession = {
          anonId: crypto.randomUUID()
        };
        setSession(fallbackSession);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  // Check if survey is completed
  const checkSurveyCompletion = async (surveyId: string): Promise<boolean> => {
    if (!session) return false;

    try {
      const { data, error } = await supabase
        .from('survey_completions')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('anon_id', session.anonId)
        .maybeSingle();

      if (error) {
        console.error('Error checking survey completion:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking survey completion:', error);
      return false;
    }
  };

  // Mark survey as completed
  const markSurveyCompleted = async (surveyId: string): Promise<boolean> => {
    if (!session) return false;

    try {
      const { error } = await supabase
        .from('survey_completions')
        .insert({
          survey_id: surveyId,
          anon_id: session.anonId,
          ip_address: null // Will be set by server if needed
        });

      if (error) {
        console.error('Error marking survey as completed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking survey as completed:', error);
      return false;
    }
  };

  // Validate and consume survey token
  const validateToken = async (surveyId: string, code: string): Promise<boolean> => {
    if (!session) return false;

    try {
      const { data, error } = await supabase
        .from('survey_tokens')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('code', code.toUpperCase())
        .is('used_at', null)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return false;
      }

      // Mark token as used
      const { error: updateError } = await supabase
        .from('survey_tokens')
        .update({
          used_at: new Date().toISOString(),
          used_by_anon_id: session.anonId
        })
        .eq('id', data.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  };

  return {
    session,
    loading,
    checkSurveyCompletion,
    markSurveyCompleted,
    validateToken
  };
};