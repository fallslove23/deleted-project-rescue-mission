import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface TestDataOptions {
  includeTestData: boolean;
  setIncludeTestData: (include: boolean) => void;
  canToggleTestData: boolean;
  getSurveyTable: () => string;
  getResponseTable: () => string;
  getAnswerTable: () => string;
}

export function useTestDataToggle(): TestDataOptions {
  const [includeTestData, setIncludeTestData] = useState(false);
  const { userRoles } = useAuth();
  
  // Only admins, operators, and directors can toggle test data
  const canToggleTestData = userRoles.includes('admin') || 
                           userRoles.includes('operator') || 
                           userRoles.includes('director');

  const getSurveyTable = () => includeTestData ? 'surveys' : 'analytics_surveys';
  const getResponseTable = () => includeTestData ? 'survey_responses' : 'analytics_responses';
  const getAnswerTable = () => includeTestData ? 'question_answers' : 'analytics_question_answers';

  return {
    includeTestData,
    setIncludeTestData,
    canToggleTestData,
    getSurveyTable,
    getResponseTable,
    getAnswerTable,
  };
}