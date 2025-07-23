import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Star, TrendingUp, Calendar, Filter, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart as RechartsBarChart, Bar } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url: string;
}

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
}

interface QuestionAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  answer_value: any;
  created_at: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
}

interface Props {
  allInstructors: Instructor[];
  getFilteredSurveys: () => Survey[];
  setSelectedSurvey: (surveyId: string) => void;
  selectedSurvey: string;
  answers: QuestionAnswer[];
  questions: SurveyQuestion[];
}

const InstructorIndividualStats = ({
  allInstructors,
  getFilteredSurveys,
  setSelectedSurvey,
  selectedSurvey,
  answers,
  questions
}: Props) => {
  const [selectedInstructorDetail, setSelectedInstructorDetail] = useState<string>('');
  const [viewType, setViewType] = useState<'monthly' | 'yearly' | 'round' | 'half-yearly' | 'quarterly'>('yearly');
  const [instructorResponses, setInstructorResponses] = useState<any[]>([]);
  const [showSurveyDetails, setShowSurveyDetails] = useState<string>('');

  // 강사별 누적 평점 계산
  const getInstructorRatings = (instructorId: string) => {
    const instructorSurveys = getFilteredSurveys().filter(s => s.instructor_id === instructorId);
    const allRatings: number[] = [];
    
    instructorSurveys.forEach(survey => {
      const surveyQuestions = questions.filter(q => q.question_type === 'rating');
      surveyQuestions.forEach(question => {
        const questionAnswers = answers.filter(a => a.question_id === question.id);
        questionAnswers.forEach(answer => {
          const rating = parseInt(answer.answer_text);
          if (!isNaN(rating)) {
            allRatings.push(rating);
          }
        });
      });
    });

    const avgRating = allRatings.length > 0 ? 
      (allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length).toFixed(1) : '0.0';
    
    return {
      average: avgRating,
      total: allRatings.length,
      distribution: [1, 2, 3, 4, 5].map(score => 
        allRatings.filter(r => r === score).length
      )
    };
  };

  // 시계열 데이터 생성
  const getTimeSeriesData = (instructorId: string) => {
    const instructorSurveys = getFilteredSurveys().filter(s => s.instructor_id === instructorId);
    
    if (viewType === 'yearly') {
      const yearlyData = instructorSurveys.reduce((acc, survey) => {
        const year = survey.education_year;
        if (!acc[year]) {
          acc[year] = { year, surveys: 0, totalRating: 0, ratingCount: 0 };
        }
        acc[year].surveys++;
        
        // 평점 계산
        const surveyQuestions = questions.filter(q => q.question_type === 'rating');
        surveyQuestions.forEach(question => {
          const questionAnswers = answers.filter(a => a.question_id === question.id);
          questionAnswers.forEach(answer => {
            const rating = parseInt(answer.answer_text);
            if (!isNaN(rating)) {
              acc[year].totalRating += rating;
              acc[year].ratingCount++;
            }
          });
        });
        
        return acc;
      }, {} as any);
      
      return Object.values(yearlyData).map((data: any) => ({
        period: `${data.year}년`,
        surveys: data.surveys,
        avgRating: data.ratingCount > 0 ? (data.totalRating / data.ratingCount).toFixed(1) : 0
      }));
    }
    
    if (viewType === 'half-yearly') {
      const halfYearlyData = instructorSurveys.reduce((acc, survey) => {
        const year = survey.education_year;
        const round = survey.education_round;
        // 1-2차: 상반기, 3-4차: 하반기로 가정
        const half = round <= 2 ? 1 : 2;
        const key = `${year}-${half}`;
        
        if (!acc[key]) {
          acc[key] = { 
            year, 
            half, 
            surveys: 0, 
            totalRating: 0, 
            ratingCount: 0 
          };
        }
        acc[key].surveys++;
        
        // 평점 계산
        const surveyQuestions = questions.filter(q => q.question_type === 'rating');
        surveyQuestions.forEach(question => {
          const questionAnswers = answers.filter(a => a.question_id === question.id);
          questionAnswers.forEach(answer => {
            const rating = parseInt(answer.answer_text);
            if (!isNaN(rating)) {
              acc[key].totalRating += rating;
              acc[key].ratingCount++;
            }
          });
        });
        
        return acc;
      }, {} as any);
      
      return Object.values(halfYearlyData).map((data: any) => ({
        period: `${data.year}년 ${data.half === 1 ? '상반기' : '하반기'}`,
        surveys: data.surveys,
        avgRating: data.ratingCount > 0 ? (data.totalRating / data.ratingCount).toFixed(1) : 0
      }));
    }
    
    if (viewType === 'quarterly') {
      const quarterlyData = instructorSurveys.reduce((acc, survey) => {
        const year = survey.education_year;
        const round = survey.education_round;
        // 1차: 1분기, 2차: 2분기, 3차: 3분기, 4차: 4분기로 가정
        const quarter = Math.min(round, 4);
        const key = `${year}-${quarter}`;
        
        if (!acc[key]) {
          acc[key] = { 
            year, 
            quarter, 
            surveys: 0, 
            totalRating: 0, 
            ratingCount: 0 
          };
        }
        acc[key].surveys++;
        
        // 평점 계산
        const surveyQuestions = questions.filter(q => q.question_type === 'rating');
        surveyQuestions.forEach(question => {
          const questionAnswers = answers.filter(a => a.question_id === question.id);
          questionAnswers.forEach(answer => {
            const rating = parseInt(answer.answer_text);
            if (!isNaN(rating)) {
              acc[key].totalRating += rating;
              acc[key].ratingCount++;
            }
          });
        });
        
        return acc;
      }, {} as any);
      
      return Object.values(quarterlyData).map((data: any) => ({
        period: `${data.year}년 ${data.quarter}분기`,
        surveys: data.surveys,
        avgRating: data.ratingCount > 0 ? (data.totalRating / data.ratingCount).toFixed(1) : 0
      }));
    }
    
    if (viewType === 'round') {
      const roundData = instructorSurveys.reduce((acc, survey) => {
        const key = `${survey.education_year}-${survey.education_round}`;
        if (!acc[key]) {
          acc[key] = { 
            year: survey.education_year, 
            round: survey.education_round, 
            surveys: 0, 
            totalRating: 0, 
            ratingCount: 0 
          };
        }
        acc[key].surveys++;
        
        // 평점 계산
        const surveyQuestions = questions.filter(q => q.question_type === 'rating');
        surveyQuestions.forEach(question => {
          const questionAnswers = answers.filter(a => a.question_id === question.id);
          questionAnswers.forEach(answer => {
            const rating = parseInt(answer.answer_text);
            if (!isNaN(rating)) {
              acc[key].totalRating += rating;
              acc[key].ratingCount++;
            }
          });
        });
        
        return acc;
      }, {} as any);
      
      return Object.values(roundData).map((data: any) => ({
        period: `${data.year}년 ${data.round}차`,
        surveys: data.surveys,
        avgRating: data.ratingCount > 0 ? (data.totalRating / data.ratingCount).toFixed(1) : 0
      }));
    }
    
    return [];
  };

  // 설문별 상세 응답 조회
  const fetchSurveyResponses = async (surveyId: string) => {
    try {
      const { data: responses, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', surveyId);
      
      if (error) throw error;
      setInstructorResponses(responses || []);
    } catch (error) {
      console.error('Error fetching survey responses:', error);
    }
  };

  useEffect(() => {
    if (showSurveyDetails) {
      fetchSurveyResponses(showSurveyDetails);
    }
  }, [showSurveyDetails]);

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

  return (
    <div className="space-y-6">
      {/* 강사 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            강사별 개별 통계
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            강사를 선택하여 상세 통계를 확인하세요
          </p>
        </CardHeader>
        <CardContent>
          <Select value={selectedInstructorDetail} onValueChange={setSelectedInstructorDetail}>
            <SelectTrigger className="w-full touch-friendly">
              <SelectValue placeholder="강사를 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {allInstructors.filter(instructor => 
                getFilteredSurveys().some(s => s.instructor_id === instructor.id)
              ).map(instructor => (
                <SelectItem key={instructor.id} value={instructor.id} className="break-words">
                  {instructor.name} {instructor.email && `(${instructor.email})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedInstructorDetail && (
        <>
          {(() => {
            const instructor = allInstructors.find(i => i.id === selectedInstructorDetail);
            const instructorSurveys = getFilteredSurveys().filter(s => s.instructor_id === selectedInstructorDetail);
            const ratings = getInstructorRatings(selectedInstructorDetail);
            const timeSeriesData = getTimeSeriesData(selectedInstructorDetail);
            
            return (
              <div className="space-y-6">
                {/* 강사 정보 */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {instructor?.photo_url ? (
                          <img 
                            src={instructor.photo_url} 
                            alt={instructor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-sm text-muted-foreground text-center">
                            사진<br/>없음
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold">{instructor?.name}</h2>
                        {instructor?.email && (
                          <p className="text-muted-foreground">{instructor.email}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 요약 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{instructorSurveys.length}</div>
                      <div className="text-sm text-muted-foreground">총 설문조사</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{ratings.total}</div>
                      <div className="text-sm text-muted-foreground">총 평가 수</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                        <Star className="h-5 w-5 fill-current" />
                        {ratings.average}
                      </div>
                      <div className="text-sm text-muted-foreground">누적 평점</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {instructorSurveys.filter(s => s.status === 'active').length}
                      </div>
                      <div className="text-sm text-muted-foreground">진행중 설문</div>
                    </div>
                  </Card>
                </div>

                {/* 시계열 분석 */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        누적 평점 추이
                      </CardTitle>
                      <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
                        <SelectTrigger className="w-32 touch-friendly">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="yearly">연도별</SelectItem>
                          <SelectItem value="half-yearly">반기별</SelectItem>
                          <SelectItem value="quarterly">분기별</SelectItem>
                          <SelectItem value="round">회차별</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {timeSeriesData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={timeSeriesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis domain={[0, 5]} />
                            <Tooltip />
                            <Line 
                              type="monotone" 
                              dataKey="avgRating" 
                              stroke="#8884d8" 
                              strokeWidth={2}
                              dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        데이터가 충분하지 않습니다
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 평점 분포 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart className="h-5 w-5" />
                      평점 분포
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ratings.distribution.map((count, index) => ({
                                name: `${index + 1}점`,
                                value: count,
                                percentage: ratings.total > 0 ? Math.round((count / ratings.total) * 100) : 0
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {ratings.distribution.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [`${value}개`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {ratings.distribution.map((count, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: COLORS[index] }}
                            />
                            <span className="text-sm w-8">{index + 1}점</span>
                            <div className="flex-1">
                              <Progress 
                                value={ratings.total > 0 ? (count / ratings.total) * 100 : 0} 
                                className="h-2"
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12">
                              {count}개
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 설문조사 목록 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      진행한 설문조사
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {instructorSurveys.map(survey => (
                        <div key={survey.id} className="border rounded-lg p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium break-words">{survey.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {survey.education_year}년 {survey.education_round}차
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                                {survey.status === 'active' ? '진행중' : 
                                 survey.status === 'completed' ? '완료' : '초안'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="touch-friendly"
                                onClick={() => {
                                  setSelectedSurvey(survey.id);
                                  setShowSurveyDetails(survey.id);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                응답 확인
                              </Button>
                            </div>
                          </div>
                          
                          {showSurveyDetails === survey.id && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-muted/30 rounded">
                                  <div className="text-lg font-bold text-primary">
                                    {instructorResponses.length}
                                  </div>
                                  <div className="text-xs text-muted-foreground">총 응답 수</div>
                                </div>
                                <div className="text-center p-3 bg-muted/30 rounded">
                                  <div className="text-lg font-bold text-primary">
                                    {instructorResponses.length > 0 ? 
                                     new Date(instructorResponses[0].submitted_at).toLocaleDateString() : '-'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">최근 응답</div>
                                </div>
                                <div className="text-center p-3 bg-muted/30 rounded">
                                  <div className="text-lg font-bold text-primary">
                                    {(() => {
                                      const ratingQuestions = questions.filter(q => q.question_type === 'rating');
                                      const surveyRatings: number[] = [];
                                      ratingQuestions.forEach(question => {
                                        const questionAnswers = answers.filter(a => a.question_id === question.id);
                                        questionAnswers.forEach(answer => {
                                          const rating = parseInt(answer.answer_text);
                                          if (!isNaN(rating)) {
                                            surveyRatings.push(rating);
                                          }
                                        });
                                      });
                                      return surveyRatings.length > 0 ? 
                                        (surveyRatings.reduce((sum, r) => sum + r, 0) / surveyRatings.length).toFixed(1) : '-';
                                    })()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">평균 평점</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </>
      )}

      {!selectedInstructorDetail && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              상세 통계를 확인할 강사를 선택해주세요
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InstructorIndividualStats;