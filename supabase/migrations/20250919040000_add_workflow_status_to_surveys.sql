DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'surveys'
      AND column_name = 'workflow_status'
  ) THEN
    ALTER TABLE public.surveys
      ADD COLUMN workflow_status text NOT NULL DEFAULT 'draft';
  END IF;
END $$;

ALTER TABLE public.surveys
  ALTER COLUMN workflow_status SET DEFAULT 'draft';

WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN status IN ('review_requested') THEN 'review_requested'
      WHEN status IN ('deployed', 'public', 'active', 'completed') THEN 'deployed'
      ELSE 'draft'
    END AS desired_workflow
  FROM public.surveys
)
UPDATE public.surveys AS s
SET workflow_status = n.desired_workflow
FROM normalized AS n
WHERE s.id = n.id
  AND (s.workflow_status IS DISTINCT FROM n.desired_workflow);

UPDATE public.surveys
SET status = CASE
    WHEN status = 'review_requested' THEN 'draft'
    WHEN status = 'deployed' THEN 'public'
    ELSE status
  END
WHERE status IN ('review_requested', 'deployed');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'surveys_workflow_status_check'
      AND conrelid = 'public.surveys'::regclass
  ) THEN
    ALTER TABLE public.surveys
      ADD CONSTRAINT surveys_workflow_status_check
      CHECK (workflow_status IN ('draft', 'review_requested', 'deployed'));
  END IF;
END $$;
