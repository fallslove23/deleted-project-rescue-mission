import { format as formatDateFns } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { ko } from "date-fns/locale"

import rawMessages from "../../supabase/locales/ko.json"

const DEFAULT_LOCALE = ko
const DEFAULT_NUMBER_LOCALE = "ko-KR"

const DEFAULT_DATE_PATTERN = "yyyy.MM.dd"
const DEFAULT_DATE_TIME_PATTERN = "yyyy.MM.dd HH:mm"

type DateInput = Date | string | number | null | undefined

interface DateFormatOptions {
  pattern?: string
  timeZone?: string
}

function toDate(value: DateInput): Date | null {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) {
    return null
  }

  return date
}

function formatDateInternal(value: DateInput, pattern: string, options?: DateFormatOptions): string {
  const date = toDate(value)
  if (!date) return ""

  if (options?.timeZone) {
    return formatInTimeZone(date, options.timeZone, options.pattern ?? pattern, {
      locale: DEFAULT_LOCALE,
    })
  }

  return formatDateFns(date, options?.pattern ?? pattern, {
    locale: DEFAULT_LOCALE,
  })
}

export function formatDate(value: DateInput, options?: DateFormatOptions): string {
  return formatDateInternal(value, DEFAULT_DATE_PATTERN, options)
}

export function formatDateTime(value: DateInput, options?: DateFormatOptions): string {
  return formatDateInternal(value, DEFAULT_DATE_TIME_PATTERN, options)
}

type NumberInput = number | null | undefined

export function formatNumber(value: NumberInput, options: Intl.NumberFormatOptions = {}, locale = DEFAULT_NUMBER_LOCALE): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }

  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatCurrency(
  value: NumberInput,
  currency = "KRW",
  options: Intl.NumberFormatOptions = {},
  locale = DEFAULT_NUMBER_LOCALE,
): string {
  return formatNumber(value, { style: "currency", currency, ...options }, locale)
}

interface FormatUnitOptions extends Intl.NumberFormatOptions {
  unitSuffix?: string
  unitPrefix?: string
  unit?: Intl.NumberFormatOptions["unit"]
  unitDisplay?: Intl.NumberFormatOptions["unitDisplay"]
}

export function formatUnit(
  value: NumberInput,
  { unitSuffix = "", unitPrefix = "", unit, unitDisplay = "short", ...numberOptions }: FormatUnitOptions = {},
  locale = DEFAULT_NUMBER_LOCALE,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }

  if (unit) {
    return `${unitPrefix}${new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay,
      ...numberOptions,
    }).format(value)}${unitSuffix}`
  }

  const formatted = formatNumber(value, numberOptions, locale)
  return `${unitPrefix}${formatted}${unitSuffix}`
}

export function formatPercent(
  value: NumberInput,
  { maximumFractionDigits = 1, minimumFractionDigits }: Intl.NumberFormatOptions = {},
  locale = DEFAULT_NUMBER_LOCALE,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return ""
  }

  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
}

type Messages = typeof rawMessages

type NestedValueOf<T> = T extends string
  ? T
  : { [K in keyof T]: NestedValueOf<T[K]> }[keyof T]

const messages: Messages = rawMessages

function resolveMessage(path: string, source: Record<string, any> = messages): string | undefined {
  return path.split(".").reduce((acc: any, key: string) => {
    if (acc && typeof acc === "object" && key in acc) {
      return acc[key]
    }
    return undefined
  }, source)
}

export const MESSAGE_KEYS = {
  common: {
    cancel: "common.cancel",
    edit: "common.edit",
    saving: "common.saving",
    adminOnlyAccess: "common.adminOnlyAccess",
    pageCount: "common.pageCount",
    countWithUnit: "common.countWithUnit",
    percentage: "common.percentage",
    todaySubmission: "common.todaySubmission",
    completedQuestionCount: "common.completedQuestionCount",
    noResponses: "common.noResponses",
    recentResponsesLimited: "common.recentResponsesLimited",
    allowlistTotal: "common.allowlistTotal",
    noEmailLogs: "common.noEmailLogs",
    noLogs: "common.noLogs",
    refresh: "common.refresh",
    loading: "common.loading",
    details: "common.details",
    none: "common.none",
    accessDenied: "common.accessDenied",
    units: {
      case: "common.units.case",
      person: "common.units.person",
    },
  },
  policy: {
    noRole: "policy.noRole",
  },
  templates: {
    createdOn: "templates.createdOn",
    updatedOn: "templates.updatedOn",
  },
  email: {
    logs: {
      recipientCount: "email.logs.recipientCount",
      successCount: "email.logs.successCount",
      failureCount: "email.logs.failureCount",
      menuTitle: "email.logs.menuTitle",
      menuSummaryTotal: "email.logs.menuSummaryTotal",
      menuSummaryRate: "email.logs.menuSummaryRate",
      noPermissionDescription: "email.logs.noPermissionDescription",
      totalRecords: "email.logs.totalRecords",
      totalSuccess: "email.logs.totalSuccess",
      totalFailure: "email.logs.totalFailure",
      successRate: "email.logs.successRate",
      statusDistribution: "email.logs.statusDistribution",
      monthlyStats: "email.logs.monthlyStats",
      filterTitle: "email.logs.filterTitle",
      filterSurveyLabel: "email.logs.filterSurveyLabel",
      filterSurveyAll: "email.logs.filterSurveyAll",
      filterStatusLabel: "email.logs.filterStatusLabel",
      filterStatusAll: "email.logs.filterStatusAll",
      status: {
        success: "email.logs.status.success",
        failed: "email.logs.status.failed",
        partial: "email.logs.status.partial",
      },
      filterPeriodLabel: "email.logs.filterPeriodLabel",
      filterPeriodAll: "email.logs.filterPeriodAll",
      searchLabel: "email.logs.searchLabel",
      searchPlaceholder: "email.logs.searchPlaceholder",
      tableTitle: "email.logs.tableTitle",
      table: {
        survey: "email.logs.table.survey",
        status: "email.logs.table.status",
        recipients: "email.logs.table.recipients",
        result: "email.logs.table.result",
        sentAt: "email.logs.table.sentAt",
        details: "email.logs.table.details",
      },
      empty: "email.logs.empty",
      additionalRecipients: "email.logs.additionalRecipients",
      surveyWithRound: "email.logs.surveyWithRound",
      dialogTitle: "email.logs.dialogTitle",
      basicInfo: "email.logs.basicInfo",
      field: {
        survey: "email.logs.field.survey",
        status: "email.logs.field.status",
        sentAt: "email.logs.field.sentAt",
        result: "email.logs.field.result",
      },
      recipients: "email.logs.recipients",
      errorInfo: "email.logs.errorInfo",
      resultDetails: "email.logs.resultDetails",
      toast: {
        errorTitle: "email.logs.toast.errorTitle",
        errorDescription: "email.logs.toast.errorDescription",
      },
      noSurveyInfo: "email.logs.noSurveyInfo",
    },
  },
  errors: {
    surveyNotStarted: "errors.surveyNotStarted",
    surveyEnded: "errors.surveyEnded",
    surveyUnavailable: "errors.surveyUnavailable",
    surveyMissing: "errors.surveyMissing",
  },
  summary: {
    responseCount: "summary.responseCount",
  },
  analysis: {
    valueWithPercentage: "analysis.valueWithPercentage",
  },
} as const

export type MessageKey = NestedValueOf<typeof MESSAGE_KEYS>

export function formatMessage(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = resolveMessage(key)

  if (!template || typeof template !== "string") {
    return key
  }

  return template.replace(/\{(\w+)\}/g, (match, param) => {
    if (param in params) {
      return String(params[param])
    }
    return match
  })
}

