import { InstructorStatsRecord, QuestionStat, RatingDistribution } from '@/repositories/instructorStatsRepo';

export interface SummaryMetrics {
  totalSurveys: number;
  totalResponses: number;
  activeSurveys: number;
  avgSatisfaction: number;
  satisfactionPercentage: number;
  avgResponsesPerSurvey: number;
}

export interface TrendPoint {
  period: string;
  year: number;
  round: number;
  average: number;
  responses: number;
  satisfaction: number;
  courses: string[];
  courseCount: number;
}

export interface CourseBreakdownItem {
  course: string;
  avgSatisfaction: number;
  responses: number;
  surveys: number;
  satisfactionPercentage: number;
}

export interface RatingBucket {
  name: string;
  value: number;
  percentage: number;
}

export interface AggregatedQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  satisfactionType: string | null;
  orderIndex: number | null;
  totalAnswers: number;
  average: number | null;
  ratingDistribution: RatingDistribution;
  textAnswers: string[];
}

export interface CategorySummary {
  questions: AggregatedQuestion[];
  average: number | null;
}

export interface QuestionInsights {
  questions: AggregatedQuestion[];
  categories: {
    subject: CategorySummary;
    instructor: CategorySummary;
    operation: CategorySummary;
  };
  textResponses: string[];
}

export interface CombinedMetrics {
  source: 'real' | 'test';
  responseCount: number;
  surveyCount: number;
  activeSurveyCount: number;
  avgOverall: number | null;
  avgCourse: number | null;
  avgInstructor: number | null;
  avgOperation: number | null;
  ratingDistribution: RatingDistribution;
  questionStats: QuestionStat[];
  textResponses: string[];
  textResponseCount: number;
  educationYear: number;
  educationRound: number;
  courseName: string | null;
  normalizedCourseName: string | null;
}

const SCORE_RANGE = Array.from({ length: 10 }, (_v, index) => index + 1);

export function normalizeCourseName(name?: string | null): string | null {
  if (!name) return null;
  let normalized = String(name);
  normalized = normalized.replace(/\((?:홀수조|짝수조)\)/g, '');
  normalized = normalized.replace(/\b\d{1,2}\/\d{1,2}조\b/g, '');
  normalized = normalized.replace(/(\d+차-\d+일차)\s+\d{1,2}조/g, '$1');
  normalized = normalized.replace(/(\d+차-\d+일차)\s+(?:홀수조|짝수조)/g, '$1');
  normalized = normalized.replace(/\b\d{1,2}\s*(?:조|반)\b/g, '');
  normalized = normalized.replace(/(?:홀수조|짝수조)-/g, '');
  normalized = normalized.replace(/\s{2,}/g, ' ').replace(/-{2,}/g, '-').trim();
  return normalized.length > 0 ? normalized : null;
}

export function calculateWeightedAverage(values: Array<{ value: number | null | undefined; weight: number }>): number | null {
  const accumulator = values.reduce(
    (acc, { value, weight }) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return acc;
      if (!Number.isFinite(weight) || weight <= 0) return acc;
      acc.sum += value * weight;
      acc.weight += weight;
      return acc;
    },
    { sum: 0, weight: 0 }
  );

  if (accumulator.weight <= 0) return null;
  return accumulator.sum / accumulator.weight;
}

function emptyDistribution(): RatingDistribution {
  return SCORE_RANGE.reduce((acc, score) => {
    acc[score] = 0;
    return acc;
  }, {} as RatingDistribution);
}

function sumDistributions(target: RatingDistribution, source: RatingDistribution) {
  SCORE_RANGE.forEach(score => {
    target[score] = (target[score] ?? 0) + (source[score] ?? 0);
  });
}

function distributionTotal(distribution: RatingDistribution): number {
  return SCORE_RANGE.reduce((sum, score) => sum + (distribution[score] ?? 0), 0);
}

export function getCombinedRecordMetrics(record: InstructorStatsRecord, includeTestData: boolean): CombinedMetrics {
  const shouldUseTest = includeTestData && record.responseCount === 0 && record.testResponseCount > 0;
  const metrics = shouldUseTest ? record.test : record.real;

  return {
    source: shouldUseTest ? 'test' : 'real',
    responseCount: shouldUseTest ? record.testResponseCount : record.responseCount,
    surveyCount: shouldUseTest ? record.testSurveyCount : record.surveyCount,
    activeSurveyCount: shouldUseTest ? record.testActiveSurveyCount : record.activeSurveyCount,
    avgOverall: metrics.avgOverall,
    avgCourse: metrics.avgCourse,
    avgInstructor: metrics.avgInstructor,
    avgOperation: metrics.avgOperation,
    ratingDistribution: metrics.ratingDistribution,
    questionStats: metrics.questionStats,
    textResponses: metrics.textResponses,
    textResponseCount: shouldUseTest ? record.testTextResponseCount : record.textResponseCount,
    educationYear: record.educationYear,
    educationRound: record.educationRound,
    courseName: record.courseName,
    normalizedCourseName: normalizeCourseName(record.courseName),
  };
}

export function calculateSummaryMetrics(records: InstructorStatsRecord[], includeTestData: boolean): SummaryMetrics {
  const metrics = records.map(record => getCombinedRecordMetrics(record, includeTestData));

  const totalResponses = metrics.reduce((sum, item) => sum + item.responseCount, 0);
  const totalSurveys = metrics.reduce((sum, item) => sum + item.surveyCount, 0);
  const activeSurveys = metrics.reduce((sum, item) => sum + item.activeSurveyCount, 0);
  const avgSatisfaction = calculateWeightedAverage(
    metrics.map(item => ({ value: item.avgOverall, weight: item.responseCount }))
  );

  const avgResponsesPerSurvey = totalSurveys > 0 ? Math.round(totalResponses / totalSurveys) : 0;
  const avgSatisfactionRounded = avgSatisfaction !== null ? Math.round(avgSatisfaction * 10) / 10 : 0;
  const satisfactionPercentage = avgSatisfaction !== null ? Math.round(avgSatisfaction * 10) : 0;

  return {
    totalSurveys,
    totalResponses,
    activeSurveys,
    avgSatisfaction: avgSatisfactionRounded,
    satisfactionPercentage,
    avgResponsesPerSurvey,
  };
}

export function buildTrendSeries(records: InstructorStatsRecord[], includeTestData: boolean): TrendPoint[] {
  const buckets = new Map<string, {
    year: number;
    round: number;
    responses: number;
    weightedSum: number;
    weight: number;
    courses: Set<string>;
  }>();

  records.forEach(record => {
    const metrics = getCombinedRecordMetrics(record, includeTestData);
    const key = `${metrics.educationYear}-${metrics.educationRound}`;
    const bucket = buckets.get(key) ?? {
      year: metrics.educationYear,
      round: metrics.educationRound,
      responses: 0,
      weightedSum: 0,
      weight: 0,
      courses: new Set<string>(),
    };

    bucket.responses += metrics.responseCount;
    if (metrics.avgOverall !== null && metrics.responseCount > 0) {
      bucket.weightedSum += metrics.avgOverall * metrics.responseCount;
      bucket.weight += metrics.responseCount;
    }
    if (metrics.normalizedCourseName) {
      bucket.courses.add(metrics.normalizedCourseName);
    }

    buckets.set(key, bucket);
  });

  return Array.from(buckets.values())
    .map(bucket => {
      const average = bucket.weight > 0 ? bucket.weightedSum / bucket.weight : 0;
      return {
        period: `${bucket.year}-${bucket.round}차`,
        year: bucket.year,
        round: bucket.round,
        average,
        responses: bucket.responses,
        satisfaction: Math.round(average * 10),
        courses: Array.from(bucket.courses),
        courseCount: bucket.courses.size,
      } satisfies TrendPoint;
    })
    .sort((a, b) => {
      if (a.year === b.year) {
        return a.round - b.round;
      }
      return a.year - b.year;
    });
}

export function buildCourseBreakdown(records: InstructorStatsRecord[], includeTestData: boolean): CourseBreakdownItem[] {
  const buckets = new Map<string, {
    course: string;
    responses: number;
    surveys: number;
    weightedSum: number;
    weight: number;
  }>();

  records.forEach(record => {
    const metrics = getCombinedRecordMetrics(record, includeTestData);
    if (!metrics.normalizedCourseName) return;

    const bucket = buckets.get(metrics.normalizedCourseName) ?? {
      course: metrics.normalizedCourseName,
      responses: 0,
      surveys: 0,
      weightedSum: 0,
      weight: 0,
    };

    bucket.responses += metrics.responseCount;
    bucket.surveys += metrics.surveyCount;
    if (metrics.avgOverall !== null && metrics.responseCount > 0) {
      bucket.weightedSum += metrics.avgOverall * metrics.responseCount;
      bucket.weight += metrics.responseCount;
    }

    buckets.set(metrics.normalizedCourseName, bucket);
  });

  return Array.from(buckets.values())
    .map(bucket => {
      const average = bucket.weight > 0 ? bucket.weightedSum / bucket.weight : 0;
      return {
        course: bucket.course,
        responses: bucket.responses,
        surveys: bucket.surveys,
        avgSatisfaction: Number(average.toFixed(1)),
        satisfactionPercentage: Math.round(average * 10),
      } satisfies CourseBreakdownItem;
    })
    .sort((a, b) => b.avgSatisfaction - a.avgSatisfaction);
}

export function buildRatingDistribution(records: InstructorStatsRecord[], includeTestData: boolean): RatingBucket[] {
  const distribution = emptyDistribution();

  records.forEach(record => {
    const metrics = getCombinedRecordMetrics(record, includeTestData);
    sumDistributions(distribution, metrics.ratingDistribution);
  });

  const total = distributionTotal(distribution);
  const ranges: Array<{ name: string; min: number; max: number }> = [
    { name: '1-4점', min: 1, max: 4 },
    { name: '5-6점', min: 5, max: 6 },
    { name: '7-8점', min: 7, max: 8 },
    { name: '9-10점', min: 9, max: 10 },
  ];

  return ranges.map(range => {
    const value = SCORE_RANGE.filter(score => score >= range.min && score <= range.max)
      .reduce((sum, score) => sum + (distribution[score] ?? 0), 0);

    return {
      name: range.name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    } satisfies RatingBucket;
  });
}

export function aggregateQuestionStats(records: InstructorStatsRecord[], includeTestData: boolean): QuestionInsights {
  type Accumulator = {
    questionId: string;
    questionText: string;
    questionType: string;
    satisfactionType: string | null;
    orderIndex: number | null;
    totalAnswers: number;
    weightedSum: number;
    weight: number;
    ratingDistribution: RatingDistribution;
    textAnswers: Set<string>;
  };

  const map = new Map<string, Accumulator>();

  records.forEach(record => {
    const metrics = getCombinedRecordMetrics(record, includeTestData);
    metrics.questionStats.forEach(question => {
      const key = `${question.questionText}|${question.questionType}|${question.satisfactionType ?? ''}`;
      const accumulator = map.get(key) ?? {
        questionId: question.questionId || key,
        questionText: question.questionText,
        questionType: question.questionType,
        satisfactionType: question.satisfactionType ?? null,
        orderIndex: question.orderIndex ?? null,
        totalAnswers: 0,
        weightedSum: 0,
        weight: 0,
        ratingDistribution: emptyDistribution(),
        textAnswers: new Set<string>(),
      };

      accumulator.totalAnswers += question.totalAnswers;
      if (question.average !== null && question.totalAnswers > 0) {
        accumulator.weightedSum += question.average * question.totalAnswers;
        accumulator.weight += question.totalAnswers;
      }
      sumDistributions(accumulator.ratingDistribution, question.ratingDistribution);
      question.textAnswers.forEach(answer => {
        if (answer) accumulator.textAnswers.add(answer);
      });

      if (accumulator.orderIndex === null && question.orderIndex !== null) {
        accumulator.orderIndex = question.orderIndex;
      } else if (
        accumulator.orderIndex !== null &&
        question.orderIndex !== null &&
        question.orderIndex < accumulator.orderIndex
      ) {
        accumulator.orderIndex = question.orderIndex;
      }

      map.set(key, accumulator);
    });
  });

  const questions: AggregatedQuestion[] = Array.from(map.values())
    .map(item => {
      const average = item.weight > 0 ? item.weightedSum / item.weight : null;
      return {
        questionId: item.questionId,
        questionText: item.questionText,
        questionType: item.questionType,
        satisfactionType: item.satisfactionType,
        orderIndex: item.orderIndex,
        totalAnswers: item.totalAnswers,
        average,
        ratingDistribution: item.ratingDistribution,
        textAnswers: Array.from(item.textAnswers),
      } satisfies AggregatedQuestion;
    })
    .sort((a, b) => {
      const orderA = a.orderIndex ?? 0;
      const orderB = b.orderIndex ?? 0;
      if (orderA === orderB) {
        return a.questionText.localeCompare(b.questionText);
      }
      return orderA - orderB;
    });

  const categoryBuckets: Record<'subject' | 'instructor' | 'operation', { questions: AggregatedQuestion[]; sum: number; weight: number }> = {
    subject: { questions: [], sum: 0, weight: 0 },
    instructor: { questions: [], sum: 0, weight: 0 },
    operation: { questions: [], sum: 0, weight: 0 },
  };

  const mapCategory = (type: string | null): 'subject' | 'instructor' | 'operation' => {
    if (type === 'instructor') return 'instructor';
    if (type === 'operation') return 'operation';
    return 'subject';
  };

  const textResponses = new Set<string>();

  questions.forEach(question => {
    const category = mapCategory(question.satisfactionType);
    categoryBuckets[category].questions.push(question);
    if (question.average !== null && question.totalAnswers > 0) {
      categoryBuckets[category].sum += question.average * question.totalAnswers;
      categoryBuckets[category].weight += question.totalAnswers;
    }
    question.textAnswers.forEach(answer => textResponses.add(answer));
  });

  const buildCategorySummary = (category: 'subject' | 'instructor' | 'operation'): CategorySummary => {
    const bucket = categoryBuckets[category];
    const average = bucket.weight > 0 ? bucket.sum / bucket.weight : null;
    return {
      questions: bucket.questions,
      average: average !== null ? Number(average.toFixed(1)) : null,
    } satisfies CategorySummary;
  };

  return {
    questions,
    categories: {
      subject: buildCategorySummary('subject'),
      instructor: buildCategorySummary('instructor'),
      operation: buildCategorySummary('operation'),
    },
    textResponses: Array.from(textResponses),
  } satisfies QuestionInsights;
}
