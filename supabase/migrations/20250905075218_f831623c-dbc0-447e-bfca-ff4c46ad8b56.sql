-- 기존 과정명/상태 스왑 문제를 완전히 정리하고 실제 과정명을 복구
WITH corrections AS (
  SELECT
    id,
    CASE course_start_date
      WHEN '2023-12-20' THEN '디지털 영업 기본 과정'
      WHEN '2024-01-11' THEN '디지털 영업 리더십 과정'
      WHEN '2024-02-14' THEN 'B2B 세일즈 전략 과정'
      WHEN '2024-03-25' THEN '고객경험 혁신 워크숍'
      WHEN '2024-05-27' THEN 'AI 영업 자동화 과정'
      WHEN '2024-06-18' THEN '데이터 기반 영업관리 과정'
      WHEN '2024-07-22' THEN '세일즈 코칭 마스터 클래스'
      WHEN '2024-08-27' THEN '영업 조직 리더십 캠프'
      WHEN '2024-09-26' THEN '프리미엄 고객관리 과정'
      WHEN '2024-10-30' THEN '신규영업 개척 집중과정'
      WHEN '2024-12-04' THEN '세일즈 파이프라인 최적화 과정'
      WHEN '2025-01-09' THEN 'CS 역량 강화 워크숍'
      WHEN '2025-02-10' THEN '디지털 마케팅 연계 세일즈'
      WHEN '2025-03-18' THEN '하이브리드 영업 운영 과정'
      WHEN '2025-04-28' THEN 'CRM 고급 활용 워크숍'
      WHEN '2025-06-04' THEN '세일즈 콘텐츠 제작 부트캠프'
      WHEN '2025-06-24' THEN '컨설팅형 영업 스킬 과정'
      WHEN '2025-07-30' THEN '세일즈 퍼포먼스 분석 과정'
      WHEN '2025-09-03' THEN '세일즈 프로세스 혁신 랩'
      WHEN '2025-08-13' THEN '영업 전략 PM 과정'
    END AS new_course_name,
    CASE course_start_date
      WHEN '2023-12-20' THEN '완료'
      WHEN '2024-01-11' THEN '완료'
      WHEN '2024-02-14' THEN '완료'
      WHEN '2024-03-25' THEN '완료'
      WHEN '2024-05-27' THEN '완료'
      WHEN '2024-06-18' THEN '완료'
      WHEN '2024-07-22' THEN '완료'
      WHEN '2024-08-27' THEN '완료'
      WHEN '2024-09-26' THEN '완료'
      WHEN '2024-10-30' THEN '완료'
      WHEN '2024-12-04' THEN '완료'
      WHEN '2025-01-09' THEN '완료'
      WHEN '2025-02-10' THEN '완료'
      WHEN '2025-03-18' THEN '완료'
      WHEN '2025-04-28' THEN '완료'
      WHEN '2025-06-04' THEN '완료'
      WHEN '2025-06-24' THEN '진행 중'
      WHEN '2025-07-30' THEN '진행 예정'
      WHEN '2025-09-03' THEN '진행 예정'
      WHEN '2025-08-13' THEN '진행 중'
    END AS new_status
  FROM course_statistics
  WHERE course_start_date IN (
    '2023-12-20', '2024-01-11', '2024-02-14', '2024-03-25', '2024-05-27',
    '2024-06-18', '2024-07-22', '2024-08-27', '2024-09-26', '2024-10-30',
    '2024-12-04', '2025-01-09', '2025-02-10', '2025-03-18', '2025-04-28',
    '2025-06-04', '2025-06-24', '2025-07-30', '2025-09-03', '2025-08-13'
  )
)
UPDATE course_statistics AS cs
SET
  course_name = CASE
    WHEN cs.course_name IN ('완료', '진행 중', '진행 예정', '취소', 'BS Basic', 'BS Advanced', '영업 집체')
      OR cs.course_name IS NULL OR cs.course_name = ''
      THEN corrections.new_course_name
    ELSE cs.course_name
  END,
  status = CASE
    WHEN cs.course_name IN ('완료', '진행 중', '진행 예정', '취소') THEN corrections.new_status
    WHEN cs.status IN ('BS Basic', 'BS Advanced', '영업 집체') THEN corrections.new_status
    WHEN corrections.new_status IN ('진행 중', '진행 예정') AND cs.status = '완료' THEN corrections.new_status
    ELSE cs.status
  END
FROM corrections
WHERE cs.id = corrections.id;

